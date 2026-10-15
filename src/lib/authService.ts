import type { User } from '@supabase/supabase-js';
import { requireSupabaseClient } from './supabase';
import type { AppUser } from '../types';
import { SUPABASE_URL } from './publicConfig';

export const PRIMARY_USER_EMAIL = 'birkhaugnes@gmail.com';

function mapUser(user: User): AppUser {
  const email = (user.email || '').toLowerCase();
  return { uid: user.id, email, displayName: user.user_metadata?.display_name || email.split('@')[0],
    role: email === PRIMARY_USER_EMAIL ? 'primary_owner' : 'teacher' };
}

function authError(error: { message: string; code?: string }): Error {
  if (error.code === 'invalid_credentials') return new Error('Feil e-post eller passord.');
  if (error.code === 'otp_expired') return new Error('Lenken er allerede brukt eller har utløpt. Hvis du har åpnet lenken, gå til innlogging og logg inn med e-post og passord.');
  if (error.code === 'email_not_confirmed') return new Error('Bekreft e-postadressen før du logger inn.');
  if (error.code === 'over_email_send_rate_limit') return new Error('For mange e-poster er sendt. Vent litt før du prøver igjen.');
  return new Error(error.message);
}

export async function loginWithEmail(email: string, password: string): Promise<AppUser> {
  const { data, error } = await requireSupabaseClient().auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw authError(error);
  return mapUser(data.user);
}

export async function registerNewUser(displayName: string, email: string, password: string): Promise<AppUser | null> {
  if (password.length < 8) throw new Error('Passordet må ha minst 8 tegn.');
  const { data, error } = await requireSupabaseClient().auth.signUp({
    email: email.trim(), password,
    options: { data: { display_name: displayName.trim() }, emailRedirectTo: window.location.origin + window.location.pathname },
  });
  if (error) throw authError(error);
  return data.session && data.user ? mapUser(data.user) : null;
}

// Also works when an older redirect URL is still configured on the project.
export async function confirmEmailLink(link: string): Promise<AppUser> {
  let url: URL;
  try { url = new URL(link.trim()); } catch { throw new Error('Lim inn hele bekreftelseslenken fra e-posten.'); }
  const client = requireSupabaseClient();
  if (url.origin !== new URL(SUPABASE_URL).origin || url.pathname !== '/auth/v1/verify') {
    throw new Error('Lenken må være bekreftelseslenken fra Elevhub sin e-post.');
  }
  const token_hash = url.searchParams.get('token');
  if (!token_hash || url.searchParams.get('type') !== 'signup') throw new Error('Ugyldig bekreftelseslenke.');
  const { data, error } = await client.auth.verifyOtp({ token_hash, type: 'signup' });
  if (error) throw authError(error);
  if (!data.user) throw new Error('Kunne ikke bekrefte e-posten.');
  return mapUser(data.user);
}

export async function logoutUser(): Promise<void> {
  const { error } = await requireSupabaseClient().auth.signOut();
  if (error) throw authError(error);
}

export function subscribeToAuth(callback: (user: AppUser | null) => void): () => void {
  const client = requireSupabaseClient();
  let active = true;
  // Local login records never authorize access.
  localStorage.removeItem('metis_active_auth_user_v1');
  localStorage.removeItem('metis_registered_accounts_v1');
  const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
    if (active && event !== 'INITIAL_SESSION') callback(session?.user ? mapUser(session.user) : null);
  });
  client.auth.getUser().then(({ data, error }) => {
    if (active) callback(!error && data.user ? mapUser(data.user) : null);
  }).catch(() => { if (active) callback(null); });
  return () => { active = false; subscription.unsubscribe(); };
}
