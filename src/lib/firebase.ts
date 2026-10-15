import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  getFirestore, 
  initializeFirestore,
  doc, 
  getDocFromServer,
  collection,
  onSnapshot,
  setDoc,
  deleteDoc,
  getDocs,
  writeBatch
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { Subject, Material, Student, Assignment, PlannedSession, AppDatabase } from '../types';
import { INITIAL_DATABASE } from '../data/initialData';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
  };
}

// Initialize Firebase App
export const app = initializeApp(firebaseConfig);

// CRITICAL: Connect to the specific database configured for the applet with ignoreUndefinedProperties
function getDbInstance() {
  try {
    return initializeFirestore(app, {
      ignoreUndefinedProperties: true,
    }, firebaseConfig.firestoreDatabaseId);
  } catch {
    return getFirestore(app, firebaseConfig.firestoreDatabaseId);
  }
}

export const db = getDbInstance();
export const auth = getAuth(app);

/**
 * Strips all undefined fields and ensures heavy base64 strings don't exceed Firestore's 1MB doc limit.
 */
export function cleanForFirestore<T>(data: T): T {
  if (data === null || data === undefined) {
    return null as unknown as T;
  }
  if (Array.isArray(data)) {
    return data
      .filter((item) => item !== undefined)
      .map((item) => cleanForFirestore(item)) as unknown as T;
  }
  if (typeof data === 'object') {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(data as Record<string, any>)) {
      if (value === undefined) {
        continue;
      }
      // If a file dataUrl is larger than 250KB, strip it from the Firestore doc
      // The full file is safely stored in IndexedDB on the device
      if (key === 'dataUrl' && typeof value === 'string' && value.length > 250 * 1024) {
        cleaned[key] = '';
      } else {
        cleaned[key] = cleanForFirestore(value);
      }
    }
    return cleaned as T;
  }
  return data;
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
      tenantId: auth.currentUser?.tenantId || null,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate Connection to Firestore on startup
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Firestore client is offline, using offline cache.");
    } else {
      console.info("Firestore connection check:", error);
    }
    return false;
  }
}

// Cloud Synchronization Service for Metis Utdanning
export class CloudSyncService {
  private static instance: CloudSyncService;
  private isSeeded: boolean = false;

  public static getInstance(): CloudSyncService {
    if (!CloudSyncService.instance) {
      CloudSyncService.instance = new CloudSyncService();
    }
    return CloudSyncService.instance;
  }

  // Subscribe to all 4 collections in real time
  public subscribeToDatabase(
    onUpdate: (db: Partial<AppDatabase>) => void,
    onError: (err: Error) => void
  ): () => void {
    const unsubSubjects = onSnapshot(
      collection(db, 'subjects'),
      (snapshot) => {
        const subjects: Subject[] = [];
        snapshot.forEach((d) => {
          const item = d.data() as Subject;
          subjects.push({ ...item, ownerEmail: item.ownerEmail || 'birkhaugnes@gmail.com' });
        });
        onUpdate({ subjects });
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'subjects');
        onError(error);
      }
    );

