/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { AppDatabase, AppUser, Assignment, AssignmentStatus, Material, PlannedSession, Student, Subject } from './types';
import { loadDatabase, saveDatabase, emptyDatabase } from './lib/storage';
import { SupabaseSyncService } from './lib/supabase';
import { setFileStorageScope, saveFilesToIndexedDB, deleteFilesFromIndexedDB } from './lib/fileStorage';
import { logoutUser, subscribeToAuth, PRIMARY_USER_EMAIL } from './lib/authService';
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
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [db, setDb] = useState<AppDatabase>(emptyDatabase);
  const [authLoading, setAuthLoading] = useState(true);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [syncError, setSyncError] = useState('');
  const [activeTab, setActiveTab] = useState<'oversikt' | 'matrise' | 'elever' | 'timer' | 'materiell'>('oversikt');
  const [matrixInitialSubjectId, setMatrixInitialSubjectId] = useState<string>('all');
  const [syncStatus, setSyncStatus] = useState<'connecting' | 'synced' | 'saving' | 'offline'>('connecting');
  const supabaseSync = useRef(SupabaseSyncService.getInstance());

  // Listen for authentication changes
  useEffect(() => {
    const unsubscribe = subscribeToAuth((user) => {
      setCurrentUser(user);
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  // Connect only after Supabase has verified the current user.
  useEffect(() => {
    const uid = currentUser?.uid;
    setFileStorageScope(uid || null);
    setWorkspaceId(null);
    setSelectedStudentForCard(null);
    setIsNewStudentOpen(false);
    setMaterialModalState({ isOpen: false });
    setBulkAssignState({ isOpen: false });
    setSessionPlannerState({ isOpen: false });
    setSubjectModalState({ isOpen: false });
    setIsBackupOpen(false);
    setSyncError('');
    if (!uid) { setDb(emptyDatabase()); return; }
    const cached = loadDatabase(uid);
    setDb(cached);
    setWorkspaceId(uid);
    setSyncStatus('connecting');
    return supabaseSync.current.subscribeToDatabase(
      data => { setDb(data); setSyncStatus(supabaseSync.current.hasUnsyncedChanges() ? 'offline' : 'synced'); setSyncError(''); },
      error => { setSyncStatus('offline'); setSyncError(error.message); }
    );
  }, [currentUser?.uid]);

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
    if (workspaceId && workspaceId === currentUser?.uid) saveDatabase(db, workspaceId);
  }, [db, workspaceId, currentUser?.uid]);

  const handleLogout = async () => {
    try {
      await logoutUser();
      setCurrentUser(null);
      setDb(emptyDatabase());
      setSelectedStudentForCard(null);
      setIsBackupOpen(false);
    } catch (error) {
      setSyncStatus('offline');
      setSyncError(error instanceof Error ? error.message : 'Kunne ikke logge ut. Prøv igjen.');
    }
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

  // Write only to the authenticated Supabase workspace; propagate every error.
  const syncSaveStudent = (item: Student) => supabaseSync.current.saveStudent(item);
  const syncDeleteStudent = (id: string) => supabaseSync.current.deleteStudent(id);
  const syncSaveSubject = (item: Subject) => supabaseSync.current.saveSubject(item);
  const syncDeleteSubject = (id: string) => supabaseSync.current.deleteSubject(id);
  const syncSaveMaterial = (item: Material) => supabaseSync.current.saveMaterial(item);
  const syncDeleteMaterial = (id: string) => supabaseSync.current.deleteMaterial(id);
  const syncSaveAssignment = (item: Assignment) => supabaseSync.current.saveAssignment(item);
  const syncDeleteAssignment = (id: string) => supabaseSync.current.deleteAssignment(id);
  const syncSaveSession = (item: PlannedSession) => supabaseSync.current.saveSession(item);
  const syncDeleteSession = (id: string) => supabaseSync.current.deleteSession(id);
  const syncSaveAssignmentsBulk = (items: Assignment[]) => supabaseSync.current.saveAssignmentsBulk(items);

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
      setSyncStatus(supabaseSync.current.hasUnsyncedChanges() ? 'offline' : 'synced');
    } catch (e) {
      console.error('Failed to sync assignment to cloud:', e);
      setSyncStatus('offline');
      setSyncError(e instanceof Error ? e.message : 'Endringen er ikke bekreftet lagret i skyen.');
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
      setSyncStatus(supabaseSync.current.hasUnsyncedChanges() ? 'offline' : 'synced');
    } catch (e) {
      console.error('Failed to delete assignment in cloud:', e);
      setSyncStatus('offline');
      setSyncError(e instanceof Error ? e.message : 'Endringen er ikke bekreftet lagret i skyen.');
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
      setSyncStatus(supabaseSync.current.hasUnsyncedChanges() ? 'offline' : 'synced');
    } catch (e) {
      console.error('Failed to bulk sync assignments to cloud:', e);
      setSyncStatus('offline');
      setSyncError(e instanceof Error ? e.message : 'Endringen er ikke bekreftet lagret i skyen.');
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
          setSyncStatus(supabaseSync.current.hasUnsyncedChanges() ? 'offline' : 'synced');
        } catch (e) {
          setSyncStatus('offline');
          setSyncError(e instanceof Error ? e.message : 'Endringen er ikke bekreftet lagret i skyen.');
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
        return updatedDb;
      });
      try {
        await syncSaveAssignment(updated);
        setSyncStatus(supabaseSync.current.hasUnsyncedChanges() ? 'offline' : 'synced');
      } catch (e) {
        setSyncStatus('offline');
        setSyncError(e instanceof Error ? e.message : 'Endringen er ikke bekreftet lagret i skyen.');
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
        return updatedDb;
      });
      try {
        await syncSaveAssignment(newAsgn);
        setSyncStatus(supabaseSync.current.hasUnsyncedChanges() ? 'offline' : 'synced');
      } catch (e) {
        setSyncStatus('offline');
        setSyncError(e instanceof Error ? e.message : 'Endringen er ikke bekreftet lagret i skyen.');
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
      return updatedDb;
    });
    try {
      await syncSaveStudent(studentWithUser);
      setSyncStatus(supabaseSync.current.hasUnsyncedChanges() ? 'offline' : 'synced');
    } catch (e) {
      console.error('Failed to save student in cloud:', e);
      setSyncStatus('offline');
      setSyncError(e instanceof Error ? e.message : 'Endringen er ikke bekreftet lagret i skyen.');
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
      setSyncStatus(supabaseSync.current.hasUnsyncedChanges() ? 'offline' : 'synced');
    } catch (e) {
      console.error('Failed to delete student in cloud:', e);
      setSyncStatus('offline');
      setSyncError(e instanceof Error ? e.message : 'Endringen er ikke bekreftet lagret i skyen.');
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
      return updatedDb;
    });

    // 3. Save to Cloud
    try {
      await syncSaveMaterial(materialWithUser);
      setSyncStatus(supabaseSync.current.hasUnsyncedChanges() ? 'offline' : 'synced');
    } catch (e) {
      console.error('Failed to save material in cloud:', e);
      setSyncStatus('offline');
      setSyncError(e instanceof Error ? e.message : 'Endringen er ikke bekreftet lagret i skyen.');
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
        return updatedDb;
      });
      try {
        await syncDeleteMaterial(materialId);
        for (const asgn of relatedAssignments) {
          await syncDeleteAssignment(asgn.id);
        }
        setSyncStatus(supabaseSync.current.hasUnsyncedChanges() ? 'offline' : 'synced');
      } catch (e) {
        console.error('Failed to delete material in cloud:', e);
        setSyncStatus('offline');
        setSyncError(e instanceof Error ? e.message : 'Endringen er ikke bekreftet lagret i skyen.');
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
      return updatedDb;
    });
    try {
      await syncSaveSubject(subjectWithUser);
      setSyncStatus(supabaseSync.current.hasUnsyncedChanges() ? 'offline' : 'synced');
    } catch (e) {
      console.error('Failed to save subject in cloud:', e);
      setSyncStatus('offline');
      setSyncError(e instanceof Error ? e.message : 'Endringen er ikke bekreftet lagret i skyen.');
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
      return updatedDb;
    });
    try {
      await syncDeleteSubject(subjectId);
      for (const mat of materialsToDelete) {
        await syncDeleteMaterial(mat.id);
      }
      setSyncStatus(supabaseSync.current.hasUnsyncedChanges() ? 'offline' : 'synced');
    } catch (e) {
      console.error('Failed to delete subject in cloud:', e);
      setSyncStatus('offline');
      setSyncError(e instanceof Error ? e.message : 'Endringen er ikke bekreftet lagret i skyen.');
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
      return updatedDb;
    });
    try {
      await syncSaveAssignmentsBulk(newAssignments);
      setSyncStatus(supabaseSync.current.hasUnsyncedChanges() ? 'offline' : 'synced');
    } catch (e) {
      console.error('Failed to sync bulk assignments in cloud:', e);
      setSyncStatus('offline');
      setSyncError(e instanceof Error ? e.message : 'Endringen er ikke bekreftet lagret i skyen.');
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
      return updatedDb;
    });

    try {
      await syncSaveSession(sessionWithUser);
      setSyncStatus(supabaseSync.current.hasUnsyncedChanges() ? 'offline' : 'synced');
    } catch (e) {
      console.error('Failed to save session to cloud:', e);
      setSyncStatus('offline');
      setSyncError(e instanceof Error ? e.message : 'Endringen er ikke bekreftet lagret i skyen.');
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

      return updated;
    });

    try {
      await syncDeleteSession(sessionId);
      setSyncStatus(supabaseSync.current.hasUnsyncedChanges() ? 'offline' : 'synced');
    } catch (e) {
      console.error('Failed to delete session in cloud:', e);
      setSyncStatus('offline');
      setSyncError(e instanceof Error ? e.message : 'Endringen er ikke bekreftet lagret i skyen.');
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
      return updatedDb;
    });

    try {
      await Promise.all([
        syncSaveSession(updatedSession),
        syncSaveAssignmentsBulk(newOrUpdatedAssignments),
      ]);
      setSyncStatus(supabaseSync.current.hasUnsyncedChanges() ? 'offline' : 'synced');
    } catch (e) {
      console.error('Failed to sync completed session in cloud:', e);
      setSyncStatus('offline');
      setSyncError(e instanceof Error ? e.message : 'Endringen er ikke bekreftet lagret i skyen.');
    }
  };

  if (authLoading) return <main className="min-h-screen flex items-center justify-center bg-stone-100 text-slate-600">Kontrollerer innlogging …</main>;

  // Guard the workspace before rendering any student data.
  if (!currentUser) {
    return <AuthScreen onAuthenticated={(user) => setCurrentUser(user)} />;
  }

  if (workspaceId !== currentUser.uid) return <main className="min-h-screen flex items-center justify-center">Laster arbeidsområdet …</main>;

  return (
    <div className="min-h-screen bg-[#fbfbfa] text-slate-900 flex flex-col font-sans selection:bg-emerald-100 selection:text-emerald-900">
      
      {syncStatus === 'offline' && <div role="alert" className="bg-amber-50 border-b border-amber-200 px-4 py-3 text-sm text-amber-950">
        Lagring i skyen er ikke bekreftet. {syncError} Ta en sikkerhetskopi før du lukker siden.
        <button className="underline ml-2 font-semibold" onClick={() => setIsBackupOpen(true)}>Åpne sikkerhetskopi</button>
      </div>}
      {/* Top Header */}
      <Header
        db={scopedDb}
        currentUser={currentUser}
        onLogout={handleLogout}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        syncStatus={syncStatus}
        cloudProvider="supabase"
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
          onReloadDatabase={async (newDb) => {
            const owned = {
              ...newDb,
              subjects: newDb.subjects.map(x => ({ ...x, ownerEmail: currentUser.email })),
              students: newDb.students.map(x => ({ ...x, ownerEmail: currentUser.email })),
              materials: newDb.materials.map(x => ({ ...x, ownerEmail: currentUser.email })),
              assignments: newDb.assignments.map(x => ({ ...x, ownerEmail: currentUser.email })),
              sessions: (newDb.sessions || []).map(x => ({ ...x, ownerEmail: currentUser.email })),
            };
            await supabaseSync.current.importFullDatabase(owned);
            setDb(await supabaseSync.current.loadAllData());
            setSyncStatus(supabaseSync.current.hasUnsyncedChanges() ? 'offline' : 'synced');
            setSyncError('');
          }}
          onSyncToCloud={async () => {
            await supabaseSync.current.importFullDatabase(scopedDb);
            setDb(await supabaseSync.current.loadAllData());
            setSyncStatus(supabaseSync.current.hasUnsyncedChanges() ? 'offline' : 'synced');
            setSyncError('');
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
            Supabase • Personlig arbeidsområde
          </span>
        </div>
      </footer>
    </div>
  );
}
