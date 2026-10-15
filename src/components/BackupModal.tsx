import React, { useRef, useState, useEffect } from 'react';
import { 
  X, Download, Upload, RotateCcw, ShieldCheck, Database, Check, AlertCircle, 
  Cloud, RefreshCw, Trash2, Key, Server, Copy, CheckCheck, ExternalLink 
} from 'lucide-react';
import { AppDatabase } from '../types';
import { exportDatabaseAsJson, importDatabaseFromJson, resetDatabaseToDefault } from '../lib/storage';
import { 
  getStoredSupabaseConfig, 
  saveStoredSupabaseConfig, 
  clearStoredSupabaseConfig, 
  SupabaseSyncService 
} from '../lib/supabase';

interface BackupModalProps {
  db: AppDatabase;
  onClose: () => void;
  onReloadDatabase: (newDb: AppDatabase) => void;
  onSyncToCloud?: () => Promise<void>;
  onClearAllData?: () => Promise<void>;
  syncStatus?: 'connecting' | 'synced' | 'saving' | 'offline';
}

const SUPABASE_SQL_SCRIPT = `-- ============================================================
-- SQL SCHEMA FOR METIS UTDANNING ELEVHUB I SUPABASE
-- Kjør denne i Supabase SQL Editor (SQL Editor -> New query -> Run)
-- ============================================================

-- Fjern eventuelle eksisterende mal-tabeller for å unngå typekonflikter (f.eks. uuid vs text)
DROP TABLE IF EXISTS public.assignments CASCADE;
DROP TABLE IF EXISTS public.sessions CASCADE;
DROP TABLE IF EXISTS public.materials CASCADE;
DROP TABLE IF EXISTS public.students CASCADE;
DROP TABLE IF EXISTS public.subjects CASCADE;

CREATE TABLE public.subjects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  color TEXT DEFAULT '#0f172a',
  grade_level TEXT,
  description TEXT,
  owner_email TEXT DEFAULT 'birkhaugnes@gmail.com',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE public.students (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  active_subject_ids JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  status TEXT DEFAULT 'aktiv',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  owner_email TEXT DEFAULT 'birkhaugnes@gmail.com'
);

CREATE TABLE public.materials (
  id TEXT PRIMARY KEY,
  subject_id TEXT REFERENCES public.subjects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT DEFAULT 'oppgave',
  description TEXT,
  topic TEXT,
  curriculum_goals JSONB DEFAULT '[]'::jsonb,
  files JSONB DEFAULT '[]'::jsonb,
  external_links JSONB DEFAULT '[]'::jsonb,
  is_exam_relevant BOOLEAN DEFAULT false,
  grade_level TEXT,
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  owner_email TEXT DEFAULT 'birkhaugnes@gmail.com'
);

CREATE TABLE public.assignments (
  id TEXT PRIMARY KEY,
  student_id TEXT REFERENCES public.students(id) ON DELETE CASCADE,
  material_id TEXT REFERENCES public.materials(id) ON DELETE CASCADE,
  assigned_date TEXT,
  due_date TEXT,
  completed_date TEXT,
  status TEXT DEFAULT 'ikke_tildelt',
  score TEXT,
  notes TEXT,
  feedback TEXT,
  owner_email TEXT DEFAULT 'birkhaugnes@gmail.com',
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE public.sessions (
  id TEXT PRIMARY KEY,
  student_id TEXT REFERENCES public.students(id) ON DELETE SET NULL,
  student_name TEXT,
  subject_id TEXT,
  subject_name TEXT,
  date TEXT NOT NULL,
  time TEXT,
  duration_minutes INTEGER DEFAULT 60,
  planned_topics TEXT,
  completed_topics TEXT,
  next_steps TEXT,
  teacher_notes TEXT,
  owner_email TEXT DEFAULT 'birkhaugnes@gmail.com',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS og offentlig tilgang via anon key
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public full access on subjects" ON public.subjects;
CREATE POLICY "Allow public full access on subjects" ON public.subjects FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public full access on students" ON public.students;
CREATE POLICY "Allow public full access on students" ON public.students FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public full access on materials" ON public.materials;
CREATE POLICY "Allow public full access on materials" ON public.materials FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public full access on assignments" ON public.assignments;
CREATE POLICY "Allow public full access on assignments" ON public.assignments FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public full access on sessions" ON public.sessions;
CREATE POLICY "Allow public full access on sessions" ON public.sessions FOR ALL USING (true) WITH CHECK (true);

-- Sanntid uten duplikatfeil
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY['subjects', 'students', 'materials', 'assignments', 'sessions'])
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND tablename = tbl
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
    END IF;
  END LOOP;
END $$;
`;

