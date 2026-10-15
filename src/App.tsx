/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { AppDatabase, AppUser, Assignment, AssignmentStatus, Material, PlannedSession, Student, Subject } from './types';
import { loadDatabase, saveDatabase, clearLocalStorage } from './lib/storage';
import { CloudSyncService, testFirestoreConnection } from './lib/firebase';
import { SupabaseSyncService } from './lib/supabase';
import { hydrateMaterialsWithFiles, saveFilesToIndexedDB, deleteFilesFromIndexedDB } from './lib/fileStorage';
import { getStoredActiveUser, logoutUser, subscribeToAuth, PRIMARY_USER_EMAIL } from './lib/authService';
import { AuthScreen } from './components/AuthScreen';
import { Header } from './components/Header';
import { ProgressMatrix } from './components/ProgressMatrix';
import { StudentList } from './components/StudentList';
import { MaterialsBank } from './components/MaterialsBank';
import { StudentCardModal } from './components/StudentCardModal';
import { NewStudentModal } from './components/NewStudentModal';
import { NewMaterialModal } from './components/NewMaterialModal';
import { BulkAssignModal } from './components/BulkAssignModal';
import { BackupModal } from './components/BackupModal';
import { SessionPlannerModal } from './components/SessionPlannerModal';
import { HomeDashboard } from './components/HomeDashboard';
import { SubjectModal } from './components/SubjectModal';
import { SessionsView } from './components/SessionsView';

