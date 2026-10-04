import React from 'react';
import { Bell, CheckCircle2, User, Wrench, X } from 'lucide-react';
import { NotificationItem } from '../types';

interface NotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  onMarkAllRead: () => void;
}

export const NotificationPanel: React.FC<NotificationPanelProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkAllRead,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={onClose} />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-sm bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col">
          {/* Header */}
          <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
            <div className="flex items-center space-x-2">
              <Bell className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-bold text-white">Mock Dispatch Notifications</h3>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Subheader */}
          <div className="px-5 py-2 bg-slate-800/40 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>{notifications.length} simulated notifications</span>
            <button
              onClick={onMarkAllRead}
              className="text-blue-400 hover:text-blue-300 font-medium text-[11px]"
            >
              Mark all read
            </button>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {notifications.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs">
                No notifications logged yet. Approve a schedule to trigger simulated technician and customer notifications.
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`p-3 rounded-xl border text-xs space-y-1.5 transition-all ${
                    n.status === 'SENT'
                      ? 'bg-blue-950/20 border-blue-500/30 text-slate-200'
                      : 'bg-slate-800/40 border-slate-700/50 text-slate-400'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        n.recipientType === 'TECHNICIAN'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                      }`}
                    >
                      {n.recipientType} • {n.recipientId}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <p className="text-xs leading-relaxed text-slate-300">{n.message}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
