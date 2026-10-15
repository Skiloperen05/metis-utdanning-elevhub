import React, { useRef, useState } from 'react';
import { X, Download, Upload, Cloud } from 'lucide-react';
import type { AppDatabase } from '../types';
import { exportDatabaseAsJson, importDatabaseFromJson } from '../lib/storage';

interface Props {
  db: AppDatabase;
  onClose: () => void;
  onReloadDatabase: (db: AppDatabase) => Promise<void>;
  onSyncToCloud: () => Promise<void>;
  syncStatus?: 'connecting' | 'synced' | 'saving' | 'offline';
}
export function BackupModal({ db, onClose, onReloadDatabase, onSyncToCloud, syncStatus }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  async function run(task: () => Promise<void>, success: string) {
    setBusy(true); setError(''); setMessage('');
    try { await task(); setMessage(success); }
    catch (err) { setError(err instanceof Error ? err.message : 'Overføringen mislyktes.'); }
    finally { setBusy(false); if (input.current) input.current.value = ''; }
  }
  return <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="backup-title">
    <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-xl">
      <div className="flex justify-between items-center"><h2 id="backup-title" className="text-lg font-bold">Database og sikkerhetskopi</h2><button aria-label="Lukk" onClick={onClose}><X /></button></div>
      <p className="text-sm text-slate-600 mt-4">Arbeidsområdet ditt er koblet til Tutoring Assistant. {syncStatus === 'synced' ? 'Siste overføring er bekreftet.' : 'Sjekk tilkoblingen før du lukker siden.'}</p>
      <p className="text-sm text-slate-600 mt-2">For å flytte data fra AI Studio: last ned en JSON-sikkerhetskopi der og importer den her. Bruk den samme e-postadressen.</p>
      {error && <p role="alert" className="mt-4 p-3 bg-red-50 text-red-800 rounded-lg text-sm">{error}</p>}
      {message && <p role="status" className="mt-4 p-3 bg-emerald-50 text-emerald-900 rounded-lg text-sm">{message}</p>}
      <div className="mt-6 space-y-3">
        <button disabled={busy} onClick={() => exportDatabaseAsJson(db)} className="w-full border rounded-lg px-4 py-3 flex items-center gap-3"><Download className="w-5 h-5" />Last ned sikkerhetskopi</button>
        <button disabled={busy} onClick={() => input.current?.click()} className="w-full border rounded-lg px-4 py-3 flex items-center gap-3"><Upload className="w-5 h-5" />Importer sikkerhetskopi</button>
        <input ref={input} type="file" accept=".json,application/json" className="hidden" onChange={e => {
          const file = e.target.files?.[0];
          if (file) void run(async () => { await onReloadDatabase(await importDatabaseFromJson(file)); }, 'Sikkerhetskopien er overført til ditt arbeidsområde.');
        }} />
        <button disabled={busy} onClick={() => void run(onSyncToCloud, 'Dataene er lagret i Supabase.')} className="w-full bg-slate-900 text-white rounded-lg px-4 py-3 flex items-center gap-3 disabled:opacity-50"><Cloud className="w-5 h-5" />{busy ? 'Overfører …' : 'Overfør lokale endringer til skyen'}</button>
      </div>
    </div>
  </div>;
}
