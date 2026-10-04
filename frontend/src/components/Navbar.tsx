import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  CalendarDays,
  Wrench,
  Users,
  History,
  Bell,
  RotateCcw,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import { NotificationItem, ScheduleVersion } from '../types';

interface NavbarProps {
  currentSchedule: ScheduleVersion | null;
  notifications: NotificationItem[];
  onOpenNotifications: () => void;
  onResetDemo: () => void;
  isResetting: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentSchedule,
  notifications,
  onOpenNotifications,
  onResetDemo,
  isResetting,
}) => {
  const unreadCount = notifications.filter((n) => n.status === 'SENT').length;

  const navItems = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/schedule', label: 'Schedule Timeline', icon: CalendarDays },
    { to: '/requests', label: 'Requests', icon: Wrench },
    { to: '/technicians', label: 'Technicians', icon: Users },
    { to: '/activity', label: 'Audit Log', icon: History },
  ];

  return (
    <header className="bg-slate-900/90 backdrop-blur border-b border-slate-800 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Brand */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20 ring-1 ring-white/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg tracking-tight text-white">Aggroso Dispatch</span>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> AI + Deterministic
                </span>
              </div>
              <p className="text-xs text-slate-400">Field Service Dispatch & Replanning Agent</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center space-x-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-blue-600/15 text-blue-400 border border-blue-500/30'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                    }`
                  }
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>

          {/* Right actions: Schedule Version, Notifications, Reset */}
          <div className="flex items-center space-x-3">
            {currentSchedule && (
              <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/80 text-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="text-slate-400">Active:</span>
                <span className="font-semibold text-emerald-400">v{currentSchedule.versionNumber}</span>
                <span className="text-slate-500 text-[10px] uppercase tracking-wider bg-slate-700/50 px-1.5 py-0.5 rounded">
                  {currentSchedule.trigger}
                </span>
              </div>
            )}

            {/* Notification Button */}
            <button
              onClick={onOpenNotifications}
              className="relative p-2 rounded-lg bg-slate-800/60 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700/60 transition-colors"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center animate-bounce">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Reset Demo Button */}
            <button
              onClick={onResetDemo}
              disabled={isResetting}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-xs font-medium transition-all disabled:opacity-50"
              title="Reset database to demo seed state"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Reset Demo</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