export default function App() {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => getStoredActiveUser());
  const [db, setDb] = useState<AppDatabase>(() => loadDatabase());
  const [activeTab, setActiveTab] = useState<'oversikt' | 'matrise' | 'elever' | 'timer' | 'materiell'>('oversikt');
  const [matrixInitialSubjectId, setMatrixInitialSubjectId] = useState<string>('all');
  const [syncStatus, setSyncStatus] = useState<'connecting' | 'synced' | 'saving' | 'offline'>('connecting');
  const [cloudProvider, setCloudProvider] = useState<'supabase' | 'firestore'>(() =>
    SupabaseSyncService.getInstance().isConfigured() ? 'supabase' : 'firestore'
  );

  const cloudSync = useRef(CloudSyncService.getInstance());
  const supabaseSync = useRef(SupabaseSyncService.getInstance());

  // Listen for authentication changes
  useEffect(() => {
    const unsubscribe = subscribeToAuth((user) => {
      setCurrentUser(user);
    });
    return unsubscribe;
  }, []);

  // Check Firestore connection and setup real-time subscription
  useEffect(() => {
    let isSubscribed = true;

    async function initCloudSync() {
      try {
        // First hydrate any materials with attachments stored in IndexedDB
        hydrateMaterialsWithFiles(db.materials).then((hydrated) => {
          if (hydrated && isSubscribed) {
            setDb((prev) => ({ ...prev, materials: hydrated }));
          }
        });

        const isSupabase = supabaseSync.current.isConfigured();
        setCloudProvider(isSupabase ? 'supabase' : 'firestore');

        if (isSupabase) {
          // Seed Supabase if empty
          await supabaseSync.current.seedIfEmpty(db);

          const unsubscribe = supabaseSync.current.subscribeToDatabase(
            (partial) => {
              if (!isSubscribed) return;
              setDb((prev) => {
                const updated = {
                  ...prev,
                  subjects: partial.subjects !== undefined ? partial.subjects : prev.subjects,
                  materials: partial.materials !== undefined ? partial.materials : prev.materials,
                  students: partial.students !== undefined ? partial.students : prev.students,
                  assignments: partial.assignments !== undefined ? partial.assignments : prev.assignments,
                  sessions: partial.sessions !== undefined ? partial.sessions : (prev.sessions || []),
                  lastUpdated: new Date().toISOString(),
                };
                saveDatabase(updated);
                return updated;
              });
              setSyncStatus('synced');
            },
            (err) => {
              console.warn('Supabase subscription error:', err);
              if (isSubscribed) setSyncStatus('offline');
            }
          );
          return unsubscribe;
        }

        const isOnline = await testFirestoreConnection();
        if (!isOnline && !navigator.onLine) {
          if (isSubscribed) setSyncStatus('offline');
          return;
        }

        // Seed initial data if cloud is empty
        await cloudSync.current.seedIfEmpty(db);

        // Listen for live updates from Firestore
        const unsubscribe = cloudSync.current.subscribeToDatabase(
          (partial) => {
            if (!isSubscribed) return;
            setDb((prev) => {
              // Ensure we merge materials while preserving attachments and local materials
              let mergedMaterials = prev.materials;
              if (partial.materials !== undefined) {
                if (partial.materials.length > 0) {
                  mergedMaterials = partial.materials.map((cloudMat) => {
                    const localMat = prev.materials.find((m) => m.id === cloudMat.id);
                    if (!localMat || !localMat.files) return cloudMat;
                    // Merge file dataUrls from local if cloud stripped them
                    const mergedFiles = (cloudMat.files || []).map((cf) => {
                      const lf = localMat.files?.find((f) => f.id === cf.id);
                      if (lf && lf.dataUrl && !cf.dataUrl) {
                        return { ...cf, dataUrl: lf.dataUrl };
                      }
                      return cf;
                    });
                    return { ...cloudMat, files: mergedFiles };
                  });
                  // Keep any local material that was created recently and not yet in snapshot
                  for (const locMat of prev.materials) {
                    if (!mergedMaterials.some((m) => m.id === locMat.id)) {
                      mergedMaterials.push(locMat);
                    }
                  }
                } else if (prev.materials.length > 0) {
                  // If cloud snapshot is empty but local has items, don't wipe local!
                  mergedMaterials = prev.materials;
                  cloudSync.current.seedIfEmpty(prev);
                }
              }

              const updated = {
                ...prev,
                subjects: partial.subjects !== undefined ? partial.subjects : prev.subjects,
                materials: mergedMaterials,
                students: partial.students !== undefined ? partial.students : prev.students,
                assignments: partial.assignments !== undefined ? partial.assignments : prev.assignments,
                sessions: partial.sessions !== undefined ? partial.sessions : (prev.sessions || []),
                lastUpdated: new Date().toISOString(),
              };
              saveDatabase(updated);
              return updated;
            });
            setSyncStatus('synced');
          },
          (err) => {
            console.warn('Firestore subscription error:', err);
            if (isSubscribed) setSyncStatus('offline');
          }
        );

        return unsubscribe;
      } catch (e) {
        console.error('Cloud sync init error:', e);
        if (isSubscribed) setSyncStatus('offline');
      }
    }

    const unsubPromise = initCloudSync();

    return () => {
      isSubscribed = false;
      unsubPromise.then((unsub) => unsub && unsub());
    };
  }, []);

  const handleNavigateToMatrix = (subjectId?: string) => {
    setMatrixInitialSubjectId(subjectId || 'all');
    setActiveTab('matrise');
  };

  // Modal states
  const [selectedStudentForCard, setSelectedStudentForCard] = useState<Student | null>(null);
  const [isNewStudentOpen, setIsNewStudentOpen] = useState(false);
  
  const [materialModalState, setMaterialModalState] = useState<{
    isOpen: boolean;
    materialToEdit?: Material | null;
    defaultSubjectId?: string;
  }>({ isOpen: false });

  const [bulkAssignState, setBulkAssignState] = useState<{
    isOpen: boolean;
    defaultMaterial?: Material | null;
    defaultStudent?: Student | null;
  }>({ isOpen: false });

  const [sessionPlannerState, setSessionPlannerState] = useState<{
    isOpen: boolean;
    defaultStudentId?: string;
    defaultSubjectId?: string;
    sessionToEdit?: PlannedSession | null;
  }>({ isOpen: false });

  const [subjectModalState, setSubjectModalState] = useState<{
    isOpen: boolean;
    subjectToEdit?: Subject | null;
  }>({ isOpen: false });

  const [isBackupOpen, setIsBackupOpen] = useState(false);

  // Auto-save whenever db changes locally as backup
  useEffect(() => {
    saveDatabase(db);
  }, [db]);

  const handleLogout = async () => {
    await logoutUser();
    setCurrentUser(null);
    setSelectedStudentForCard(null);
  };

  const userEmailLower = (currentUser?.email || '').toLowerCase();
  const isPrimaryOwner = userEmailLower === PRIMARY_USER_EMAIL.toLowerCase();

  // Scoped database view:
  // - Primary user (birkhaugnes@gmail.com) sees all data created to date (ownerEmail is birkhaugnes@gmail.com or unassigned)
  // - Other registered teachers see exclusively their own private workspace data
  const scopedDb: AppDatabase = React.useMemo(() => {
    if (!currentUser) {
      return {
        subjects: [],
        materials: [],
        students: [],
        assignments: [],
        sessions: [],
        lastUpdated: db.lastUpdated,
      };
    }

    const subjects = db.subjects.filter((s) => {
      const owner = (s.ownerEmail || PRIMARY_USER_EMAIL).toLowerCase();
      return isPrimaryOwner ? owner === PRIMARY_USER_EMAIL.toLowerCase() : owner === userEmailLower;
    });

    const materials = db.materials.filter((m) => {
      const owner = (m.ownerEmail || PRIMARY_USER_EMAIL).toLowerCase();
      return isPrimaryOwner ? owner === PRIMARY_USER_EMAIL.toLowerCase() : owner === userEmailLower;
    });

    const students = db.students.filter((st) => {
      const owner = (st.ownerEmail || PRIMARY_USER_EMAIL).toLowerCase();
      return isPrimaryOwner ? owner === PRIMARY_USER_EMAIL.toLowerCase() : owner === userEmailLower;
    });

    const studentIds = new Set(students.map((st) => st.id));

    const assignments = db.assignments.filter((a) => {
      const owner = (a.ownerEmail || PRIMARY_USER_EMAIL).toLowerCase();
      if (isPrimaryOwner) {
        return owner === PRIMARY_USER_EMAIL.toLowerCase() || studentIds.has(a.studentId);
      }
      return owner === userEmailLower || studentIds.has(a.studentId);
    });

    const sessions = (db.sessions || []).filter((sess) => {
      const owner = (sess.ownerEmail || PRIMARY_USER_EMAIL).toLowerCase();
      return isPrimaryOwner ? owner === PRIMARY_USER_EMAIL.toLowerCase() : owner === userEmailLower;
    });

    return {
      subjects,
      materials,
      students,
      assignments,
      sessions,
      lastUpdated: db.lastUpdated,
    };
  }, [db, currentUser, isPrimaryOwner, userEmailLower]);

  // Sync selectedStudentForCard with fresh db changes if modal is open
  useEffect(() => {
    if (selectedStudentForCard) {
      const fresh = scopedDb.students.find((s) => s.id === selectedStudentForCard.id);
      if (fresh) {
        setSelectedStudentForCard(fresh);
      }
    }
  }, [scopedDb.students]);

  // --- Unified Cloud Write Helpers (Supabase + Firestore mirror) ---
  const syncSaveStudent = async (student: Student) => {
    if (supabaseSync.current.isConfigured()) {
      await supabaseSync.current.saveStudent(student).catch(console.error);
    }
    await cloudSync.current.saveStudent(student).catch(console.error);
  };

  const syncDeleteStudent = async (studentId: string) => {
    if (supabaseSync.current.isConfigured()) {
      await supabaseSync.current.deleteStudent(studentId).catch(console.error);
    }
    await cloudSync.current.deleteStudent(studentId).catch(console.error);
  };

  const syncSaveSubject = async (subject: Subject) => {
    if (supabaseSync.current.isConfigured()) {
      await supabaseSync.current.saveSubject(subject).catch(console.error);
    }
    await cloudSync.current.saveSubject(subject).catch(console.error);
  };

  const syncDeleteSubject = async (subjectId: string) => {
    if (supabaseSync.current.isConfigured()) {
      await supabaseSync.current.deleteSubject(subjectId).catch(console.error);
    }
    await cloudSync.current.deleteSubject(subjectId).catch(console.error);
  };

  const syncSaveMaterial = async (material: Material) => {
    if (supabaseSync.current.isConfigured()) {
      await supabaseSync.current.saveMaterial(material).catch(console.error);
    }
    await cloudSync.current.saveMaterial(material).catch(console.error);
  };

  const syncDeleteMaterial = async (materialId: string) => {
    if (supabaseSync.current.isConfigured()) {
      await supabaseSync.current.deleteMaterial(materialId).catch(console.error);
    }
    await cloudSync.current.deleteMaterial(materialId).catch(console.error);
  };

  const syncSaveAssignment = async (assignment: Assignment) => {
    if (supabaseSync.current.isConfigured()) {
      await supabaseSync.current.saveAssignment(assignment).catch(console.error);
    }
    await cloudSync.current.saveAssignment(assignment).catch(console.error);
  };

  const syncDeleteAssignment = async (assignmentId: string) => {
    if (supabaseSync.current.isConfigured()) {
      await supabaseSync.current.deleteAssignment(assignmentId).catch(console.error);
    }
    await cloudSync.current.deleteAssignment(assignmentId).catch(console.error);
  };

  const syncSaveAssignmentsBulk = async (assignments: Assignment[]) => {
    if (supabaseSync.current.isConfigured()) {
      await supabaseSync.current.saveAssignmentsBulk(assignments).catch(console.error);
    }
    await cloudSync.current.saveAssignmentsBulk(assignments).catch(console.error);
  };

  const syncSaveSession = async (session: PlannedSession) => {
    if (supabaseSync.current.isConfigured()) {
      await supabaseSync.current.saveSession(session).catch(console.error);
    }
    await cloudSync.current.saveSession(session).catch(console.error);
  };

  const syncDeleteSession = async (sessionId: string) => {
    if (supabaseSync.current.isConfigured()) {
      await supabaseSync.current.deleteSession(sessionId).catch(console.error);
    }
    await cloudSync.current.deleteSession(sessionId).catch(console.error);
  };

  // --- CRUD Handlers with cloud synchronization ---

  const handleUpdateAssignment = async (updated: Assignment) => {
    setSyncStatus('saving');
    const assignmentWithUser: Assignment = {
      ...updated,
      ownerEmail: updated.ownerEmail || currentUser?.email || PRIMARY_USER_EMAIL,
    };
    setDb((prev) => {
      const exists = prev.assignments.some((a) => a.id === assignmentWithUser.id);
      const newAssignments = exists
        ? prev.assignments.map((a) => (a.id === assignmentWithUser.id ? assignmentWithUser : a))
        : [...prev.assignments, assignmentWithUser];
      return { ...prev, assignments: newAssignments };
    });
    try {
      await syncSaveAssignment(assignmentWithUser);
      setSyncStatus('synced');
    } catch (e) {
      console.error('Failed to sync assignment to cloud:', e);
      setSyncStatus('synced');
    }
  };

  const handleDeleteAssignment = async (assignmentId: string) => {
    setSyncStatus('saving');
    setDb((prev) => ({
      ...prev,
      assignments: prev.assignments.filter((a) => a.id !== assignmentId),
    }));
    try {
      await syncDeleteAssignment(assignmentId);
      setSyncStatus('synced');
    } catch (e) {
      console.error('Failed to delete assignment in cloud:', e);
      setSyncStatus('synced');
    }
  };

  const handleSaveAssignmentsBulk = async (newOrUpdatedAssignments: Assignment[]) => {
    setSyncStatus('saving');
    const assignmentsWithUser = newOrUpdatedAssignments.map((a) => ({
      ...a,
      ownerEmail: a.ownerEmail || currentUser?.email || PRIMARY_USER_EMAIL,
    }));
    setDb((prev) => {
      const map = new Map<string, Assignment>();
      prev.assignments.forEach((a) => map.set(a.id, a));
      assignmentsWithUser.forEach((a) => map.set(a.id, a));
      return {
        ...prev,
        assignments: Array.from(map.values()),
      };
    });
    try {
      await syncSaveAssignmentsBulk(assignmentsWithUser);
      setSyncStatus('synced');
    } catch (e) {
      console.error('Failed to bulk sync assignments to cloud:', e);
      setSyncStatus('synced');
    }
  };

  const handleQuickToggleStudentAssignment = async (
    studentId: string,
    materialId: string,
    nextStatus: AssignmentStatus
  ) => {
    setSyncStatus('saving');
    const existing = db.assignments.find(
      (a) => a.studentId === studentId && a.materialId === materialId
    );

    if (nextStatus === 'ikke_tildelt') {
      if (existing) {
        setDb((prev) => ({
          ...prev,
          assignments: prev.assignments.filter((a) => a.id !== existing.id),
        }));
        try {
          await syncDeleteAssignment(existing.id);
          setSyncStatus('synced');
        } catch (e) {
          setSyncStatus('synced');
        }
      }
      return;
    }

    if (existing) {
      const updated: Assignment = {
        ...existing,
        ownerEmail: existing.ownerEmail || currentUser?.email || PRIMARY_USER_EMAIL,
        status: nextStatus,
        completedDate:
          nextStatus === 'gjennomgatt' || nextStatus === 'levert'
            ? new Date().toISOString().slice(0, 10)
            : undefined,
      };
      setDb((prev) => {
        const updatedDb = {
          ...prev,
          assignments: prev.assignments.map((a) => (a.id === updated.id ? updated : a)),
          lastUpdated: new Date().toISOString(),
        };
        saveDatabase(updatedDb);
        return updatedDb;
      });
      try {
        await syncSaveAssignment(updated);
        setSyncStatus('synced');
      } catch (e) {
        setSyncStatus('synced');
      }
    } else {
      const newAsgn: Assignment = {
        id: `asgn-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        ownerEmail: currentUser?.email || PRIMARY_USER_EMAIL,
        studentId,
        materialId,
        status: nextStatus,
        assignedDate: new Date().toISOString().slice(0, 10),
        completedDate:
          nextStatus === 'gjennomgatt' || nextStatus === 'levert'
            ? new Date().toISOString().slice(0, 10)
            : undefined,
      };
      setDb((prev) => {
        const updatedDb = {
          ...prev,
          assignments: [...prev.assignments, newAsgn],
          lastUpdated: new Date().toISOString(),
        };
        saveDatabase(updatedDb);
        return updatedDb;
      });
      try {
        await syncSaveAssignment(newAsgn);
        setSyncStatus('synced');
      } catch (e) {
        setSyncStatus('synced');
      }
    }
  };

  const handleSaveStudent = async (student: Student) => {
    setSyncStatus('saving');
    const studentWithUser: Student = {
      ...student,
      ownerEmail: student.ownerEmail || currentUser?.email || PRIMARY_USER_EMAIL,
    };
    setDb((prev) => {
      const exists = prev.students.some((s) => s.id === studentWithUser.id);
      const newStudents = exists
        ? prev.students.map((s) => (s.id === studentWithUser.id ? studentWithUser : s))
        : [studentWithUser, ...prev.students];
      const updatedDb = { ...prev, students: newStudents, lastUpdated: new Date().toISOString() };
      saveDatabase(updatedDb);
      return updatedDb;
    });
    try {
      await syncSaveStudent(studentWithUser);
      setSyncStatus('synced');
    } catch (e) {
      console.error('Failed to save student in cloud:', e);
      setSyncStatus('synced');
    }
  };

  const handleDeleteStudent = async (studentId: string) => {
    setSyncStatus('saving');
    const relatedAssignments = db.assignments.filter((a) => a.studentId === studentId);
    setDb((prev) => {
      const updatedDb = {
        ...prev,
        students: prev.students.filter((s) => s.id !== studentId),
        assignments: prev.assignments.filter((a) => a.studentId !== studentId),
        lastUpdated: new Date().toISOString(),
      };
      saveDatabase(updatedDb);
      return updatedDb;
    });
    if (selectedStudentForCard?.id === studentId) {
      setSelectedStudentForCard(null);
    }
    try {
      await syncDeleteStudent(studentId);
      for (const asgn of relatedAssignments) {
        await syncDeleteAssignment(asgn.id);
      }
      setSyncStatus('synced');
    } catch (e) {
      console.error('Failed to delete student in cloud:', e);
      setSyncStatus('synced');
    }
  };

  const handleSaveMaterial = async (material: Material) => {
    setSyncStatus('saving');
    const materialWithUser: Material = {
      ...material,
      ownerEmail: material.ownerEmail || currentUser?.email || PRIMARY_USER_EMAIL,
    };

    // 1. Save files to IndexedDB if present
    if (materialWithUser.files && materialWithUser.files.length > 0) {
      await saveFilesToIndexedDB(materialWithUser.files);
    }

    // 2. Persist locally immediately
    setDb((prev) => {
      const exists = prev.materials.some((m) => m.id === materialWithUser.id);
      const newMaterials = exists
        ? prev.materials.map((m) => (m.id === materialWithUser.id ? materialWithUser : m))
        : [materialWithUser, ...prev.materials];
      const updatedDb = { ...prev, materials: newMaterials, lastUpdated: new Date().toISOString() };
      saveDatabase(updatedDb);
      return updatedDb;
    });

    // 3. Save to Cloud
    try {
      await syncSaveMaterial(materialWithUser);
      setSyncStatus('synced');
    } catch (e) {
      console.error('Failed to save material in cloud:', e);
      setSyncStatus('synced');
    }
  };

  const handleDeleteMaterial = async (materialId: string) => {
    if (window.confirm('Er du sikker på at du vil slette dette fagmateriellet?')) {
      setSyncStatus('saving');
      const matToDelete = db.materials.find((m) => m.id === materialId);
      if (matToDelete?.files && matToDelete.files.length > 0) {
        await deleteFilesFromIndexedDB(matToDelete.files.map((f) => f.id));
      }
      const relatedAssignments = db.assignments.filter((a) => a.materialId === materialId);
      setDb((prev) => {
        const updatedDb = {
          ...prev,
          materials: prev.materials.filter((m) => m.id !== materialId),
          assignments: prev.assignments.filter((a) => a.materialId !== materialId),
          lastUpdated: new Date().toISOString(),
        };
        saveDatabase(updatedDb);
        return updatedDb;
      });
      try {
        await syncDeleteMaterial(materialId);
        for (const asgn of relatedAssignments) {
          await syncDeleteAssignment(asgn.id);
        }
        setSyncStatus('synced');
      } catch (e) {
        console.error('Failed to delete material in cloud:', e);
        setSyncStatus('synced');
      }
    }
  };

  const handleSaveSubject = async (subject: Subject) => {
    setSyncStatus('saving');
    const subjectWithUser: Subject = {
      ...subject,
      ownerEmail: subject.ownerEmail || currentUser?.email || PRIMARY_USER_EMAIL,
    };
    setDb((prev) => {
      const exists = prev.subjects.some((s) => s.id === subjectWithUser.id);
      const newSubjects = exists
        ? prev.subjects.map((s) => (s.id === subjectWithUser.id ? subjectWithUser : s))
        : [...prev.subjects, subjectWithUser];
      const updatedDb = { ...prev, subjects: newSubjects, lastUpdated: new Date().toISOString() };
      saveDatabase(updatedDb);
      return updatedDb;
    });
    try {
      await syncSaveSubject(subjectWithUser);
      setSyncStatus('synced');
    } catch (e) {
      console.error('Failed to save subject in cloud:', e);
      setSyncStatus('synced');
    }
  };

  const handleDeleteSubject = async (subjectId: string) => {
    setSyncStatus('saving');
    const materialsToDelete = db.materials.filter((m) => m.subjectId === subjectId);
    setDb((prev) => {
      const updatedDb = {
        ...prev,
        subjects: prev.subjects.filter((s) => s.id !== subjectId),
        students: prev.students.map((st) => ({
          ...st,
          enrolledSubjectIds: st.enrolledSubjectIds.filter((id) => id !== subjectId),
        })),
        materials: prev.materials.filter((m) => m.subjectId !== subjectId),
        assignments: prev.assignments.filter((a) => {
          const mat = prev.materials.find((m) => m.id === a.materialId);
          return mat ? mat.subjectId !== subjectId : true;
        }),
        lastUpdated: new Date().toISOString(),
      };
      saveDatabase(updatedDb);
      return updatedDb;
    });
    try {
      await syncDeleteSubject(subjectId);
      for (const mat of materialsToDelete) {
        await syncDeleteMaterial(mat.id);
      }
      setSyncStatus('synced');
    } catch (e) {
      console.error('Failed to delete subject in cloud:', e);
      setSyncStatus('synced');
    }
  };

  const handleBulkUpdateAssignments = async (newAssignments: Assignment[]) => {
    setSyncStatus('saving');
    setDb((prev) => {
      const updatedAssignments = [...prev.assignments];
      newAssignments.forEach((item) => {
        const idx = updatedAssignments.findIndex(
          (a) => a.id === item.id || (a.studentId === item.studentId && a.materialId === item.materialId)
        );
        if (idx >= 0) {
          updatedAssignments[idx] = item;
        } else {
          updatedAssignments.push(item);
        }
      });
      const updatedDb = { ...prev, assignments: updatedAssignments, lastUpdated: new Date().toISOString() };
      saveDatabase(updatedDb);
      return updatedDb;
    });
    try {
      await syncSaveAssignmentsBulk(newAssignments);
      setSyncStatus('synced');
    } catch (e) {
      console.error('Failed to sync bulk assignments in cloud:', e);
      setSyncStatus('synced');
    }
  };

  const handleSaveSession = async (session: PlannedSession) => {
    setSyncStatus('saving');
    const sessionWithUser: PlannedSession = {
      ...session,
      ownerEmail: session.ownerEmail || currentUser?.email || PRIMARY_USER_EMAIL,
    };
    setDb((prev) => {
      const existing = prev.sessions || [];
      const idx = existing.findIndex((s) => s.id === sessionWithUser.id);
      const updatedSessions = idx >= 0
        ? existing.map((s, i) => (i === idx ? sessionWithUser : s))
        : [...existing, sessionWithUser];
      const updatedDb = {
        ...prev,
        sessions: updatedSessions,
        lastUpdated: new Date().toISOString(),
      };
      saveDatabase(updatedDb);
      return updatedDb;
    });

    try {
      await syncSaveSession(sessionWithUser);
      setSyncStatus('synced');
    } catch (e) {
      console.error('Failed to save session to cloud:', e);
      setSyncStatus('synced');
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    setSyncStatus('saving');
    setDb((prev) => {
      const updated = {
        ...prev,
        sessions: (prev.sessions || []).filter((s) => s.id !== sessionId),
        lastUpdated: new Date().toISOString(),
      };
      saveDatabase(updated);
      return updated;
    });

    try {
      await syncDeleteSession(sessionId);
      setSyncStatus('synced');
    } catch (e) {
      console.error('Failed to delete session in cloud:', e);
      setSyncStatus('synced');
    }
  };

  const handleCompleteSession = async (sessionId: string, completedMaterialIds?: string[]) => {
    const session = (db.sessions || []).find((s) => s.id === sessionId);
    if (!session) return;

    setSyncStatus('saving');
    const today = new Date().toISOString().slice(0, 10);
    const materialIds = completedMaterialIds && completedMaterialIds.length > 0
      ? completedMaterialIds
      : session.items.map((i) => i.materialId);

    // 1. Mark session as completed
    const updatedSession: PlannedSession = {
      ...session,
      status: 'gjennomfort',
      completedAt: new Date().toISOString(),
      items: session.items.map((i) => ({
        ...i,
        completed: materialIds.includes(i.materialId) ? true : i.completed,
      })),
    };

    // 2. Automatically update student assignments to 'gjennomgatt' (No double entry!)
    const newOrUpdatedAssignments: Assignment[] = [];
    materialIds.forEach((matId) => {
      const existing = db.assignments.find(
        (a) => a.studentId === session.studentId && a.materialId === matId
      );
      if (existing) {
        newOrUpdatedAssignments.push({
          ...existing,
          ownerEmail: existing.ownerEmail || currentUser?.email || PRIMARY_USER_EMAIL,
          status: 'gjennomgatt',
          completedDate: today,
        });
      } else {
        newOrUpdatedAssignments.push({
          id: `asgn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          ownerEmail: currentUser?.email || PRIMARY_USER_EMAIL,
          studentId: session.studentId,
          materialId: matId,
          status: 'gjennomgatt',
          assignedDate: session.date || today,
          completedDate: today,
        });
      }
    });

    // Update state
    setDb((prev) => {
      const updatedSessions = (prev.sessions || []).map((s) =>
        s.id === sessionId ? updatedSession : s
      );

      const updatedAssignments = [...prev.assignments];
      newOrUpdatedAssignments.forEach((asgn) => {
        const idx = updatedAssignments.findIndex((a) => a.id === asgn.id);
        if (idx >= 0) {
          updatedAssignments[idx] = asgn;
        } else {
          updatedAssignments.push(asgn);
        }
      });

      const updatedDb = {
        ...prev,
        sessions: updatedSessions,
        assignments: updatedAssignments,
        lastUpdated: new Date().toISOString(),
      };
      saveDatabase(updatedDb);
      return updatedDb;
    });

    try {
      await Promise.all([
        syncSaveSession(updatedSession),
        syncSaveAssignmentsBulk(newOrUpdatedAssignments),
      ]);
      setSyncStatus('synced');
    } catch (e) {
      console.error('Failed to sync completed session in cloud:', e);
      setSyncStatus('synced');
    }
  };

  // Guard all sensitive data behind authentication wall (Brukermur)
  if (!currentUser) {
    return <AuthScreen onAuthenticated={(user) => setCurrentUser(user)} />;
  }

  return (
    <div className="min-h-screen bg-[#fbfbfa] text-slate-900 flex flex-col font-sans selection:bg-emerald-100 selection:text-emerald-900">
      
      {/* Top Header */}
      <Header
        db={scopedDb}
        currentUser={currentUser}
        onLogout={handleLogout}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        syncStatus={syncStatus}
        cloudProvider={cloudProvider}
        onOpenNewStudent={() => setIsNewStudentOpen(true)}
        onOpenNewMaterial={() =>
          setMaterialModalState({ isOpen: true, materialToEdit: null })
        }
        onOpenBulkAssign={() =>
          setBulkAssignState({ isOpen: true, defaultMaterial: null, defaultStudent: null })
        }
        onOpenSessionPlanner={(defaultStudentId, defaultSubjectId) =>
          setSessionPlannerState({ isOpen: true, defaultStudentId, defaultSubjectId })
        }
        onOpenBackup={() => setIsBackupOpen(true)}
      />

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full">
        {activeTab === 'oversikt' && (
          <HomeDashboard
            db={scopedDb}
            onNavigateToMatrix={handleNavigateToMatrix}
            onNavigateToSessions={() => setActiveTab('timer')}
            onSelectStudent={(s) => setSelectedStudentForCard(s)}
            onSelectMaterial={(m) =>
              setMaterialModalState({ isOpen: true, materialToEdit: m })
            }
            onOpenNewStudent={() => setIsNewStudentOpen(true)}
            onOpenNewMaterial={() =>
              setMaterialModalState({ isOpen: true, materialToEdit: null })
            }
            onOpenBulkAssign={() =>
              setBulkAssignState({ isOpen: true, defaultMaterial: null, defaultStudent: null })
            }
            onOpenSessionPlanner={(defaultStudentId, defaultSubjectId) =>
              setSessionPlannerState({ isOpen: true, defaultStudentId, defaultSubjectId })
            }
            onCompleteSession={handleCompleteSession}
          />
        )}

        {activeTab === 'matrise' && (
          <ProgressMatrix
            db={scopedDb}
            initialSubjectId={matrixInitialSubjectId}
            onUpdateAssignment={handleUpdateAssignment}
            onSelectStudent={(s) => setSelectedStudentForCard(s)}
            onSelectMaterial={(m) =>
              setMaterialModalState({ isOpen: true, materialToEdit: m })
            }
            onOpenSessionPlanner={(defaultStudentId, defaultSubjectId) =>
              setSessionPlannerState({ isOpen: true, defaultStudentId, defaultSubjectId })
            }
          />
        )}

        {activeTab === 'elever' && (
          <StudentList
            db={scopedDb}
            onSelectStudent={(s) => setSelectedStudentForCard(s)}
            onOpenNewStudent={() => setIsNewStudentOpen(true)}
            onOpenSessionPlanner={(defaultStudentId, defaultSubjectId) =>
              setSessionPlannerState({ isOpen: true, defaultStudentId, defaultSubjectId })
            }
          />
        )}

        {activeTab === 'timer' && (
          <SessionsView
            db={scopedDb}
            onOpenSessionPlanner={(defaultStudentId, defaultSubjectId, sessionToEdit) =>
              setSessionPlannerState({
                isOpen: true,
                defaultStudentId,
                defaultSubjectId,
                sessionToEdit: sessionToEdit || null,
              })
            }
            onSelectStudent={(s) => setSelectedStudentForCard(s)}
            onCompleteSession={handleCompleteSession}
            onDeleteSession={handleDeleteSession}
            onUpdateSession={handleSaveSession}
          />
        )}

        {activeTab === 'materiell' && (
          <MaterialsBank
            db={scopedDb}
            onOpenNewMaterial={(defaultSubjectId) =>
              setMaterialModalState({
                isOpen: true,
                materialToEdit: null,
                defaultSubjectId,
              })
            }
            onEditMaterial={(m) =>
              setMaterialModalState({ isOpen: true, materialToEdit: m })
            }
            onDeleteMaterial={handleDeleteMaterial}
            onOpenAssignForMaterial={(m) =>
              setBulkAssignState({ isOpen: true, defaultMaterial: m, defaultStudent: null })
            }
            onQuickToggleStudentAssignment={handleQuickToggleStudentAssignment}
            onOpenNewSubject={() => setSubjectModalState({ isOpen: true, subjectToEdit: null })}
            onEditSubject={(sub) => setSubjectModalState({ isOpen: true, subjectToEdit: sub })}
          />
        )}
      </main>

      {/* Elevkort Modal */}
      {selectedStudentForCard && (
        <StudentCardModal
          student={selectedStudentForCard}
          db={scopedDb}
          onClose={() => setSelectedStudentForCard(null)}
          onUpdateStudent={handleSaveStudent}
          onDeleteStudent={handleDeleteStudent}
          onUpdateAssignment={handleUpdateAssignment}
          onDeleteAssignment={handleDeleteAssignment}
          onOpenAssignForStudent={(s) =>
            setBulkAssignState({ isOpen: true, defaultMaterial: null, defaultStudent: s })
          }
          onOpenSessionPlannerForStudent={(s, sessionToEdit) =>
            setSessionPlannerState({
              isOpen: true,
              defaultStudentId: s.id,
              defaultSubjectId: sessionToEdit ? sessionToEdit.subjectId : s.enrolledSubjectIds[0],
              sessionToEdit: sessionToEdit || null,
            })
          }
          onUpdateSession={handleSaveSession}
          onCompleteSession={handleCompleteSession}
          onDeleteSession={handleDeleteSession}
        />
      )}

      {/* Ny Elev Modal */}
      {isNewStudentOpen && (
        <NewStudentModal
          db={scopedDb}
          onClose={() => setIsNewStudentOpen(false)}
          onSaveStudent={handleSaveStudent}
        />
      )}

      {/* Nytt / Rediger Fagmateriell Modal */}
      {materialModalState.isOpen && (
        <NewMaterialModal
          db={scopedDb}
          materialToEdit={materialModalState.materialToEdit}
          defaultSubjectId={materialModalState.defaultSubjectId}
          onClose={() => setMaterialModalState({ isOpen: false })}
          onSaveMaterial={handleSaveMaterial}
        />
      )}

      {/* Tildel i bulk Modal */}
      {bulkAssignState.isOpen && (
        <BulkAssignModal
          db={scopedDb}
          defaultMaterial={bulkAssignState.defaultMaterial}
          defaultStudent={bulkAssignState.defaultStudent}
          onClose={() => setBulkAssignState({ isOpen: false })}
          onSaveAssignments={handleSaveAssignmentsBulk}
        />
      )}

      {/* Session Planner / Utskrift Modal */}
      {sessionPlannerState.isOpen && (
        <SessionPlannerModal
          db={scopedDb}
          defaultStudentId={sessionPlannerState.defaultStudentId}
          defaultSubjectId={sessionPlannerState.defaultSubjectId}
          initialSession={sessionPlannerState.sessionToEdit || undefined}
          onClose={() => setSessionPlannerState({ isOpen: false, sessionToEdit: null })}
          onSaveSession={handleSaveSession}
          onBulkUpdateAssignments={handleBulkUpdateAssignments}
        />
      )}

      {/* Backup / Eksport / Import Modal */}
      {isBackupOpen && (
        <BackupModal
          db={scopedDb}
          onClose={() => setIsBackupOpen(false)}
          onReloadDatabase={(newDb) => {
            setDb(newDb);
            saveDatabase(newDb);
          }}
          onSyncToCloud={async () => {
            if (supabaseSync.current.isConfigured()) {
              await supabaseSync.current.importFullDatabase(scopedDb);
              setCloudProvider('supabase');
            }
            await cloudSync.current.importFullDatabase(scopedDb);
            setSyncStatus('synced');
          }}
          onClearAllData={async () => {
            await cloudSync.current.clearAllCloudData();
            const empty = clearLocalStorage();
            setDb(empty);
          }}
          syncStatus={syncStatus}
        />
      )}

      {/* Fag / Rediger eller Opprett Fag Modal */}
      {subjectModalState.isOpen && (
        <SubjectModal
          isOpen={subjectModalState.isOpen}
          subjectToEdit={subjectModalState.subjectToEdit}
          onClose={() => setSubjectModalState({ isOpen: false, subjectToEdit: null })}
          onSaveSubject={handleSaveSubject}
          onDeleteSubject={handleDeleteSubject}
        />
      )}

      {/* Footer */}
      <footer className="border-t border-stone-200 bg-white py-4 text-xs text-slate-500 text-center">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Metis Utdanning • Elevhub for {currentUser.displayName || currentUser.email}</span>
          <span className="text-[11px] text-slate-400">
            {cloudProvider === 'supabase' ? 'Supabase PostgreSQL skylagring' : 'Google Firebase Firestore skylagring'} • Skjermet for personsensitiv data • Sanntidssynkronisering
          </span>
        </div>
      </footer>
    </div>
  );
}
