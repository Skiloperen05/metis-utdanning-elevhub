import React, { useState } from 'react';
import { 
  GraduationCap, 
  Lock, 
  Mail, 
  KeyRound, 
  User, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  ArrowRight, 
  Sparkles,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { 
  loginWithEmail, 
  registerNewUser, 
  loginWithGoogle, 
  PRIMARY_USER_EMAIL, 
  PRIMARY_USER_PASSWORD 
} from '../lib/authService';
import { AppUser } from '../types';

interface AuthScreenProps {
  onAuthenticated: (user: AppUser) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthenticated }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleQuickFillPrimary = () => {
    setEmail(PRIMARY_USER_EMAIL);
    setPassword(PRIMARY_USER_PASSWORD);
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        if (!email.trim() || !password.trim()) {
          throw new Error('Vennligst fyll ut både e-post og passord.');
        }
        const user = await loginWithEmail(email, password);
        onAuthenticated(user);
      } else {
        if (!displayName.trim()) {
          throw new Error('Vennligst oppgi navnet ditt.');
        }
        if (!email.trim() || !email.includes('@')) {
          throw new Error('Vennligst oppgi en gyldig e-postadresse.');
        }
        if (password.length < 6) {
          throw new Error('Passordet må ha minst 6 tegn.');
        }
        if (password !== confirmPassword) {
          throw new Error('Passordene er ikke like.');
        }
        const user = await registerNewUser(displayName, email, password);
        onAuthenticated(user);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'En feil oppstod ved innlogging.';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setErrorMessage(null);
    setLoading(true);
    try {
      const user = await loginWithGoogle();
      onAuthenticated(user);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Google-pålogging mislyktes.';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-100 flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8">
      {/* Brand Header */}
      <div className="w-full max-w-md mb-6 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-900 text-white shadow-md mb-3 border border-slate-800">
          <GraduationCap className="w-7 h-7 text-emerald-400" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Metis Utdanning
        </h1>
        <p className="text-sm font-medium text-slate-500 mt-1">
          Elevhub & Veiledningsportal
        </p>
      </div>

      {/* Security Banner */}
      <div className="w-full max-w-md bg-amber-50/90 border border-amber-200/80 rounded-xl p-3.5 mb-5 flex items-start gap-3 shadow-2xs">
        <div className="p-1 rounded-lg bg-amber-100 text-amber-800 shrink-0 mt-0.5">
          <ShieldCheck className="w-4 h-4 text-amber-700" />
        </div>
        <div className="text-xs text-amber-900 leading-relaxed">
          <p className="font-semibold text-amber-950">Skjermet for personsensitiv elevdata</p>
          <p className="mt-0.5 text-amber-800/90">
            For å overholde personvernkrav er elever, vurderinger og notater lagret bak en sikker brukermur.
          </p>
        </div>
      </div>

      {/* Main Authentication Card */}
      <div className="w-full max-w-md bg-white border border-stone-200/80 rounded-2xl shadow-sm overflow-hidden">
        {/* Tab Switcher */}
        <div className="grid grid-cols-2 border-b border-stone-200 bg-stone-50/70 p-1.5 gap-1.5 text-xs font-semibold">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setErrorMessage(null);
            }}
            id="tab-btn-login"
            className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              mode === 'login'
                ? 'bg-white text-slate-900 shadow-2xs border border-stone-200/80'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Lock className="w-3.5 h-3.5 text-emerald-600" />
            <span>Logg inn</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMode('register');
              setErrorMessage(null);
            }}
            id="tab-btn-register"
            className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              mode === 'register'
                ? 'bg-white text-slate-900 shadow-2xs border border-stone-200/80'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <User className="w-3.5 h-3.5 text-emerald-600" />
            <span>Opprett ny konto</span>
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6">
          {errorMessage && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-700 animate-fadeIn">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Ditt navn / Lærer
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="f.eks. Kari Nordmann"
                    className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition-all text-slate-900 placeholder-slate-400"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Brukernavn / E-post
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="f.eks. birkhaugnes@gmail.com"
                  className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition-all text-slate-900 placeholder-slate-400"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Passord
                </label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={handleQuickFillPrimary}
                    className="text-[11px] font-medium text-emerald-700 hover:text-emerald-800 transition-colors"
                  >
                    Fyll inn Birk (Hovedbruker)
                  </button>
                )}
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Skriv passord"
                  className="w-full pl-9 pr-10 py-2 text-sm bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition-all text-slate-900 placeholder-slate-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {mode === 'register' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Bekreft passord
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Gjenta passord"
                    className="w-full pl-9 pr-10 py-2 text-sm bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition-all text-slate-900 placeholder-slate-400"
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-slate-500">
                  Nye brukere får sitt eget separate arbeidsområde og kan ikke se andre læreres elever.
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              id="btn-auth-submit"
              className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>{mode === 'login' ? 'Logg inn' : 'Opprett konto'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Primary User Shortcut Box */}
          {mode === 'login' && (
            <div className="mt-5 pt-4 border-t border-stone-100">
              <div className="bg-stone-50 rounded-xl p-3 border border-stone-200/70">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs font-bold">
                      B
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-900">Birk Haugnes</p>
                      <p className="text-[11px] text-slate-500">birkhaugnes@gmail.com</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleQuickFillPrimary}
                    className="px-2.5 py-1 text-xs font-semibold rounded-md bg-white border border-stone-300 text-slate-700 hover:bg-stone-100 transition-colors shadow-2xs"
                  >
                    Velg bruker
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Google Sign-in */}
          <div className="mt-4 pt-4 border-t border-stone-100">
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full py-2 px-3 border border-stone-300 hover:bg-stone-50 rounded-lg text-xs font-semibold text-slate-700 flex items-center justify-center gap-2 transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Fortsett med Google</span>
            </button>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="mt-8 text-center text-xs text-slate-400">
        <p>Metis Utdanning Elevhub &bull; Kryptert og sikkert lagret</p>
      </div>
    </div>
  );
};
