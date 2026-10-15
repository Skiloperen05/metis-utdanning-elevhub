import React from 'react';
import { 
  GraduationCap, 
  Users, 
  BookOpen, 
  FileText, 
  CheckCircle2, 
  Plus, 
  Send, 
  DatabaseBackup, 
  Sparkles,
  Printer,
  LayoutDashboard,
  Cloud,
  CloudCheck,
  RefreshCw,
  Calendar,
  LogOut,
  User as UserIcon,
  ShieldCheck
} from 'lucide-react';
import { AppDatabase, AppUser } from '../types';

interface HeaderProps {
  db: AppDatabase;
  currentUser?: AppUser | null;
  onLogout?: () => void;
  onOpenNewStudent: () => void;
  onOpenNewMaterial: () => void;
  onOpenBulkAssign: () => void;
  onOpenBackup: () => void;
  onOpenSessionPlanner?: () => void;
  activeTab: 'oversikt' | 'matrise' | 'elever' | 'timer' | 'materiell';
  setActiveTab: (tab: 'oversikt' | 'matrise' | 'elever' | 'timer' | 'materiell') => void;
  syncStatus?: 'connecting' | 'synced' | 'saving' | 'offline';
  cloudProvider?: 'supabase' | 'firestore';
}

export const Header: React.FC<HeaderProps> = ({
  db,
  currentUser,
  onLogout,
  onOpenNewStudent,
  onOpenBackup,
  onOpenSessionPlanner,
  activeTab,
  setActiveTab,
  syncStatus = 'synced',
  cloudProvider = 'firestore',
}) => {
  const totalStudents = db.students.length;
  const totalMaterials = db.materials.length;
  const totalSessions = (db.sessions || []).length;

  return (
    <header className="bg-white border-b border-stone-200 sticky top-0 z-30 shadow-2xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between py-3 gap-4">
          
          {/* Logo & title */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-2xs">
              <GraduationCap className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-900 text-base tracking-tight">Metis Utdanning</span>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-stone-100 text-slate-600 border border-stone-200">
                  Elevhub
                </span>

                {/* Cloud Sync Status Indicator */}
                <button 
                  onClick={onOpenBackup}
                  className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border transition-colors cursor-pointer hover:shadow-2xs ${
                    syncStatus === 'synced'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                      : syncStatus === 'saving'
                      ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                      : syncStatus === 'connecting'
                      ? 'bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100'
                      : 'bg-stone-100 text-slate-600 border-stone-200 hover:bg-stone-200'
                  }`}
                  title="Klikk for å se database- og Supabase-innstillinger"
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    syncStatus === 'synced' ? 'bg-emerald-500 animate-pulse' :
                    syncStatus === 'saving' ? 'bg-amber-500 animate-spin' :
                    syncStatus === 'connecting' ? 'bg-blue-500 animate-pulse' : 'bg-slate-400'
                  }`} />
                  <Cloud className="w-3 h-3 text-slate-500" />
                  <span>
                    {cloudProvider === 'supabase'
                      ? (syncStatus === 'synced' ? 'Supabase aktiv' : 'Lagrer til Supabase...')
                      : (syncStatus === 'synced' ? 'Skylagring aktiv' :
                         syncStatus === 'saving' ? 'Lagrer til sky...' :
                         syncStatus === 'connecting' ? 'Kobler til sky...' : 'Lokal modus')}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Clean Action Buttons */}
          <div className="flex items-center gap-2">
            {onOpenSessionPlanner && (
              <button
                onClick={onOpenSessionPlanner}
                id="btn-session-planner"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-800 hover:bg-emerald-100 transition-colors border border-emerald-200"
                title="Planlegg time og skriv ut oppgaver"
              >
                <Printer className="w-3.5 h-3.5 text-emerald-700" />
                <span>Planlegg time</span>
              </button>
            )}

            <button
              onClick={onOpenNewStudent}
              id="btn-add-student"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Ny elev</span>
            </button>

            <button
              onClick={onOpenBackup}
              id="btn-backup"
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-stone-100 rounded-lg transition-colors ml-1"
              title="Sikkerhetskopi og data"
            >
              <DatabaseBackup className="w-4 h-4" />
            </button>

            {/* Authenticated User Badge & Logout */}
            {currentUser && (
              <div className="flex items-center gap-2 pl-2 border-l border-stone-200 ml-1">
                <div 
                  className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-stone-50 border border-stone-200 text-xs"
                  title={`Innlogget som ${currentUser.email}`}
                >
                  <div className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] font-bold">
                    {currentUser.displayName ? currentUser.displayName[0].toUpperCase() : 'U'}
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="font-semibold text-slate-900 text-xs leading-none">
                      {currentUser.displayName || currentUser.email}
                    </span>
                    {currentUser.role === 'primary_owner' && (
                      <span className="text-[10px] text-emerald-700 font-medium">Hovedadministrator</span>
                    )}
                  </div>
                </div>

                {onLogout && (
                  <button
                    onClick={onLogout}
                    id="btn-logout"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg text-slate-600 hover:text-red-700 hover:bg-red-50 border border-stone-200 hover:border-red-200 transition-colors"
                    title="Logg ut av portalen"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Logg ut</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Clean, Spacious Navigation Tabs */}
        <div className="flex items-center gap-1 border-t border-stone-100 pt-1.5 pb-2 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('oversikt')}
            id="tab-oversikt"
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors flex items-center gap-2 ${
              activeTab === 'oversikt'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-stone-100'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5 text-emerald-400" />
            Oversikt
          </button>

          <button
            onClick={() => setActiveTab('matrise')}
            id="tab-matrise"
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors flex items-center gap-2 ${
              activeTab === 'matrise'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-stone-100'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Gjennomgangsmatrise
          </button>

          <button
            onClick={() => setActiveTab('elever')}
            id="tab-elever"
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors flex items-center gap-2 ${
              activeTab === 'elever'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-stone-100'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Elever ({totalStudents})
          </button>

          <button
            onClick={() => setActiveTab('timer')}
            id="tab-timer"
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors flex items-center gap-2 ${
              activeTab === 'timer'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-stone-100'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 text-emerald-400" />
            Veiledningstimer ({totalSessions})
          </button>

          <button
            onClick={() => setActiveTab('materiell')}
            id="tab-materiell"
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors flex items-center gap-2 ${
              activeTab === 'materiell'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-stone-100'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            Fag- og materialbank ({totalMaterials})
          </button>
        </div>
      </div>
    </header>
  );
};
