import React, { useState } from 'react';
import { AlertOctagon, X, Clock, MapPin, Wrench, ShieldAlert } from 'lucide-react';

interface EmergencyRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    title: string;
    description: string;
    region: string;
    requiredSkill: string;
    estimatedDurationMinutes: number;
    preferredStartTime: string;
    preferredEndTime: string;
  }) => void;
  isSubmitting: boolean;
}

export const EmergencyRequestModal: React.FC<EmergencyRequestModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
}) => {
  if (!isOpen) return null;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [region, setRegion] = useState('North');
  const [requiredSkill, setRequiredSkill] = useState('Electrical');
  const [duration, setDuration] = useState(60);
  const [preferredStart, setPreferredStart] = useState('14:00');
  const [preferredEnd, setPreferredEnd] = useState('16:00');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      title,
      description,
      region,
      requiredSkill,
      estimatedDurationMinutes: Number(duration),
      preferredStartTime: preferredStart,
      preferredEndTime: preferredEnd,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-lg bg-slate-900 border border-rose-900/60 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-800 bg-gradient-to-r from-rose-950/40 to-slate-900 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">Create Emergency Work Order</h3>
              <p className="text-xs text-rose-300/80">
                Priority: CRITICAL. System will initiate an automatic replanning proposal.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Emergency Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Hospital Emergency Power Substation Failure"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Description & Emergency Details
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide context regarding failure severity and safety precautions..."
              className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Region *
              </label>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:ring-2 focus:ring-rose-500"
              >
                <option value="North">North</option>
                <option value="South">South</option>
                <option value="East">East</option>
                <option value="West">West</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Required Skill *
              </label>
              <select
                value={requiredSkill}
                onChange={(e) => setRequiredSkill(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:ring-2 focus:ring-rose-500"
              >
                <option value="Electrical">Electrical</option>
                <option value="HVAC">HVAC</option>
                <option value="Plumbing">Plumbing</option>
                <option value="Appliance">Appliance</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Duration (min) *
              </label>
              <input
                type="number"
                min="15"
                max="360"
                step="15"
                required
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Window Start *
              </label>
              <input
                type="time"
                required
                value={preferredStart}
                onChange={(e) => setPreferredStart(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Window End *
              </label>
              <input
                type="time"
                required
                value={preferredEnd}
                onChange={(e) => setPreferredEnd(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:ring-2 focus:ring-rose-500"
              />
            </div>
          </div>

          <div className="pt-4 flex items-center justify-between border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white text-xs font-semibold shadow-lg shadow-rose-500/25 transition-all disabled:opacity-50"
            >
              <AlertOctagon className="w-4 h-4" />
              <span>{isSubmitting ? 'Dispatching & Replanning...' : 'Dispatch Emergency & Replan'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
