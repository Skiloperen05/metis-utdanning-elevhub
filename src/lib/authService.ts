import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { auth } from './firebase';
import { AppUser } from '../types';

export const PRIMARY_USER_EMAIL = 'birkhaugnes@gmail.com';
export const PRIMARY_USER_PASSWORD = '***REMOVED***';

const SESSION_STORAGE_KEY = 'metis_active_auth_user_v1';
const LOCAL_ACCOUNTS_KEY = 'metis_registered_accounts_v1';

interface StoredAccount {
  email: string;
  passwordHash: string;
  displayName: string;
  createdAt: string;
}

// In-memory or local store for fallback authentication if Firebase Email/Password provider is restricted
function getStoredAccounts(): StoredAccount[] {
  try {
    const raw = localStorage.getItem(LOCAL_ACCOUNTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveAccount(account: StoredAccount): void {
  try {
    const accounts = getStoredAccounts().filter((a) => a.email.toLowerCase() !== account.email.toLowerCase());
    accounts.push(account);
    localStorage.setItem(LOCAL_ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch (err) {
    console.warn('Failed to save account locally:', err);
  }
}

export function getStoredActiveUser(): AppUser | null {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setStoredActiveUser(user: AppUser | null): void {
  try {
    if (user) {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  } catch (err) {
    console.warn('Failed to update active user storage:', err);
  }
}

/**
 * Maps a Firebase user or custom user profile to AppUser
 */
function mapToAppUser(firebaseUser: FirebaseUser | null, fallbackEmail?: string, fallbackName?: string): AppUser {
  const email = (firebaseUser?.email || fallbackEmail || '').trim().toLowerCase();
  const isPrimary = email === PRIMARY_USER_EMAIL.toLowerCase();

  return {
    uid: firebaseUser?.uid || `local-${email}`,
    email,
    displayName: firebaseUser?.displayName || fallbackName || (isPrimary ? 'Birk Haugnes' : email.split('@')[0]),
    role: isPrimary ? 'primary_owner' : 'teacher',
  };
}

/**
 * Sign in with email and password
 */
export async function loginWithEmail(emailInput: string, passwordInput: string): Promise<AppUser> {
  const email = emailInput.trim().toLowerCase();
  const password = passwordInput.trim();

  // 1. Check primary owner credentials
  const isPrimary = email === PRIMARY_USER_EMAIL.toLowerCase();
  if (isPrimary && password === PRIMARY_USER_PASSWORD) {
    // Attempt Firebase sign in or creation in parallel
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const appUser = mapToAppUser(cred.user, email, 'Birk Haugnes');
      setStoredActiveUser(appUser);
      return appUser;
    } catch {
      // If Firebase email signin fails (e.g. user not created yet in Firebase Auth or provider disabled),
      // try creating user in Firebase Auth once
      try {
        const newCred = await createUserWithEmailAndPassword(auth, email, password);
        const appUser = mapToAppUser(newCred.user, email, 'Birk Haugnes');
        setStoredActiveUser(appUser);
        return appUser;
      } catch {
        // Fallback to verified local credentials for primary user
        const appUser: AppUser = {
          uid: 'owner-birk-haugnes',
          email: PRIMARY_USER_EMAIL,
          displayName: 'Birk Haugnes',
          role: 'primary_owner',
        };
        setStoredActiveUser(appUser);
        return appUser;
      }
    }
  }

  // 2. Standard Firebase Auth attempt
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const appUser = mapToAppUser(cred.user, email);
    setStoredActiveUser(appUser);
    return appUser;
  } catch (firebaseErr: unknown) {
    // Check local fallback accounts if Firebase email auth is not enabled
    const accounts = getStoredAccounts();
    const match = accounts.find((a) => a.email.toLowerCase() === email && a.passwordHash === password);
    if (match) {
      const appUser: AppUser = {
        uid: `local-${match.email}`,
        email: match.email,
        displayName: match.displayName,
        role: 'teacher',
      };
      setStoredActiveUser(appUser);
      return appUser;
    }

    const errMsg = firebaseErr instanceof Error ? firebaseErr.message : 'Feil ved innlogging';
    if (errMsg.includes('user-not-found') || errMsg.includes('invalid-credential')) {
      throw new Error('Feil brukernavn eller passord.');
    }
    throw new Error('Kunne ikke logge inn. Sjekk brukernavn og passord.');
  }
}

/**
 * Register a new user account
 */
export async function registerNewUser(displayName: string, emailInput: string, passwordInput: string): Promise<AppUser> {
  const email = emailInput.trim().toLowerCase();
  const password = passwordInput.trim();
  const name = displayName.trim() || email.split('@')[0];

  if (!email || !email.includes('@')) {
    throw new Error('Vennligst oppgi en gyldig e-postadresse.');
  }
  if (!password || password.length < 6) {
    throw new Error('Passordet må bestå av minst 6 tegn.');
  }

  // Attempt Firebase Auth account creation
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const appUser = mapToAppUser(cred.user, email, name);
    // Also backup in local accounts registry
    saveAccount({
      email,
      passwordHash: password,
      displayName: name,
      createdAt: new Date().toISOString(),
    });
    setStoredActiveUser(appUser);
    return appUser;
  } catch (firebaseErr: unknown) {
    // If Firebase email provider is not enabled in Firebase Console, fallback to verified local registry
    saveAccount({
      email,
      passwordHash: password,
      displayName: name,
      createdAt: new Date().toISOString(),
    });
    const appUser: AppUser = {
      uid: `local-${email}`,
      email,
      displayName: name,
      role: 'teacher',
    };
    setStoredActiveUser(appUser);
    return appUser;
  }
}

/**
 * Google Sign-In popup
 */
export async function loginWithGoogle(): Promise<AppUser> {
  const provider = new GoogleAuthProvider();
  try {
    const cred = await signInWithPopup(auth, provider);
    const appUser = mapToAppUser(cred.user);
    setStoredActiveUser(appUser);
    return appUser;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Google Sign-In error:', msg);
    throw new Error('Kunne ikke logge inn med Google.');
  }
}

/**
 * Sign out
 */
export async function logoutUser(): Promise<void> {
  setStoredActiveUser(null);
  try {
    await signOut(auth);
  } catch {
    // Ignore signout error
  }
}

/**
 * Subscribe to auth status changes
 */
export function subscribeToAuth(callback: (user: AppUser | null) => void): () => void {
  // First notify with stored user if exists
  const initial = getStoredActiveUser();
  if (initial) {
    callback(initial);
  }

  // Listen to Firebase auth changes
  const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
    if (fbUser && fbUser.email) {
      const user = mapToAppUser(fbUser);
      setStoredActiveUser(user);
      callback(user);
    } else {
      // If Firebase reports null but we have a valid local session (e.g. local fallback), retain it
      const currentStored = getStoredActiveUser();
      if (!currentStored) {
        callback(null);
      }
    }
  });

  return unsubscribe;
}
