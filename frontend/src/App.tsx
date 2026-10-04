import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { api } from './services/api';
import {
  Technician,
  ServiceRequest,
  ScheduleVersion,
  NotificationItem,
  AuditLog,
  ValidatedAiPlanResponse,
  ScheduleDiff,
  ProposedAssignment,
  Assignment,
} from './types';
import { Navbar } from './components/Navbar';
import { DashboardPage } from './pages/DashboardPage';
import { SchedulePage } from './pages/SchedulePage';
import { RequestsPage } from './pages/RequestsPage';
import { TechniciansPage } from './pages/TechniciansPage';
import { ActivityPage } from './pages/ActivityPage';
import { AiProposalModal } from './components/AiProposalModal';
import { ReplanDiffModal } from './components/ReplanDiffModal';
import { AssignmentEditDrawer } from './components/AssignmentEditDrawer';
import { EmergencyRequestModal } from './components/EmergencyRequestModal';
import { NotificationPanel } from './components/NotificationPanel';

export function App() {
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [currentSchedule, setCurrentSchedule] = useState<ScheduleVersion | null>(null);
  const [scheduleVersions, setScheduleVersions] = useState<ScheduleVersion[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Modals & Panels
  const [proposalModal, setProposalModal] = useState<{
    isOpen: boolean;
    proposal: ValidatedAiPlanResponse | null;
    trigger: string;
  }>({
    isOpen: false,
    proposal: null,
    trigger: 'INITIAL_PLAN',
  });

  const [replanModal, setReplanModal] = useState<{
    isOpen: boolean;
    trigger: string;
    diff: ScheduleDiff | null;
    proposedPlan: ValidatedAiPlanResponse | null;
    context: any;
  }>({
    isOpen: false,
    trigger: 'REPLAN',
    diff: null,
    proposedPlan: null,
    context: null,
  });

  const [isEmergencyModalOpen, setIsEmergencyModalOpen] = useState(false);
  const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);

  // Loading indicators
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4500);
  };

  // Fetch all core state from backend
  const refreshData = useCallback(async () => {
    try {
      const [techsData, reqsData, currSchedData, versionsData, notifsData, logsData] =
        await Promise.all([
          api.getTechnicians(),
          api.getRequests(),
          api.getCurrentSchedule(),
          api.getScheduleVersions(),
          api.getNotifications(),
          api.getAuditLogs(),
        ]);

      setTechnicians(techsData);
      setRequests(reqsData);
      setCurrentSchedule(currSchedData.currentSchedule);
      setScheduleVersions(versionsData);
      setNotifications(notifsData);
      setAuditLogs(logsData);
    } catch (err: any) {
      console.error('Failed to load data from backend:', err);
      showToast(err.message || 'Failed to load data', 'error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Handle Initial Plan Generation
  const handleGeneratePlan = async () => {
    setIsGenerating(true);
    try {
      const result = await api.generatePlan('INITIAL_PLAN');
      setProposalModal({
        isOpen: true,
        proposal: result.proposal,
        trigger: 'INITIAL_PLAN',
      });
    } catch (err: any) {
      showToast(err.message || 'Plan generation failed', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle Plan Approval
  const handleApprovePlan = async (assignmentsToApprove: ProposedAssignment[]) => {
    setIsApproving(true);
    try {
      const trigger = proposalModal.isOpen ? proposalModal.trigger : replanModal.trigger;
      const res = await api.approveSchedule({
        proposedAssignments: assignmentsToApprove,
        trigger,
        actor: 'Dispatcher',
        metadata: {
          tradeoffs: proposalModal.proposal?.tradeoffs || replanModal.proposedPlan?.tradeoffs || [],
          unassigned:
            proposalModal.proposal?.unassignedRequests || replanModal.proposedPlan?.unassignedRequests || [],
        },
      });

      setProposalModal({ isOpen: false, proposal: null, trigger: 'INITIAL_PLAN' });
      setReplanModal({ isOpen: false, trigger: 'REPLAN', diff: null, proposedPlan: null, context: null });

      showToast(`Schedule Version ${res.schedule.versionNumber} approved! (${res.notificationsCount} notifications sent)`);
      await refreshData();
    } catch (err: any) {
      showToast(err.message || 'Failed to approve schedule', 'error');
    } finally {
      setIsApproving(false);
    }
  };

  // Handle Technician Cancellation
  const handleCancelTechnician = async (techId: string) => {
    setIsCancelling(true);
    try {
      const res = await api.cancelTechnician(techId);
      setReplanModal({
        isOpen: true,
        trigger: 'TECHNICIAN_CANCELLATION',
        diff: res.diff,
        proposedPlan: res.proposedPlan,
        context: res.context,
      });
      await refreshData();
    } catch (err: any) {
      showToast(err.message || 'Failed to cancel technician', 'error');
    } finally {
      setIsCancelling(false);
    }
  };

  // Handle Technician Restore
  const handleRestoreTechnician = async (techId: string) => {
    try {
      await api.restoreTechnician(techId);
      showToast(`Technician ${techId} restored to Available.`);
      await refreshData();
    } catch (err: any) {
      showToast(err.message || 'Failed to restore technician', 'error');
    }
  };

  // Handle Emergency Request Creation
  const handleCreateEmergency = async (formData: any) => {
    setIsGenerating(true);
    try {
      const res = await api.createEmergencyRequest(formData);
      setIsEmergencyModalOpen(false);
      setReplanModal({
        isOpen: true,
        trigger: 'EMERGENCY_REQUEST',
        diff: res.diff,
        proposedPlan: res.proposedPlan,
        context: res.context,
      });
      showToast(`Emergency request ${res.context?.emergencyRequest?.id} dispatched. Replanning proposal ready.`);
      await refreshData();
    } catch (err: any) {
      showToast(err.message || 'Failed to dispatch emergency request', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle Mark Notifications Read
  const handleMarkAllRead = async () => {
    try {
      await api.markNotificationsAsRead();
      await refreshData();
    } catch (err) {
      console.error(err);
    }
  };

  // Reset Demo Database
  const handleResetDemo = async () => {
    setIsResetting(true);
    try {
      await api.resetDemoDatabase();
      showToast('Demo reset to initial clean seed state.');
      await refreshData();
    } catch (err: any) {
      showToast(err.message || 'Failed to reset demo', 'error');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
        {/* Navbar */}
        <Navbar
          currentSchedule={currentSchedule}
          notifications={notifications}
          onOpenNotifications={() => setIsNotificationPanelOpen(true)}
          onResetDemo={handleResetDemo}
          isResetting={isResetting}
        />

        {/* Toast Alert */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 animate-fade-in">
            <div
              className={`px-4 py-3 rounded-xl shadow-2xl border text-xs font-semibold flex items-center space-x-2 ${
                toastMessage.type === 'error'
                  ? 'bg-rose-900/90 border-rose-500 text-rose-100'
                  : toastMessage.type === 'info'
                  ? 'bg-blue-900/90 border-blue-500 text-blue-100'
                  : 'bg-emerald-900/90 border-emerald-500 text-emerald-100'
              }`}
            >
              <span>{toastMessage.text}</span>
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mr-3" />
              <span>Loading Dispatch Workspace...</span>
            </div>
          ) : (
            <Routes>
              <Route
                path="/"
                element={
                  <DashboardPage
                    technicians={technicians}
                    requests={requests}
                    currentSchedule={currentSchedule}
                    onGeneratePlan={handleGeneratePlan}
                    isGenerating={isGenerating}
                    onOpenEmergencyModal={() => setIsEmergencyModalOpen(true)}
                    onSelectAssignment={(a) => setSelectedAssignment(a)}
                  />
                }
              />
              <Route
                path="/schedule"
                element={
                  <SchedulePage
                    technicians={technicians}
                    requests={requests}
                    scheduleVersions={scheduleVersions}
                    currentSchedule={currentSchedule}
                    onSelectAssignment={(a) => setSelectedAssignment(a)}
                    onGeneratePlan={handleGeneratePlan}
                    isGenerating={isGenerating}
                  />
                }
              />
              <Route
                path="/requests"
                element={
                  <RequestsPage
                    requests={requests}
                    onOpenEmergencyModal={() => setIsEmergencyModalOpen(true)}
                  />
                }
              />
              <Route
                path="/technicians"
                element={
                  <TechniciansPage
                    technicians={technicians}
                    onCancelTechnician={handleCancelTechnician}
                    onRestoreTechnician={handleRestoreTechnician}
                    isCancelling={isCancelling}
                  />
                }
              />
              <Route path="/activity" element={<ActivityPage logs={auditLogs} />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          )}
        </main>

        {/* AI Proposal Review Modal */}
        <AiProposalModal
          isOpen={proposalModal.isOpen}
          onClose={() => setProposalModal({ isOpen: false, proposal: null, trigger: 'INITIAL_PLAN' })}
          proposal={proposalModal.proposal}
          technicians={technicians}
          requests={requests}
          onApprove={handleApprovePlan}
          isApproving={isApproving}
          triggerName={proposalModal.trigger}
        />

        {/* Replanning Diff Modal */}
        <ReplanDiffModal
          isOpen={replanModal.isOpen}
          onClose={() => setReplanModal({ isOpen: false, trigger: 'REPLAN', diff: null, proposedPlan: null, context: null })}
          trigger={replanModal.trigger}
          diff={replanModal.diff}
          proposedPlan={replanModal.proposedPlan}
          technicians={technicians}
          requests={requests}
          onApproveRevised={handleApprovePlan}
          isApproving={isApproving}
          contextData={replanModal.context}
        />

        {/* Assignment Edit & Details Drawer */}
        <AssignmentEditDrawer
          assignment={selectedAssignment}
          technicians={technicians}
          requests={requests}
          isOpen={!!selectedAssignment}
          onClose={() => setSelectedAssignment(null)}
          onSaved={refreshData}
        />

        {/* Emergency Request Modal */}
        <EmergencyRequestModal
          isOpen={isEmergencyModalOpen}
          onClose={() => setIsEmergencyModalOpen(false)}
          onSubmit={handleCreateEmergency}
          isSubmitting={isGenerating}
        />

        {/* Notification Panel */}
        <NotificationPanel
          isOpen={isNotificationPanelOpen}
          onClose={() => setIsNotificationPanelOpen(false)}
          notifications={notifications}
          onMarkAllRead={handleMarkAllRead}
        />
      </div>
    </BrowserRouter>
  );
}

export default App;
