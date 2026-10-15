import { AppDatabase, Student, Material, Subject, Assignment, AssignmentStatus } from '../types';
import { INITIAL_DATABASE } from '../data/initialData';

const STORAGE_KEY = 'metis_utdanning_hub_data_v2';
const MIGRATION_KEY = 'metis_utdanning_cleared_v2_done';
export const DEFAULT_PRIMARY_OWNER = 'birkhaugnes@gmail.com';

function ensureOwner<T extends { ownerEmail?: string }>(item: T): T {
  return {
    ...item,
    ownerEmail: item.ownerEmail || DEFAULT_PRIMARY_OWNER,
  };
}

export function loadDatabase(): AppDatabase {
  try {
    // Force one-time purge of old placeholder data from user's browser localStorage
    if (!localStorage.getItem(MIGRATION_KEY)) {
      localStorage.removeItem('metis_utdanning_hub_data_v1');
      localStorage.removeItem(STORAGE_KEY);
      localStorage.setItem(MIGRATION_KEY, 'true');
      saveDatabase(INITIAL_DATABASE);
      return INITIAL_DATABASE;
    }

    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      saveDatabase(INITIAL_DATABASE);
      return INITIAL_DATABASE;
    }
    const parsed = JSON.parse(raw) as AppDatabase;
    if (!parsed.students || !parsed.materials || !parsed.subjects || !parsed.assignments) {
      saveDatabase(INITIAL_DATABASE);
      return INITIAL_DATABASE;
    }
    if (!Array.isArray(parsed.sessions)) {
      parsed.sessions = [];
    }

    // Guarantee that all pre-existing records belong to the primary user
    parsed.students = parsed.students.map(ensureOwner);
    parsed.subjects = parsed.subjects.map(ensureOwner);
    parsed.materials = parsed.materials.map(ensureOwner);
    parsed.assignments = parsed.assignments.map(ensureOwner);
    parsed.sessions = parsed.sessions.map(ensureOwner);

    return parsed;
  } catch (err) {
    console.error('Error loading database from localStorage:', err);
    return INITIAL_DATABASE;
  }
}

// Helper to strip bulky file dataUrls when saving to localStorage so 5MB quota is never exceeded
function sanitizeForLocalStorage(db: AppDatabase): AppDatabase {
  return {
    ...db,
    materials: db.materials.map((mat) => {
      if (!mat.files || mat.files.length === 0) return mat;
      return {
        ...mat,
        files: mat.files.map((file) => {
          // If dataUrl is larger than 100KB, omit from localStorage (it is stored in IndexedDB)
          if (file.dataUrl && file.dataUrl.length > 100 * 1024) {
            return {
              ...file,
              dataUrl: '', // Will be hydrated from IndexedDB on load
            };
          }
          return file;
        }),
      };
    }),
  };
}

export function saveDatabase(db: AppDatabase): void {
  try {
    const updated = {
      ...sanitizeForLocalStorage(db),
      lastUpdated: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('Error saving full database to localStorage, attempting aggressive strip:', err);
    try {
      // In case quota is still tight, strip all file dataUrls from localStorage
      const stripped: AppDatabase = {
        ...db,
        materials: db.materials.map((mat) => ({
          ...mat,
          files: (mat.files || []).map((f) => ({ ...f, dataUrl: '' })),
        })),
        lastUpdated: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stripped));
    } catch (e2) {
      console.error('Fatal error saving database to localStorage:', e2);
    }
  }
}

export function exportDatabaseAsJson(db: AppDatabase): void {
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(db, null, 2));
  const downloadAnchor = document.createElement('a');
  const dateStr = new Date().toISOString().slice(0, 10);
  downloadAnchor.setAttribute('href', dataStr);
  downloadAnchor.setAttribute('download', `metis_utdanning_backup_${dateStr}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

export function importDatabaseFromJson(file: File): Promise<AppDatabase> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text) as AppDatabase;
        if (!parsed.students || !parsed.materials || !parsed.subjects || !parsed.assignments) {
          throw new Error('Ugyldig sikkerhetskopifil: mangler nødvendige tabeller.');
        }
        saveDatabase(parsed);
        resolve(parsed);
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = (e) => reject(e);
    reader.readAsText(file);
  });
}

export function clearLocalStorage(): AppDatabase {
  localStorage.removeItem('metis_utdanning_hub_data_v1');
  localStorage.removeItem(STORAGE_KEY);
  localStorage.setItem(MIGRATION_KEY, 'true');
  saveDatabase(INITIAL_DATABASE);
  return INITIAL_DATABASE;
}

export function resetDatabaseToDefault(): AppDatabase {
  saveDatabase(INITIAL_DATABASE);
  return INITIAL_DATABASE;
}

// Assignment status cycle helper:
// ikke_tildelt -> tildelt -> under_arbeid -> gjennomgatt -> levert -> ikke_tildelt
export function getNextAssignmentStatus(current?: AssignmentStatus): AssignmentStatus {
  if (!current || current === 'ikke_tildelt') return 'tildelt';
  if (current === 'tildelt') return 'under_arbeid';
  if (current === 'under_arbeid') return 'gjennomgatt';
  if (current === 'gjennomgatt') return 'levert';
  return 'ikke_tildelt';
}
