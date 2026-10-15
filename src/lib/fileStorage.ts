import { MaterialFile, Material } from '../types';

let DB_NAME = '';
export function setFileStorageScope(uid: string | null) {
  DB_NAME = uid ? 'metis_utdanning_files_v3_' + uid : '';
  dbPromise = null;
}
const STORE_NAME = 'material_files';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function getIDB(): Promise<IDBDatabase> {
  if (!DB_NAME) return Promise.reject(new Error('Ingen innlogget bruker.'));
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB is not supported in this environment'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event) => {
      console.error('IndexedDB open error:', (event.target as IDBOpenDBRequest).error);
      reject((event.target as IDBOpenDBRequest).error);
    };
  });

  return dbPromise;
}

export async function saveFileToIndexedDB(file: MaterialFile): Promise<void> {
  try {
    const db = await getIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(file);

      req.onsuccess = () => resolve();
      req.onerror = () => {
        console.error('Error saving file to IndexedDB:', req.error);
        reject(req.error);
      };
    });
  } catch (err) {
    console.warn('Could not store file in IndexedDB:', err);
  }
}

export async function saveFilesToIndexedDB(files?: MaterialFile[]): Promise<void> {
  if (!files || files.length === 0) return;
  for (const file of files) {
    if (file.dataUrl) {
      await saveFileToIndexedDB(file);
    }
  }
}

export async function getFileFromIndexedDB(fileId: string): Promise<MaterialFile | null> {
  try {
    const db = await getIDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(fileId);

      req.onsuccess = () => {
        resolve(req.result || null);
      };
      req.onerror = () => {
        resolve(null);
      };
    });
  } catch {
    return null;
  }
}

export async function deleteFileFromIndexedDB(fileId: string): Promise<void> {
  try {
    const db = await getIDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(fileId);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  } catch {
    // Ignore error
  }
}

export async function deleteFilesFromIndexedDB(fileIds: string[]): Promise<void> {
  for (const id of fileIds) {
    await deleteFileFromIndexedDB(id);
  }
}

/**
 * Hydrates materials by restoring any missing file dataUrls from IndexedDB.
 */
export async function hydrateMaterialsWithFiles(materials: Material[]): Promise<Material[]> {
  const updatedMaterials = await Promise.all(
    materials.map(async (mat) => {
      if (!mat.files || mat.files.length === 0) return mat;

      const hydratedFiles = await Promise.all(
        mat.files.map(async (f) => {
          if (f.dataUrl && f.dataUrl.length > 50) return f;
          const fromIdb = await getFileFromIndexedDB(f.id);
          if (fromIdb && fromIdb.dataUrl) {
            return { ...f, dataUrl: fromIdb.dataUrl };
          }
          return f;
        })
      );

      return { ...mat, files: hydratedFiles };
    })
  );

  return updatedMaterials;
}