export const BackupModal: React.FC<BackupModalProps> = ({
  db,
  onClose,
  onReloadDatabase,
  onSyncToCloud,
  onClearAllData,
  syncStatus = 'synced',
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<'supabase' | 'cloud' | 'backup'>('supabase');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isCopiedSql, setIsCopiedSql] = useState(false);

  // Supabase input state
  const existingConfig = getStoredSupabaseConfig();
  const [supabaseUrl, setSupabaseUrl] = useState(existingConfig?.url || '');
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(existingConfig?.key || '');
  const [supabaseConnected, setSupabaseConnected] = useState(Boolean(existingConfig));

  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SCRIPT);
    setIsCopiedSql(true);
    setTimeout(() => setIsCopiedSql(false), 3000);
  };

  const handleConnectSupabase = async () => {
    if (!supabaseUrl.trim() || !supabaseAnonKey.trim()) {
      setErrorMsg('Vennligst oppgi både Supabase Project URL og Anon API Key.');
      return;
    }

    try {
      setIsSyncing(true);
      setErrorMsg(null);
      setSuccessMsg(null);

      // Save to localStorage
      saveStoredSupabaseConfig(supabaseUrl, supabaseAnonKey);

      const service = SupabaseSyncService.getInstance();
      const test = await service.testConnection();

      if (!test.ok) {
        throw new Error(
          test.error?.includes('relation') || test.error?.includes('does not exist')
            ? 'Tabellene eksisterer ikke i Supabase ennå. Vennligst kjør SQL-skriptet under i Supabase SQL Editor først!'
            : test.error || 'Kunne ikke koble til Supabase.'
        );
      }

      // Overfør alle data
      await service.importFullDatabase(db);
      setSupabaseConnected(true);
      setSuccessMsg('🎉 Vellykket! Koblet til Supabase og overførte alle elever, fag, oppgaver og timer!');
    } catch (err: any) {
      setErrorMsg(err.message || String(err));
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDisconnectSupabase = () => {
    clearStoredSupabaseConfig();
    setSupabaseUrl('');
    setSupabaseAnonKey('');
    setSupabaseConnected(false);
    setSuccessMsg('Supabase er koblet fra. Appen bruker nå standard skydatabase.');
  };

  const handleCloudSync = async () => {
    if (!onSyncToCloud) return;
    try {
      setIsSyncing(true);
      await onSyncToCloud();
      setSuccessMsg('Alle data (elever, fag, oppgaver og notater) er nå synkronisert til skyen!');
      setErrorMsg(null);
    } catch (e: any) {
      setErrorMsg('Kunne ikke synkronisere til skyen: ' + (e.message || String(e)));
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExport = () => {
    try {
      exportDatabaseAsJson(db);
      setSuccessMsg('Sikkerhetskopi er lastet ned til datamaskinen din.');
      setErrorMsg(null);
    } catch (e) {
      setErrorMsg('Kunne ikke eksportere data.');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const imported = await importDatabaseFromJson(file);
      onReloadDatabase(imported);
      if (onSyncToCloud) {
        await onSyncToCloud();
      }
      setSuccessMsg(`Sikkerhetskopi importert og synkronisert! Lastet inn ${imported.students.length} elever og ${imported.materials.length} fagdeler.`);
      setErrorMsg(null);
    } catch (err: any) {
      setErrorMsg(err.message || 'Kunne ikke lese sikkerhetskopifilen.');
      setSuccessMsg(null);
    }
  };

  const handleClearAll = async () => {
    if (window.confirm('Er du sikker på at du vil slette alle elever, fag, oppgaver og fagdeler for å starte med blanke ark? Dette sletter også dataene i skyen.')) {
      try {
        if (onClearAllData) {
          await onClearAllData();
        } else {
          const reset = resetDatabaseToDefault();
          onReloadDatabase(reset);
        }
        setSuccessMsg('Alle placeholder-data er slettet. Du starter nå med en helt tom database.');
        setErrorMsg(null);
      } catch (err: any) {
        setErrorMsg('Feil ved sletting av data: ' + (err.message || String(err)));
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-xl w-full border border-stone-200 shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="bg-stone-50 border-b border-stone-200 p-4 sm:p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Database & Skylagring</h3>
              <p className="text-xs text-slate-500">
                Koble til Supabase, synkroniser data og ta sikkerhetskopi
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-stone-200 px-5 pt-3 gap-2 bg-stone-50/50">
          <button
            onClick={() => setActiveTab('supabase')}
            className={`pb-2.5 text-xs font-semibold px-3 border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'supabase'
                ? 'border-emerald-600 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            Supabase Integrasjon
          </button>
          <button
            onClick={() => setActiveTab('backup')}
            className={`pb-2.5 text-xs font-semibold px-3 border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'backup'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            Sikkerhetskopi & Nullstilling
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 space-y-4 text-xs overflow-y-auto">
          
          {successMsg && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-3 rounded-xl text-xs flex items-center gap-2.5">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-xl text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {activeTab === 'supabase' && (
            <div className="space-y-4">
              {/* Status Header */}
              <div className={`p-4 rounded-xl border flex items-start gap-3 ${
                supabaseConnected 
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-stone-50 border-stone-200 text-slate-800'
              }`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  supabaseConnected ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-200 text-slate-600'
                }`}>
                  <Server className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-xs">
                      {supabaseConnected ? 'Koblet til Supabase' : 'Koble appen til Supabase'}
                    </p>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                      supabaseConnected ? 'bg-emerald-200 text-emerald-800' : 'bg-stone-200 text-slate-700'
                    }`}>
                      {supabaseConnected ? 'Aktiv' : 'Klar'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                    Legg inn prosjektadressen og API-nøkkelen fra Supabase-prosjektet ditt for å overføre og lagre alle elever, fag og planer direkte i din PostgreSQL-database.
                  </p>
                </div>
              </div>

              {/* Step 1: SQL Schema */}
              <div className="border border-stone-200 rounded-xl p-3.5 bg-stone-50/70">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h4 className="font-semibold text-slate-900 text-xs">Steg 1: Opprett tabeller i Supabase</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Kopier SQL-koden og kjør den én gang i Supabase SQL Editor.
                    </p>
                  </div>
                  <button
                    onClick={handleCopySql}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-stone-300 text-slate-800 hover:bg-stone-100 transition-colors shrink-0 shadow-2xs"
                  >
                    {isCopiedSql ? (
                      <>
                        <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700">Kopiert!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-slate-600" />
                        <span>Kopier SQL</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Step 2: Credentials Input */}
              <div className="border border-stone-200 rounded-xl p-3.5 space-y-3 bg-white">
                <h4 className="font-semibold text-slate-900 text-xs">Steg 2: Fyll inn Supabase-nøkler</h4>
                
                <div>
                  <label className="block text-[11px] font-medium text-slate-700 mb-1">
                    Supabase Project URL
                  </label>
                  <input
                    type="text"
                    value={supabaseUrl}
                    onChange={(e) => setSupabaseUrl(e.target.value)}
                    placeholder="https://xyzcompany.supabase.co"
                    className="w-full px-3 py-1.5 rounded-lg border border-stone-300 text-xs focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                  />
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Fra Supabase: <em>Project Settings ➜ API ➜ Project URL</em>
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-700 mb-1">
                    Supabase Anon / Public API Key
                  </label>
                  <input
                    type="password"
                    value={supabaseAnonKey}
                    onChange={(e) => setSupabaseAnonKey(e.target.value)}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    className="w-full px-3 py-1.5 rounded-lg border border-stone-300 text-xs focus:ring-2 focus:ring-slate-900 focus:outline-hidden"
                  />
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Fra Supabase: <em>Project Settings ➜ API ➜ Project API keys (anon public)</em>
                  </p>
                </div>

                <div className="pt-2 flex items-center justify-between gap-2 border-t border-stone-100">
                  {supabaseConnected && (
                    <button
                      onClick={handleDisconnectSupabase}
                      className="text-xs text-rose-600 hover:text-rose-800 font-medium"
                    >
                      Koble fra Supabase
                    </button>
                  )}
                  <button
                    onClick={handleConnectSupabase}
                    disabled={isSyncing}
                    className="ml-auto inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 transition-colors shadow-2xs disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span>{isSyncing ? 'Kobler til & overfører...' : 'Koble til & overfør all data'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'backup' && (
            <div className="space-y-3">
              {/* Export */}
              <div className="p-3.5 rounded-xl border border-stone-200 bg-stone-50/50 flex items-center justify-between gap-3">
                <div>
                  <h4 className="font-semibold text-slate-900">Eksporter sikkerhetskopi (JSON)</h4>
                  <p className="text-[11px] text-slate-500">
                    Last ned en komplett kopi av alle elever, notater og fagmateriell.
                  </p>
                </div>
                <button
                  onClick={handleExport}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white font-medium hover:bg-slate-800 shrink-0 shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  Last ned
                </button>
              </div>

              {/* Import */}
              <div className="p-3.5 rounded-xl border border-stone-200 bg-stone-50/50 flex items-center justify-between gap-3">
                <div>
                  <h4 className="font-semibold text-slate-900">Gjenopprett fra fil</h4>
                  <p className="text-[11px] text-slate-500">
                    Last opp en tidligere eksportert sikkerhetskopi.
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-stone-300 text-slate-700 font-medium hover:bg-stone-100 shrink-0"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Velg fil
                </button>
              </div>

              {/* Reset to defaults / Clear all data */}
              <div className="p-3.5 rounded-xl border border-rose-100 bg-rose-50/30 flex items-center justify-between gap-3">
                <div>
                  <h4 className="font-semibold text-slate-900">Slett all data (start med blanke ark)</h4>
                  <p className="text-[11px] text-slate-500">
                    Slett alle placeholder-elever, fag og oppgaver så du kan legge inn dine egne data.
                  </p>
                </div>
                <button
                  onClick={handleClearAll}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-rose-200 text-rose-700 font-medium hover:bg-rose-50 shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Tøm alt
                </button>
              </div>
            </div>
          )}

          <div className="pt-2 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-slate-900 text-white font-medium hover:bg-slate-800 text-xs"
            >
              Lukk
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