    const unsubMaterials = onSnapshot(
      collection(db, 'materials'),
      (snapshot) => {
        const materials: Material[] = [];
        snapshot.forEach((d) => {
          const item = d.data() as Material;
          materials.push({ ...item, ownerEmail: item.ownerEmail || 'birkhaugnes@gmail.com' });
        });
        onUpdate({ materials });
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'materials');
        onError(error);
      }
    );

    const unsubStudents = onSnapshot(
      collection(db, 'students'),
      (snapshot) => {
        const students: Student[] = [];
        snapshot.forEach((d) => {
          const item = d.data() as Student;
          students.push({ ...item, ownerEmail: item.ownerEmail || 'birkhaugnes@gmail.com' });
        });
        onUpdate({ students });
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'students');
        onError(error);
      }
    );

    const unsubAssignments = onSnapshot(
      collection(db, 'assignments'),
      (snapshot) => {
        const assignments: Assignment[] = [];
        snapshot.forEach((d) => {
          const item = d.data() as Assignment;
          assignments.push({ ...item, ownerEmail: item.ownerEmail || 'birkhaugnes@gmail.com' });
        });
        onUpdate({ assignments });
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'assignments');
        onError(error);
      }
    );

    const unsubSessions = onSnapshot(
      collection(db, 'sessions'),
      (snapshot) => {
        const sessions: PlannedSession[] = [];
        snapshot.forEach((d) => {
          const item = d.data() as PlannedSession;
          sessions.push({ ...item, ownerEmail: item.ownerEmail || 'birkhaugnes@gmail.com' });
        });
        onUpdate({ sessions });
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'sessions');
        onError(error);
      }
    );

    return () => {
      unsubSubjects();
      unsubMaterials();
      unsubStudents();
      unsubAssignments();
      unsubSessions();
    };
  }

  // Clear all data from cloud collections (students, materials, subjects, assignments, sessions)
  public async clearAllCloudData(): Promise<void> {
    try {
      const collections = ['students', 'materials', 'subjects', 'assignments', 'sessions'];
      for (const colName of collections) {
        const snap = await getDocs(collection(db, colName));
        for (const docSnapshot of snap.docs) {
          await deleteDoc(docSnapshot.ref);
        }
      }
      console.log('All Firestore collections cleared.');
    } catch (error) {
      console.error('Error clearing cloud collections:', error);
      handleFirestoreError(error, OperationType.DELETE, 'collections');
    }
  }

  // Sync local data to Firestore if Firestore is empty
  public async seedIfEmpty(localDb?: AppDatabase): Promise<void> {
    if (this.isSeeded) return;
    try {
      if (localDb) {
        // If local database has materials, make sure they exist in Firestore
        if (localDb.materials && localDb.materials.length > 0) {
          const matSnap = await getDocs(collection(db, 'materials'));
          if (matSnap.empty) {
            console.log('Seeding local materials to empty cloud...', localDb.materials.length);
            for (const mat of localDb.materials) {
              await this.saveMaterial(mat);
            }
          }
        }
        // If local database has subjects, ensure they exist in Firestore
        if (localDb.subjects && localDb.subjects.length > 0) {
          const subSnap = await getDocs(collection(db, 'subjects'));
          if (subSnap.empty) {
            for (const sub of localDb.subjects) {
              await this.saveSubject(sub);
            }
          }
        }
        // If local database has students, ensure they exist in Firestore
        if (localDb.students && localDb.students.length > 0) {
          const studSnap = await getDocs(collection(db, 'students'));
          if (studSnap.empty) {
            for (const stud of localDb.students) {
              await this.saveStudent(stud);
            }
          }
        }
      }
      this.isSeeded = true;
    } catch (e) {
      console.warn('seedIfEmpty check skipped:', e);
      this.isSeeded = true;
    }
  }

  // CRUD write operations to Firestore
  public async saveStudent(student: Student): Promise<void> {
    const path = `students/${student.id}`;
    try {
      const cleanData = cleanForFirestore(student);
      await setDoc(doc(db, 'students', student.id), cleanData);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  public async deleteStudent(studentId: string): Promise<void> {
    const path = `students/${studentId}`;
    try {
      await deleteDoc(doc(db, 'students', studentId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }

  public async saveMaterial(material: Material): Promise<void> {
    const path = `materials/${material.id}`;
    try {
      const cleanData = cleanForFirestore(material);
      await setDoc(doc(db, 'materials', material.id), cleanData);
      console.log('Saved material to Firestore:', material.id);
    } catch (error) {
      console.error('Error in saveMaterial:', error);
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  public async deleteMaterial(materialId: string): Promise<void> {
    const path = `materials/${materialId}`;
    try {
      await deleteDoc(doc(db, 'materials', materialId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }

  public async saveSubject(subject: Subject): Promise<void> {
    const path = `subjects/${subject.id}`;
    try {
      const cleanData = cleanForFirestore(subject);
      await setDoc(doc(db, 'subjects', subject.id), cleanData);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  public async deleteSubject(subjectId: string): Promise<void> {
    const path = `subjects/${subjectId}`;
    try {
      await deleteDoc(doc(db, 'subjects', subjectId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }

  public async saveAssignment(assignment: Assignment): Promise<void> {
    const path = `assignments/${assignment.id}`;
    try {
      const cleanData = cleanForFirestore(assignment);
      await setDoc(doc(db, 'assignments', assignment.id), cleanData);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  public async deleteAssignment(assignmentId: string): Promise<void> {
    const path = `assignments/${assignmentId}`;
    try {
      await deleteDoc(doc(db, 'assignments', assignmentId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }

  public async saveAssignmentsBulk(assignments: Assignment[]): Promise<void> {
    try {
      const batch = writeBatch(db);
      for (const asgn of assignments) {
        const cleanData = cleanForFirestore(asgn);
        const ref = doc(db, 'assignments', asgn.id);
        batch.set(ref, cleanData);
      }
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'assignments/bulk');
    }
  }

  public async saveSession(session: PlannedSession): Promise<void> {
    const path = `sessions/${session.id}`;
    try {
      const cleanData = cleanForFirestore(session);
      await setDoc(doc(db, 'sessions', session.id), cleanData);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }

  public async deleteSession(sessionId: string): Promise<void> {
    const path = `sessions/${sessionId}`;
    try {
      await deleteDoc(doc(db, 'sessions', sessionId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  }

  public async importFullDatabase(data: AppDatabase): Promise<void> {
    try {
      for (const sub of data.subjects) {
        await setDoc(doc(db, 'subjects', sub.id), cleanForFirestore(sub));
      }
      for (const mat of data.materials) {
        await setDoc(doc(db, 'materials', mat.id), cleanForFirestore(mat));
      }
      for (const stud of data.students) {
        await setDoc(doc(db, 'students', stud.id), cleanForFirestore(stud));
      }
      for (const asgn of data.assignments) {
        await setDoc(doc(db, 'assignments', asgn.id), cleanForFirestore(asgn));
      }
      if (data.sessions) {
        for (const sess of data.sessions) {
          await setDoc(doc(db, 'sessions', sess.id), cleanForFirestore(sess));
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'full_import');
    }
  }
}
