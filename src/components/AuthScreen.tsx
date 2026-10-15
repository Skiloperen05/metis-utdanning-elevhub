import React, { useState } from 'react';
import { GraduationCap, ArrowRight, AlertCircle } from 'lucide-react';
import { loginWithEmail, registerNewUser, confirmEmailLink } from '../lib/authService';
import type { AppUser } from '../types';

export function AuthScreen({ onAuthenticated }: { onAuthenticated: (user: AppUser) => void }) {
  const [mode, setMode] = useState<'login' | 'register' | 'confirm'>('login');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [link, setLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setError(''); setMessage(''); setLoading(true);
    try {
      if (mode === 'confirm') onAuthenticated(await confirmEmailLink(link));
      else if (mode === 'login') onAuthenticated(await loginWithEmail(email, password));
      else {
        const user = await registerNewUser(name, email, password);
        if (user) onAuthenticated(user);
        else {
          setMode('confirm'); setPassword('');
          setMessage('Sjekk innboksen din. Kopier bekreftelseslenken fra e-posten og lim den inn her, eller åpne lenken og gå tilbake hit for å logge inn.');
        }
      }
    } catch (err) { setError(err instanceof Error ? err.message : 'Kunne ikke logge inn. Prøv igjen.'); }
    finally { setLoading(false); }
  }
  function changeMode(next: typeof mode) { setMode(next); setError(''); setMessage(''); setPassword(''); }
  const inputClass = 'w-full mt-1.5 rounded-lg border border-stone-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600';
  return (
    <main className="min-h-screen bg-stone-100 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-7">
          <div className="inline-flex p-4 bg-slate-900 rounded-2xl mb-4"><GraduationCap className="w-8 h-8 text-emerald-400" /></div>
          <h1 className="text-2xl font-bold text-slate-900">Metis Utdanning</h1>
          <p className="text-slate-500 mt-1">Elevhub & veiledningsportal</p>
        </div>
        <section className="bg-white rounded-2xl border border-stone-200 p-6 shadow-sm">
          <h2 className="font-semibold text-lg text-slate-900">{mode === 'login' ? 'Logg inn' : mode === 'register' ? 'Opprett konto' : 'Bekreft e-post'}</h2>
          <p className="text-sm text-slate-500 mt-2 mb-5">Logg inn for å se dine elever, fag og veiledningstimer.</p>
          {error && <div role="alert" className="mb-4 p-3 bg-red-50 text-red-800 rounded-lg text-sm flex gap-2"><AlertCircle className="w-5 h-5 shrink-0" />{error}</div>}
          {message && <p role="status" className="mb-4 p-3 bg-emerald-50 text-emerald-900 rounded-lg text-sm">{message}</p>}
          <form onSubmit={submit} className="space-y-4">
            {mode === 'confirm' ? <label className="block text-sm font-medium text-slate-700" htmlFor="confirmation">Bekreftelseslenke<textarea id="confirmation" required value={link} onChange={e => setLink(e.target.value)} className={inputClass} rows={4} placeholder="Lim inn lenken fra e-posten" /></label> : <>
              {mode === 'register' && <label className="block text-sm font-medium text-slate-700" htmlFor="name">Ditt navn<input id="name" required autoComplete="name" value={name} onChange={e => setName(e.target.value)} className={inputClass} /></label>}
              <label className="block text-sm font-medium text-slate-700" htmlFor="email">E-post<input id="email" type="email" required autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} className={inputClass} /></label>
              <label className="block text-sm font-medium text-slate-700" htmlFor="password">Passord<input id="password" type="password" required minLength={mode === 'register' ? 12 : undefined} autoComplete={mode === 'register' ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)} className={inputClass} /></label>
              {mode === 'register' && <p className="text-xs text-slate-500">Bruk minst 12 tegn. Du får et eget arbeidsområde og må bekrefte e-postadressen.</p>}
            </>}
            <button disabled={loading} className="w-full rounded-lg bg-slate-900 text-white py-3 font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
              {loading ? 'Vennligst vent …' : mode === 'login' ? 'Logg inn' : mode === 'register' ? 'Opprett konto' : 'Bekreft og logg inn'}<ArrowRight className="w-4 h-4" />
            </button>
          </form>
          <div className="mt-5 flex flex-wrap justify-center gap-x-4 gap-y-2 text-sm">
            <button className="text-emerald-700 underline" onClick={() => changeMode(mode === 'login' ? 'register' : 'login')}>{mode === 'login' ? 'Opprett konto' : 'Til innlogging'}</button>
            {mode !== 'confirm' && <button className="text-slate-600 underline" onClick={() => changeMode('confirm')}>Har en bekreftelseslenke</button>}
          </div>
        </section>
        <p className="text-center text-xs text-slate-500 mt-5">Metis Utdanning Elevhub</p>
      </div>
    </main>
  );
}
