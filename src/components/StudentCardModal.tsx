import React, { useState, useMemo } from 'react';
import { 
  X, 
  Target, 
  BookOpen, 
  CheckCircle2, 
  Clock, 
  Calendar, 
  Plus, 
  Edit3, 
  Trash2, 
  MessageSquare, 
  FileText, 
  Award, 
  ExternalLink,
  Save,
  AlertTriangle,
  Paperclip,
  Eye,
  Printer,
  Download,
  ChevronDown,
  ChevronUp,
  Check,
  CheckSquare,
  Square,
  Search,
  ArrowUpDown,
  Filter,
  Sparkles
} from 'lucide-react';
import { 
  AppDatabase, 
  Student, 
  Assignment, 
  AssignmentStatus, 
  MasteryLevel, 
  StudentNote, 
  MaterialCategory,
  Material,
  MaterialFile,
  PlannedSession
} from '../types';
import { 
  getCategoryBadgeClass, 
  getCategoryLabel, 
  getMasteryBadgeClass, 
  getMasteryLabel, 
  getStatusBadgeClass, 
  getStatusLabel 
} from '../lib/helpers';
import { getNextAssignmentStatus } from '../lib/storage';
import { FilePreviewModal } from './FilePreviewModal';
import { generateStudentReportPDF } from '../lib/studentReportPdf';
import { generateSessionPacketPDF } from '../lib/sessionPdfGenerator';

interface StudentCardModalProps {
  student: Student;
  db: AppDatabase;
  onClose: () => void;
  onUpdateStudent: (updatedStudent: Student) => void;
  onDeleteStudent: (studentId: string) => void;
  onUpdateAssignment: (assignment: Assignment) => void;
  onDeleteAssignment: (assignmentId: string) => void;
  onOpenAssignForStudent: (student: Student) => void;
  onOpenSessionPlannerForStudent?: (student: Student, sessionToEdit?: PlannedSession) => void;
  onUpdateSession?: (session: PlannedSession) => void;
  onCompleteSession?: (sessionId: string, completedMaterialIds?: string[]) => void;
  onDeleteSession?: (sessionId: string) => void;
}

export const StudentCardModal: React.FC<StudentCardModalProps> = ({
  student,
  db,
  onClose,
  onUpdateStudent,
  onDeleteStudent,
  onUpdateAssignment,
  onDeleteAssignment,
  onOpenAssignForStudent,
  onOpenSessionPlannerForStudent,
  onUpdateSession,
  onCompleteSession,
  onDeleteSession,
}) => {
  const [activeTab, setActiveTab] = useState<'materialer' | 'timer' | 'profil' | 'notater'>('materialer');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<MaterialCategory | 'all'>('all');
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);

  const studentSessions = useMemo(() => {
    return (db.sessions || []).filter((s) => s.studentId === student.id);
  }, [db.sessions, student.id]);

  // Editing profile fields
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [name, setName] = useState(student.name);
  const [email, setEmail] = useState(student.email);
  const [phone, setPhone] = useState(student.phone || '');
  const [classGroup, setClassGroup] = useState(student.classGroup);
  const [targetGrade, setTargetGrade] = useState(student.targetGrade);
  const [currentMastery, setCurrentMastery] = useState<MasteryLevel>(student.currentMastery);
  const [strengths, setStrengths] = useState(student.strengths);
  const [areasToImprove, setAreasToImprove] = useState(student.areasToImprove);
  const [personalGoals, setPersonalGoals] = useState(student.personalGoals);
  const [specialConsiderations, setSpecialConsiderations] = useState(student.specialConsiderations || '');
  const [enrolledSubjectIds, setEnrolledSubjectIds] = useState<string[]>(student.enrolledSubjectIds);

  // Notes & Guidance Log State
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);
  const [isEditingNote, setIsEditingNote] = useState<boolean>(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [showNoteForm, setShowNoteForm] = useState<boolean>(false);

  // Form fields for session note
  const [sessionDate, setSessionDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [sessionType, setSessionType] = useState<'oppfølging' | 'time' | 'varsel' | 'mestring'>('time');
  const [sessionDurationMinutes, setSessionDurationMinutes] = useState<number>(60);
  const [sessionTopicsCovered, setSessionTopicsCovered] = useState<string>('');
  const [sessionContent, setSessionContent] = useState<string>('');
  const [sessionHomework, setSessionHomework] = useState<string>('');
  const [sessionCoveredMaterialIds, setSessionCoveredMaterialIds] = useState<string[]>([]);
  const [autoMarkCompleted, setAutoMarkCompleted] = useState<boolean>(true);

  // Session material picker filter, search and sort state
  const [sessionMaterialFilter, setSessionMaterialFilter] = useState<'alle' | 'ikke_gjennomgatt' | 'gjennomgatt'>('alle');
  const [sessionMaterialSearch, setSessionMaterialSearch] = useState<string>('');
  const [sessionMaterialSort, setSessionMaterialSort] = useState<'ikke_gjennomgatt_forst' | 'gjennomgatt_forst' | 'tittel'>('ikke_gjennomgatt_forst');

  // Delete confirmation state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [previewingFile, setPreviewingFile] = useState<MaterialFile | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  // Subject helpers for student
  const availableSubjectsToAdd = useMemo(() => {
    return db.subjects.filter((s) => !enrolledSubjectIds.includes(s.id));
  }, [db.subjects, enrolledSubjectIds]);

  const handleAddSubjectToStudent = (subjectId: string) => {
    if (!subjectId || enrolledSubjectIds.includes(subjectId)) return;
    const updatedIds = [...enrolledSubjectIds, subjectId];
    setEnrolledSubjectIds(updatedIds);
    onUpdateStudent({
      ...student,
      enrolledSubjectIds: updatedIds,
    });
  };

  const handleRemoveSubjectFromStudent = (subjectId: string) => {
    const updatedIds = enrolledSubjectIds.filter((id) => id !== subjectId);
    setEnrolledSubjectIds(updatedIds);
    onUpdateStudent({
      ...student,
      enrolledSubjectIds: updatedIds,
    });
  };

  // Materials relevant for this student's subjects
  const studentSubjectMaterials = useMemo(() => {
    if (enrolledSubjectIds.length === 0) return db.materials;
    return db.materials.filter((m) => enrolledSubjectIds.includes(m.subjectId));
  }, [db.materials, enrolledSubjectIds]);

  // Map of student's progress and status for each material
  const studentMaterialStatusMap = useMemo(() => {
    const map = new Map<string, {
      status?: AssignmentStatus;
      isGjennomgatt: boolean;
      completedDate?: string;
      sessionCount: number;
    }>();

    // 1. Direct assignments
    const studentAssignments = db.assignments.filter((a) => a.studentId === student.id);
    for (const a of studentAssignments) {
      const isGjennomgatt = a.status === 'gjennomgatt' || a.status === 'levert';
      map.set(a.materialId, {
        status: a.status,
        isGjennomgatt,
        completedDate: a.completedDate,
        sessionCount: 0,
      });
    }

    // 2. Student notes with coveredMaterialIds
    for (const note of student.notes || []) {
      for (const matId of note.coveredMaterialIds || []) {
        const existing = map.get(matId);
        if (existing) {
          existing.isGjennomgatt = true;
          existing.sessionCount = (existing.sessionCount || 0) + 1;
          existing.completedDate = existing.completedDate || note.date;
        } else {
          map.set(matId, {
            status: 'gjennomgatt',
            isGjennomgatt: true,
            completedDate: note.date,
            sessionCount: 1,
          });
        }
      }
    }

    // 3. Sessions in db.sessions
    for (const s of (db.sessions || [])) {
      if (s.studentId !== student.id) continue;
      const isCompleted = s.status === 'gjennomfort';
      for (const item of s.items || []) {
        const itemDone = isCompleted || item.completed === true;
        const existing = map.get(item.materialId);
        if (existing) {
          existing.sessionCount = (existing.sessionCount || 0) + 1;
          if (itemDone) {
            existing.isGjennomgatt = true;
            existing.completedDate = existing.completedDate || s.date;
          }
        } else {
          map.set(item.materialId, {
            status: itemDone ? 'gjennomgatt' : 'tildelt',
            isGjennomgatt: itemDone,
            completedDate: itemDone ? s.date : undefined,
            sessionCount: 1,
          });
        }
      }
    }

    return map;
  }, [db.assignments, db.sessions, student.id, student.notes]);

  // Session material stats
  const sessionMaterialStats = useMemo(() => {
    let completed = 0;
    for (const mat of studentSubjectMaterials) {
      if (studentMaterialStatusMap.get(mat.id)?.isGjennomgatt) {
        completed++;
      }
    }
    return {
      total: studentSubjectMaterials.length,
      completed,
      uncompleted: studentSubjectMaterials.length - completed,
    };
  }, [studentSubjectMaterials, studentMaterialStatusMap]);

  // Processed materials for session logging
  const processedSessionMaterials = useMemo(() => {
    let list = [...studentSubjectMaterials];

    if (sessionMaterialSearch.trim()) {
      const q = sessionMaterialSearch.toLowerCase().trim();
      list = list.filter((m) =>
        m.title.toLowerCase().includes(q) ||
        (m.description && m.description.toLowerCase().includes(q)) ||
        (m.term && m.term.toLowerCase().includes(q)) ||
        getCategoryLabel(m.category).toLowerCase().includes(q)
      );
    }

    if (sessionMaterialFilter === 'ikke_gjennomgatt') {
      list = list.filter((m) => !studentMaterialStatusMap.get(m.id)?.isGjennomgatt);
    } else if (sessionMaterialFilter === 'gjennomgatt') {
      list = list.filter((m) => !!studentMaterialStatusMap.get(m.id)?.isGjennomgatt);
    }

    list.sort((a, b) => {
      const aDone = !!studentMaterialStatusMap.get(a.id)?.isGjennomgatt;
      const bDone = !!studentMaterialStatusMap.get(b.id)?.isGjennomgatt;

      if (sessionMaterialSort === 'ikke_gjennomgatt_forst') {
        if (aDone !== bDone) return aDone ? 1 : -1;
        return a.title.localeCompare(b.title, 'nb');
      }
      if (sessionMaterialSort === 'gjennomgatt_forst') {
        if (aDone !== bDone) return aDone ? -1 : 1;
        return a.title.localeCompare(b.title, 'nb');
      }
      return a.title.localeCompare(b.title, 'nb');
    });

    return list;
  }, [studentSubjectMaterials, sessionMaterialSearch, sessionMaterialFilter, sessionMaterialSort, studentMaterialStatusMap]);

  const handleDownloadReport = () => {
    setIsGeneratingReport(true);
    try {
      const report = generateStudentReportPDF({
        student,
        subjects: db.subjects,
        materials: db.materials,
        assignments: db.assignments,
      });
      report.save();
    } catch (err) {
      console.error('Failed to generate student report PDF:', err);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  // Assignments for this student
  const studentAssignments = db.assignments.filter((a) => a.studentId === student.id);

  // Find material details for each assignment
  const assignmentsWithMaterials = studentAssignments.map((a) => {
    const mat = db.materials.find((m) => m.id === a.materialId);
    return { assignment: a, material: mat };
  }).filter((item) => item.material !== undefined) as { assignment: Assignment; material: Material }[];

  // Filtered by subject and category
  const filteredItems = assignmentsWithMaterials.filter(({ assignment, material }) => {
    const matchesSubject = selectedSubjectFilter === 'all' || material.subjectId === selectedSubjectFilter;
    const matchesCategory = selectedCategoryFilter === 'all' || material.category === selectedCategoryFilter;
    return matchesSubject && matchesCategory;
  });

  const completedCount = studentAssignments.filter(
    (a) => a.status === 'gjennomgatt' || a.status === 'levert'
  ).length;

  const handleSaveProfile = () => {
    const updated: Student = {
      ...student,
      name,
      email,
      phone,
      classGroup,
      targetGrade: Number(targetGrade),
      currentMastery,
      strengths,
      areasToImprove,
      personalGoals,
      specialConsiderations,
      enrolledSubjectIds,
    };
    onUpdateStudent(updated);
    setIsEditingProfile(false);
  };

  const handleStartNewNote = () => {
    setEditingNoteId(null);
    setIsEditingNote(false);
    setSessionDate(new Date().toISOString().slice(0, 10));
    setSessionType('time');
    setSessionDurationMinutes(60);
    setSessionTopicsCovered('');
    setSessionContent('');
    setSessionHomework('');
    setSessionCoveredMaterialIds([]);
    setAutoMarkCompleted(true);
    setShowNoteForm(true);
  };

  const handleEditNote = (note: StudentNote) => {
    setEditingNoteId(note.id);
    setIsEditingNote(true);
    setSessionDate(note.date);
    setSessionType(note.type);
    setSessionDurationMinutes(note.durationMinutes || 60);
    setSessionTopicsCovered(note.topicsCovered || '');
    setSessionContent(note.content);
    setSessionHomework(note.homeworkOrNextSteps || '');
    setSessionCoveredMaterialIds(note.coveredMaterialIds || []);
    setAutoMarkCompleted(false);
    setShowNoteForm(true);
    setExpandedNoteId(note.id);
  };

  const handleDeleteNote = (noteId: string) => {
    if (window.confirm('Er du sikker på at du vil slette denne veiledningstimen/notatet?')) {
      const updatedNotes = (student.notes || []).filter((n) => n.id !== noteId);
      onUpdateStudent({
        ...student,
        notes: updatedNotes,
      });
      if (expandedNoteId === noteId) setExpandedNoteId(null);
      if (editingNoteId === noteId) {
        setShowNoteForm(false);
        setIsEditingNote(false);
        setEditingNoteId(null);
      }
    }
  };

  const toggleCoveredMaterialId = (materialId: string) => {
    setSessionCoveredMaterialIds((prev) =>
      prev.includes(materialId) ? prev.filter((id) => id !== materialId) : [...prev, materialId]
    );
  };

  const handleSaveNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionContent.trim() && !sessionTopicsCovered.trim()) return;

    const currentNotes = student.notes || [];
    let updatedNotes: StudentNote[];

    if (editingNoteId) {
      updatedNotes = currentNotes.map((n) =>
        n.id === editingNoteId
          ? {
              ...n,
              date: sessionDate,
              type: sessionType,
              durationMinutes: sessionDurationMinutes,
              topicsCovered: sessionTopicsCovered.trim(),
              content: sessionContent.trim(),
              homeworkOrNextSteps: sessionHomework.trim(),
              coveredMaterialIds: sessionCoveredMaterialIds,
            }
          : n
      );
    } else {
      const newNote: StudentNote = {
        id: `note-${Date.now()}`,
        date: sessionDate,
        author: 'Lærer',
        type: sessionType,
        durationMinutes: sessionDurationMinutes,
        topicsCovered: sessionTopicsCovered.trim(),
        content: sessionContent.trim(),
        homeworkOrNextSteps: sessionHomework.trim(),
        coveredMaterialIds: sessionCoveredMaterialIds,
      };
      updatedNotes = [newNote, ...currentNotes];
    }

    onUpdateStudent({
      ...student,
      notes: updatedNotes,
    });

    if (autoMarkCompleted && sessionCoveredMaterialIds.length > 0) {
      sessionCoveredMaterialIds.forEach((matId) => {
        const existing = db.assignments.find((a) => a.studentId === student.id && a.materialId === matId);
        if (existing) {
          if (existing.status !== 'gjennomgatt') {
            onUpdateAssignment({
              ...existing,
              status: 'gjennomgatt',
              completedDate: sessionDate,
            });
          }
        } else {
          onUpdateAssignment({
            id: `asgn-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            studentId: student.id,
            materialId: matId,
            status: 'gjennomgatt',
            assignedDate: sessionDate,
            completedDate: sessionDate,
          });
        }
      });
    }

    setShowNoteForm(false);
    setIsEditingNote(false);
    setEditingNoteId(null);
    setSessionContent('');
    setSessionTopicsCovered('');
    setSessionHomework('');
    setSessionCoveredMaterialIds([]);
  };

  const handleToggleSubject = (subjectId: string) => {
    if (enrolledSubjectIds.includes(subjectId)) {
      setEnrolledSubjectIds(enrolledSubjectIds.filter((id) => id !== subjectId));
    } else {
      setEnrolledSubjectIds([...enrolledSubjectIds, subjectId]);
    }
  };

  const handleDownloadSessionPdf = (session: PlannedSession) => {
    const subject = db.subjects.find((s) => s.id === session.subjectId);
    if (!subject) return;

    const chosenMaterials = session.items
      .map((item) => db.materials.find((m) => m.id === item.materialId))
      .filter((m): m is Material => m !== undefined);

    const customNotes = Object.fromEntries(
      session.items.map((i) => [i.materialId, i.customNote || ''])
    );

    try {
      const pdf = generateSessionPacketPDF({
        sessionTitle: session.title,
        sessionDate: session.date,
        sessionTime: session.time,
        sessionGoals: session.goals || '',
        teacherNotes: session.teacherNotes || '',
        student,
        subject,
        materials: chosenMaterials,
        customItemNotes: customNotes,
        includeTaskWorksheets: session.includeWorksheets !== false,
        worksheetsToInclude: session.items.map((i) => i.materialId),
      });

      pdf.save();
      setSessionNotice(`Timehefte for ${student.name} ble lastet ned!`);
      setTimeout(() => setSessionNotice(null), 3500);
    } catch (e) {
      console.error('Feil ved nedlasting av timehefte:', e);
    }
  };

  const handleToggleSessionItem = (session: PlannedSession, materialId: string) => {
    if (!onUpdateSession) return;
    const itemToToggle = session.items.find((i) => i.materialId === materialId);
    const willBeCompleted = !itemToToggle?.completed;

    const updatedItems = session.items.map((item) => {
      if (item.materialId === materialId) {
        return { ...item, completed: !item.completed };
      }
      return item;
    });

    const allCompleted = updatedItems.length > 0 && updatedItems.every((i) => i.completed);

    const updatedSession: PlannedSession = {
      ...session,
      items: updatedItems,
      status: allCompleted ? 'gjennomfort' : session.status,
      completedAt: allCompleted ? (session.completedAt || new Date().toISOString()) : session.completedAt,
    };

    onUpdateSession(updatedSession);

    // If marked completed, update student assignment to 'gjennomgatt' in the matrix too!
    if (willBeCompleted) {
      const today = new Date().toISOString().slice(0, 10);
      const existing = db.assignments.find(
        (a) => a.studentId === student.id && a.materialId === materialId
      );
      if (existing) {
        onUpdateAssignment({
          ...existing,
          status: 'gjennomgatt',
          completedDate: today,
        });
      } else {
        onUpdateAssignment({
          id: `asgn-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          studentId: student.id,
          materialId,
          status: 'gjennomgatt',
          assignedDate: session.date || today,
          completedDate: today,
        });
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full border border-stone-200 shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        
        {/* Modal Header Banner */}
        <div className="bg-stone-50 border-b border-stone-200 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-lg ${student.avatarBg} shrink-0 shadow-xs`}
              >
                {student.name.charAt(0)}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-bold text-slate-900">{student.name}</h2>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-900 text-white font-semibold">
                    Målkarakter: {student.targetGrade}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${getMasteryBadgeClass(student.currentMastery)}`}>
                    {getMasteryLabel(student.currentMastery)}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 flex-wrap">
                  <span>{student.classGroup}</span>
                  {student.email && <span>• {student.email}</span>}
                  {student.phone && <span>• Tlf: {student.phone}</span>}
                </div>

                {/* Enrolled subjects pill selector with quick add/remove */}
                <div className="flex items-center gap-1.5 flex-wrap mt-2.5">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Fag:</span>
                  {enrolledSubjectIds.length === 0 && (
                    <span className="text-xs text-slate-400 italic">Ingen fag registrert</span>
                  )}
                  {enrolledSubjectIds.map((subId) => {
                    const sub = db.subjects.find((s) => s.id === subId);
                    if (!sub) return null;
                    return (
                      <span
                        key={sub.id}
                        className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md bg-stone-100 border border-stone-200 text-slate-800 font-medium group"
                      >
                        <span>{sub.code || sub.name}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveSubjectFromStudent(sub.id)}
                          className="text-slate-400 hover:text-rose-600 rounded p-0.5 transition-colors"
                          title={`Fjern ${sub.name} fra eleven`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    );
                  })}

                  {/* Quick Add Subject Dropdown */}
                  {availableSubjectsToAdd.length > 0 && (
                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value) {
                          handleAddSubjectToStudent(e.target.value);
                        }
                      }}
                      className="text-xs py-0.5 px-2 bg-white border border-dashed border-stone-300 rounded-md text-emerald-700 hover:border-emerald-500 font-medium cursor-pointer focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="">+ Legg til fag...</option>
                      {availableSubjectsToAdd.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.code} - {s.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              {onOpenSessionPlannerForStudent && (
                <button
                  type="button"
                  onClick={() => onOpenSessionPlannerForStudent(student)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 text-white font-bold hover:bg-emerald-800 transition-colors text-xs shadow-2xs cursor-pointer"
                  title="Planlegg 1 time for denne eleven"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Planlegg time</span>
                </button>
              )}
              <button
                onClick={handleDownloadReport}
                disabled={isGeneratingReport}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-stone-300 text-slate-700 font-medium hover:bg-stone-50 transition-colors text-xs shadow-2xs"
                title="Last ned fullstendig A4-elevrapport i PDF med måloppnåelse og oppgaveliste"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>{isGeneratingReport ? 'Lager PDF...' : 'Elevrapport'}</span>
              </button>
              <button
                onClick={() => setIsEditingProfile(!isEditingProfile)}
                className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-stone-200/60 transition-colors"
                title="Rediger elevkort"
              >
                <Edit3 className="w-4 h-4" />
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-stone-200/60 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Quick Tabs */}
          <div className="flex items-center gap-2 mt-5 border-t border-stone-200 pt-3 overflow-x-auto pb-1">
            <button
              onClick={() => setActiveTab('materialer')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer ${
                activeTab === 'materialer'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-stone-200/50'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Gjennomgått & Materialer ({studentAssignments.length})
            </button>
            <button
              onClick={() => setActiveTab('timer')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer ${
                activeTab === 'timer'
                  ? 'bg-emerald-700 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-stone-200/50'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              Veiledningstimer ({studentSessions.length})
            </button>
            <button
              onClick={() => setActiveTab('profil')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer ${
                activeTab === 'profil'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-stone-200/50'
              }`}
            >
              <Target className="w-3.5 h-3.5" />
              Mestring, Mål & Fag
            </button>
            <button
              onClick={() => setActiveTab('notater')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer ${
                activeTab === 'notater'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-stone-200/50'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Veiledningslogg ({student.notes?.length || 0})
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-6">
          
          {/* TAB 1: Materialer & Gjennomgang */}
          {activeTab === 'materialer' && (
            <div className="space-y-4">
              {/* Filter and assign button bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-stone-50 p-3 rounded-xl border border-stone-200 text-xs">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-slate-500 font-medium">Filter:</span>
                  <select
                    value={selectedSubjectFilter}
                    onChange={(e) => setSelectedSubjectFilter(e.target.value)}
                    className="p-1.5 rounded-md border border-stone-300 bg-white"
                  >
                    <option value="all">Alle elevens fag</option>
                    {db.subjects
                      .filter((s) => student.enrolledSubjectIds.includes(s.id))
                      .map((sub) => (
                        <option key={sub.id} value={sub.id}>
                          {sub.name}
                        </option>
                      ))}
                  </select>

                  <select
                    value={selectedCategoryFilter}
                    onChange={(e) => setSelectedCategoryFilter(e.target.value as MaterialCategory | 'all')}
                    className="p-1.5 rounded-md border border-stone-300 bg-white"
                  >
                    <option value="all">Alle typer</option>
                    <option value="eksamen">Eksamen</option>
                    <option value="pensum">Pensum</option>
                    <option value="lekse">Lekser</option>
                    <option value="teori">Teori</option>
                    <option value="prove">Prøver</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-slate-600 font-medium">
                    Gjennomført: <strong>{completedCount}</strong> av <strong>{studentAssignments.length}</strong>
                  </span>
                  {onOpenSessionPlannerForStudent && (
                    <button
                      onClick={() => onOpenSessionPlannerForStudent(student)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-300 font-medium hover:bg-emerald-100 transition-colors shadow-2xs"
                      title="Sett sammen timepakke med oppgaver og skriv ut for denne eleven"
                    >
                      <Printer className="w-3.5 h-3.5 text-emerald-700" />
                      Planlegg time & Print
                    </button>
                  )}
                  <button
                    onClick={() => onOpenAssignForStudent(student)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-700 text-white font-medium hover:bg-emerald-800 transition-colors shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Tildel pensum/lekse
                  </button>
                </div>
              </div>

              {/* List of assignments */}
              {filteredItems.length === 0 ? (
                <div className="text-center py-10 text-slate-400 bg-stone-50/50 rounded-xl border border-dashed border-stone-200">
                  <FileText className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                  <p className="font-medium text-slate-600 text-xs">Ingen fagdeler tildelt med disse filtrene.</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Trykk på &quot;Tildel pensum/lekse&quot; for å knytte eksamener eller oppgaver til {student.name}.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredItems.map(({ assignment, material }) => {
                    const subject = db.subjects.find((s) => s.id === material.subjectId);

                    return (
                      <div
                        key={assignment.id}
                        className="bg-white rounded-xl border border-stone-200 p-4 shadow-2xs hover:border-slate-300 transition-all space-y-2"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-start gap-2.5">
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${getCategoryBadgeClass(material.category)} shrink-0 mt-0.5`}>
                              {getCategoryLabel(material.category)}
                            </span>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-semibold text-slate-900 text-sm">{material.title}</h4>
                                {material.files && material.files.length > 0 && (
                                  <button
                                    onClick={() => setPreviewingFile(material.files![0])}
                                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-200 transition-colors"
                                    title="Forhåndsvis oppgavehefte / PDF"
                                  >
                                    <Paperclip className="w-3 h-3" />
                                    PDF
                                  </button>
                                )}
                                {material.externalUrl && (
                                  <a
                                    href={material.externalUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-slate-400 hover:text-slate-600"
                                    title="Åpne ressurslenke"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </a>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 mt-0.5">
                                Fag: <strong className="text-slate-700">{subject?.name || 'Fag'}</strong>
                                {material.term && ` • ${material.term}`}
                                {assignment.completedDate && ` • Gjennomgått ${assignment.completedDate}`}
                              </p>
                            </div>
                          </div>

                          {/* Quick status cycle button */}
                          <div className="flex items-center gap-2">
                            <select
                              value={assignment.status}
                              onChange={(e) => {
                                const newStatus = e.target.value as AssignmentStatus;
                                onUpdateAssignment({
                                  ...assignment,
                                  status: newStatus,
                                  completedDate:
                                    newStatus === 'gjennomgatt' || newStatus === 'levert'
                                      ? new Date().toISOString().slice(0, 10)
                                      : undefined,
                                });
                              }}
                              className={`text-xs font-semibold px-2.5 py-1 rounded-lg border focus:outline-none ${getStatusBadgeClass(
                                assignment.status
                              )}`}
                            >
                              <option value="ikke_tildelt">Ikke tildelt</option>
                              <option value="tildelt">Tildelt / Lekse gitt</option>
                              <option value="under_arbeid">Under arbeid</option>
                              <option value="gjennomgatt">Gjennomgått i time</option>
                              <option value="levert">Fullført / Levert</option>
                            </select>

                            <button
                              onClick={() => onDeleteAssignment(assignment.id)}
                              className="text-slate-300 hover:text-rose-600 p-1 rounded transition-colors"
                              title="Fjern tildeling fra elev"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Teacher notes / guidance note for this specific item */}
                        <div className="pt-2 border-t border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                          <div className="flex-1">
                            <input
                              type="text"
                              placeholder="Notat om gjennomgang i time eller tilbakemelding..."
                              value={assignment.teacherNote || ''}
                              onChange={(e) => {
                                onUpdateAssignment({
                                  ...assignment,
                                  teacherNote: e.target.value,
                                });
                              }}
                              className="w-full text-xs text-slate-700 bg-stone-50/70 border border-stone-200 rounded px-2.5 py-1 focus:bg-white focus:outline-none"
                            />
                          </div>

                          <div className="w-full sm:w-44">
                            <input
                              type="text"
                              placeholder="Poeng / Karakter (f.eks 5)"
                              value={assignment.studentScore || ''}
                              onChange={(e) => {
                                onUpdateAssignment({
                                  ...assignment,
                                  studentScore: e.target.value,
                                });
                              }}
                              className="w-full text-xs text-indigo-700 font-medium bg-indigo-50/40 border border-indigo-200 rounded px-2.5 py-1 focus:bg-white focus:outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB: Veiledningstimer */}
          {activeTab === 'timer' && (
            <div className="space-y-4">
              {/* Session tab header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-stone-50 p-4 rounded-xl border border-stone-200">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-emerald-700" />
                    Veiledningstimer for {student.name}
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Her ser du alle planlagte og gjennomførte timer. Når du markerer en time som ferdig, blir oppgavene automatisk registrert som «Gjennomgått» i elevens matrise.
                  </p>
                </div>

                {onOpenSessionPlannerForStudent && (
                  <button
                    type="button"
                    onClick={() => onOpenSessionPlannerForStudent(student)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 text-white font-bold hover:bg-emerald-800 transition-colors text-xs shadow-2xs shrink-0 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Planlegg ny time</span>
                  </button>
                )}
              </div>

              {sessionNotice && (
                <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>{sessionNotice}</span>
                </div>
              )}

              {/* Sessions list */}
              {studentSessions.length === 0 ? (
                <div className="bg-white border border-stone-200 rounded-2xl p-8 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-stone-100 text-slate-400 flex items-center justify-center mx-auto">
                    <Calendar className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm">
                    Ingen veiledningstimer er planlagt for {student.name} ennå
                  </h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto">
                    Planlegg 1 time for å sette sammen oppgavesett, definere mål og sensorfokus, og last ned ferdig utskriftshefte. Timen lagres her slik at du kan markere den som gjort med ett klikk.
                  </p>
                  {onOpenSessionPlannerForStudent && (
                    <button
                      type="button"
                      onClick={() => onOpenSessionPlannerForStudent(student)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 text-white font-bold hover:bg-emerald-800 transition-colors text-xs shadow-2xs cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Planlegg første time</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {studentSessions.map((session) => {
                    const subject = db.subjects.find((s) => s.id === session.subjectId);
                    const isDone = session.status === 'gjennomfort';
                    const itemsCount = session.items?.length || 0;
                    const completedCount = (session.items || []).filter((i) => i.completed).length;

                    return (
                      <div
                        key={session.id}
                        className={`p-4 rounded-xl border transition-all ${
                          isDone
                            ? 'bg-stone-50/50 border-stone-200'
                            : 'bg-white border-emerald-300 ring-1 ring-emerald-500/10 shadow-2xs'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-100">
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg text-center font-bold text-xs shrink-0 ${
                              isDone ? 'bg-stone-100 text-slate-600' : 'bg-emerald-100 text-emerald-800'
                            }`}>
                              <div className="text-[10px] uppercase">
                                {new Date(session.date).toLocaleDateString('no-NO', { weekday: 'short' })}
                              </div>
                              <div className="text-base font-extrabold leading-none my-0.5">
                                {new Date(session.date).getDate()}
                              </div>
                              <div className="text-[10px]">
                                {new Date(session.date).toLocaleDateString('no-NO', { month: 'short' })}
                              </div>
                            </div>

                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  isDone ? 'bg-emerald-100 text-emerald-800' : 'bg-emerald-600 text-white'
                                }`}>
                                  {isDone ? '✓ Gjennomført' : 'Planlagt time'}
                                </span>
                                {subject && (
                                  <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-stone-100 text-slate-700 border border-stone-200">
                                    {subject.code} • {subject.name}
                                  </span>
                                )}
                                <span className="text-xs text-slate-500 flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-slate-400" />
                                  kl. {session.time}
                                </span>
                              </div>

                              <h5 className="font-bold text-slate-900 text-sm">
                                {session.title}
                              </h5>

                              {session.goals && (
                                <p className="text-xs text-slate-600 italic">
                                  «{session.goals}»
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-wrap shrink-0">
                            {!isDone ? (
                              <button
                                type="button"
                                onClick={() => {
                                  onCompleteSession?.(session.id, session.items.map((i) => i.materialId));
                                  setSessionNotice(`Timen og alle ${session.items.length} oppgaver ble registrert som gjennomgått i fremdriftsmatrisen!`);
                                  setTimeout(() => setSessionNotice(null), 4000);
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 text-white font-bold hover:bg-emerald-800 transition-colors text-xs shadow-2xs cursor-pointer"
                                title="Marker som gjennomført og oppdater elevens oppgaver automatisk i appen"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Marker som gjort</span>
                              </button>
                            ) : (
                              <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Fullført</span>
                              </span>
                            )}

                            <button
                              type="button"
                              onClick={() => handleDownloadSessionPdf(session)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-stone-300 bg-white text-slate-700 hover:bg-stone-50 transition-colors text-xs font-medium cursor-pointer"
                              title="Last ned timehefte i PDF"
                            >
                              <Download className="w-3.5 h-3.5 text-slate-500" />
                              <span>PDF</span>
                            </button>

                            {onOpenSessionPlannerForStudent && (
                              <button
                                type="button"
                                onClick={() => onOpenSessionPlannerForStudent(student, session)}
                                className="p-1.5 rounded-lg border border-stone-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-stone-50 transition-colors text-xs cursor-pointer"
                                title="Rediger time"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {onDeleteSession && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (window.confirm(`Er du sikker på at du vil slette denne veiledningstimen?`)) {
                                    onDeleteSession(session.id);
                                  }
                                }}
                                className="p-1.5 rounded-lg border border-stone-200 bg-white text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors text-xs cursor-pointer"
                                title="Slett time"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Items in this session */}
                        {itemsCount > 0 && (
                          <div className="pt-3 space-y-2 text-xs">
                            <div className="font-semibold text-slate-700 text-[11px] flex items-center justify-between">
                              <span>Oppgaver planlagt for timen ({completedCount}/{itemsCount} utført):</span>
                              <span className="text-slate-400 font-normal">Kryss av underveis i timen</span>
                            </div>

                            <div className="space-y-1.5">
                              {session.items.map((item, idx) => {
                                const mat = db.materials.find((m) => m.id === item.materialId);
                                const isItemDone = item.completed;

                                return (
                                  <div
                                    key={item.materialId}
                                    className={`p-2 rounded-lg border flex items-center justify-between gap-2 text-xs ${
                                      isItemDone
                                        ? 'bg-emerald-50/50 border-emerald-200 text-emerald-900'
                                        : 'bg-stone-50 border-stone-200 text-slate-800'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                      <button
                                        type="button"
                                        onClick={() => handleToggleSessionItem(session, item.materialId)}
                                        className="text-slate-500 hover:text-emerald-700 cursor-pointer shrink-0"
                                      >
                                        {isItemDone ? (
                                          <CheckSquare className="w-3.5 h-3.5 text-emerald-700" />
                                        ) : (
                                          <Square className="w-3.5 h-3.5 text-slate-400" />
                                        )}
                                      </button>
                                      <span className="font-medium truncate">
                                        {idx + 1}. {mat?.title || 'Materiale'}
                                      </span>
                                      {mat && (
                                        <span className={`text-[10px] px-1.5 py-0.2 rounded shrink-0 ${getCategoryBadgeClass(mat.category)}`}>
                                          {getCategoryLabel(mat.category)}
                                        </span>
                                      )}
                                    </div>

                                    {item.customNote && (
                                      <span className="text-[10px] text-slate-500 italic max-w-xs truncate">
                                        {item.customNote}
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Profil, Mål & Mestring */}
          {activeTab === 'profil' && (
            <div className="space-y-5 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Mål & Mestring */}
                <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 space-y-3">
                  <h4 className="font-semibold text-slate-900 text-sm flex items-center gap-1.5">
                    <Target className="w-4 h-4 text-emerald-600" />
                    Målsetting & Mestringsnivå
                  </h4>

                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Målkarakter (1-6)</label>
                    <input
                      type="number"
                      min={1}
                      max={6}
                      value={targetGrade}
                      disabled={!isEditingProfile}
                      onChange={(e) => setTargetGrade(Number(e.target.value))}
                      className="w-full p-2 border border-stone-300 rounded-lg bg-white disabled:bg-stone-100"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Nåværende mestringsnivå</label>
                    <select
                      value={currentMastery}
                      disabled={!isEditingProfile}
                      onChange={(e) => setCurrentMastery(e.target.value as MasteryLevel)}
                      className="w-full p-2 border border-stone-300 rounded-lg bg-white disabled:bg-stone-100"
                    >
                      <option value="lav">Trenger grunnleggende støtte</option>
                      <option value="middels">Middels mestring</option>
                      <option value="god">God mestring</option>
                      <option value="svart_god">Svært høy måloppnåelse</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Personlige mål & studieambisjoner</label>
                    <textarea
                      rows={3}
                      value={personalGoals}
                      disabled={!isEditingProfile}
                      onChange={(e) => setPersonalGoals(e.target.value)}
                      placeholder="F.eks. Oppnå karakter 5 i R1 for å komme inn på sivilingeniør..."
                      className="w-full p-2 border border-stone-300 rounded-lg bg-white disabled:bg-stone-100"
                    />
                  </div>
                </div>

                {/* Styrker & Utviklingsområder */}
                <div className="bg-stone-50 p-4 rounded-xl border border-stone-200 space-y-3">
                  <h4 className="font-semibold text-slate-900 text-sm flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-indigo-600" />
                    Faglig kompetanse & Fokus
                  </h4>

                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Faglige styrker</label>
                    <textarea
                      rows={2}
                      value={strengths}
                      disabled={!isEditingProfile}
                      onChange={(e) => setStrengths(e.target.value)}
                      placeholder="Hva eleven mestrer godt..."
                      className="w-full p-2 border border-stone-300 rounded-lg bg-white disabled:bg-stone-100"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Områder med behov for oppfølging</label>
                    <textarea
                      rows={2}
                      value={areasToImprove}
                      disabled={!isEditingProfile}
                      onChange={(e) => setAreasToImprove(e.target.value)}
                      placeholder="Hva læreren bør fokusere på i timene..."
                      className="w-full p-2 border border-stone-300 rounded-lg bg-white disabled:bg-stone-100"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-medium mb-1">Spesielle hensyn / Tilrettelegging</label>
                    <input
                      type="text"
                      value={specialConsiderations}
                      disabled={!isEditingProfile}
                      onChange={(e) => setSpecialConsiderations(e.target.value)}
                      placeholder="F.eks. Utvidet tid på eksamen, dysleksi, tospråklig..."
                      className="w-full p-2 border border-stone-300 rounded-lg bg-white disabled:bg-stone-100"
                    />
                  </div>
                </div>
              </div>

              {/* Enrolled Subjects Checkboxes */}
              <div className="bg-stone-50 p-4 rounded-xl border border-stone-200">
                <label className="block text-slate-700 font-semibold mb-2">Fag eleven tar hos Metis:</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {db.subjects.map((sub) => {
                    const isChecked = enrolledSubjectIds.includes(sub.id);
                    return (
                      <label
                        key={sub.id}
                        className={`flex items-center gap-2 p-2 rounded-lg border transition-colors ${
                          isChecked
                            ? 'bg-white border-emerald-400 text-slate-900 shadow-2xs'
                            : 'bg-white/50 border-stone-200 text-slate-500'
                        } ${isEditingProfile ? 'cursor-pointer' : 'cursor-default'}`}
                      >
                        <input
                          type="checkbox"
                          disabled={!isEditingProfile}
                          checked={isChecked}
                          onChange={() => handleToggleSubject(sub.id)}
                          className="rounded text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="font-medium text-xs">{sub.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Action buttons for saving profile */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="inline-flex items-center gap-1.5 text-xs text-rose-600 hover:text-rose-800 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Slett elev
                </button>

                {isEditingProfile ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsEditingProfile(false)}
                      className="px-3 py-1.5 rounded-lg border border-stone-300 text-slate-600 hover:bg-stone-100 text-xs"
                    >
                      Avbryt
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveProfile}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-slate-900 text-white font-medium hover:bg-slate-800 text-xs shadow-2xs"
                    >
                      <Save className="w-3.5 h-3.5" />
                      Lagre endringer
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsEditingProfile(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-slate-100 text-slate-800 font-medium hover:bg-slate-200 text-xs border border-stone-300"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Rediger profil
                  </button>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: Veiledningslogg & Notater */}
          {activeTab === 'notater' && (
            <div className="space-y-4 text-xs">
              {/* Header and Add Session button */}
              <div className="flex items-center justify-between bg-stone-50 p-3.5 rounded-xl border border-stone-200">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4 text-slate-700" />
                    Veiledningslogg & Timer ({student.notes?.length || 0})
                  </h4>
                  <p className="text-slate-500 text-xs mt-0.5">
                    Trykk på en tidligere time for å se og redigere detaljer, hva som ble gjennomgått og lekser.
                  </p>
                </div>
                {!showNoteForm && (
                  <button
                    type="button"
                    onClick={handleStartNewNote}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900 text-white font-medium hover:bg-slate-800 text-xs shadow-2xs shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Loggfør veiledningstime
                  </button>
                )}
              </div>

              {/* Form to add or edit session / note */}
              {showNoteForm && (
                <form onSubmit={handleSaveNote} className="bg-white p-4 sm:p-5 rounded-xl border border-stone-300 shadow-sm space-y-4">
                  <div className="flex items-center justify-between border-b border-stone-200 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                        <Calendar className="w-4 h-4 text-emerald-700" />
                      </div>
                      <h4 className="font-bold text-slate-900 text-sm">
                        {isEditingNote ? 'Rediger veiledningstime / notat' : 'Loggfør ny veiledningstime'}
                      </h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowNoteForm(false);
                        setIsEditingNote(false);
                        setEditingNoteId(null);
                      }}
                      className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-stone-100"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Dato for timen</label>
                      <input
                        type="date"
                        required
                        value={sessionDate}
                        onChange={(e) => setSessionDate(e.target.value)}
                        className="w-full p-2 border border-stone-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-800"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Varighet</label>
                      <select
                        value={sessionDurationMinutes}
                        onChange={(e) => setSessionDurationMinutes(Number(e.target.value))}
                        className="w-full p-2 border border-stone-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-800"
                      >
                        <option value={30}>30 minutter</option>
                        <option value={45}>45 minutter</option>
                        <option value={60}>60 minutter (standard)</option>
                        <option value={90}>90 minutter (dobbeltime)</option>
                        <option value={120}>120 minutter</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Type notat</label>
                      <div className="grid grid-cols-2 gap-1">
                        {(['time', 'oppfølging', 'varsel', 'mestring'] as const).map((t) => (
                          <button
                            type="button"
                            key={t}
                            onClick={() => setSessionType(t)}
                            className={`px-2 py-1 rounded text-[11px] font-medium capitalize border ${
                              sessionType === t
                                ? 'bg-slate-900 text-white border-slate-900'
                                : 'bg-white text-slate-600 border-stone-200 hover:bg-stone-50'
                            }`}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Hva ble gjennomgått i timen? (Tema / fokus)
                    </label>
                    <input
                      type="text"
                      placeholder="f.eks. Derivasjon, produktregelen, Eksamen V24 Del 1 oppgave 2 og 3"
                      value={sessionTopicsCovered}
                      onChange={(e) => setSessionTopicsCovered(e.target.value)}
                      className="w-full p-2 border border-stone-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-800"
                    />
                  </div>

                  {/* Pick covered materials */}
                  <div className="space-y-2">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                      <div>
                        <div className="flex items-center gap-2">
                          <label className="font-semibold text-slate-800 text-xs sm:text-sm">
                            Knytt oppgaver & fagmateriell til timen
                          </label>
                          <span className="text-[11px] px-2 py-0.2 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                            {sessionCoveredMaterialIds.length} valgt
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500">
                          Gjennomgått materiell er markert med grønt ikon og merke.
                        </p>
                      </div>

                      {/* Quick select buttons */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            const uncompletedIds = studentSubjectMaterials
                              .filter((m) => !studentMaterialStatusMap.get(m.id)?.isGjennomgatt)
                              .map((m) => m.id);
                            setSessionCoveredMaterialIds((prev) => Array.from(new Set([...prev, ...uncompletedIds])));
                          }}
                          disabled={sessionMaterialStats.uncompleted === 0}
                          className="px-2 py-1 text-[11px] font-semibold bg-emerald-700 text-white rounded hover:bg-emerald-800 disabled:opacity-40 transition-colors flex items-center gap-1 cursor-pointer"
                          title="Velg alle oppgaver som eleven ikke har gjennomgått ennå"
                        >
                          <Sparkles className="w-3 h-3" />
                          Velg ubehandlede ({sessionMaterialStats.uncompleted})
                        </button>
                        {sessionCoveredMaterialIds.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setSessionCoveredMaterialIds([])}
                            className="px-2 py-1 text-[11px] font-medium text-slate-600 bg-white border border-stone-300 rounded hover:bg-stone-50 transition-colors cursor-pointer"
                          >
                            Nullstill
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Filter and search bar */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-1 border-t border-stone-200">
                      {/* Filter tabs */}
                      <div className="flex items-center gap-1 bg-stone-200/80 p-0.5 rounded-lg text-xs overflow-x-auto shrink-0">
                        <button
                          type="button"
                          onClick={() => setSessionMaterialFilter('alle')}
                          className={`px-2 py-1 rounded font-semibold transition-all whitespace-nowrap cursor-pointer text-[11px] ${
                            sessionMaterialFilter === 'alle'
                              ? 'bg-white text-slate-900 shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Alle ({sessionMaterialStats.total})
                        </button>
                        <button
                          type="button"
                          onClick={() => setSessionMaterialFilter('ikke_gjennomgatt')}
                          className={`px-2 py-1 rounded font-semibold transition-all flex items-center gap-1 whitespace-nowrap cursor-pointer text-[11px] ${
                            sessionMaterialFilter === 'ikke_gjennomgatt'
                              ? 'bg-white text-emerald-950 shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"></span>
                          <span>Ikke gjennomgått ({sessionMaterialStats.uncompleted})</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setSessionMaterialFilter('gjennomgatt')}
                          className={`px-2 py-1 rounded font-semibold transition-all flex items-center gap-1 whitespace-nowrap cursor-pointer text-[11px] ${
                            sessionMaterialFilter === 'gjennomgatt'
                              ? 'bg-white text-emerald-950 shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          <CheckCircle2 className="w-3 h-3 text-emerald-700 shrink-0" />
                          <span>Gjennomgått ({sessionMaterialStats.completed})</span>
                        </button>
                      </div>

                      {/* Search and Sort */}
                      <div className="flex items-center gap-1.5 flex-1 sm:justify-end">
                        <div className="relative flex-1 sm:max-w-[180px]">
                          <Search className="w-3 h-3 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <input
                            type="text"
                            placeholder="Søk i materiell..."
                            value={sessionMaterialSearch}
                            onChange={(e) => setSessionMaterialSearch(e.target.value)}
                            className="w-full pl-6 pr-5 py-1 text-[11px] bg-white border border-stone-300 rounded focus:outline-none focus:border-emerald-600"
                          />
                          {sessionMaterialSearch && (
                            <button
                              type="button"
                              onClick={() => setSessionMaterialSearch('')}
                              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-[10px] cursor-pointer"
                            >
                              ✕
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <ArrowUpDown className="w-3 h-3 text-slate-500" />
                          <select
                            value={sessionMaterialSort}
                            onChange={(e) => setSessionMaterialSort(e.target.value as any)}
                            className="py-1 px-1.5 text-[11px] font-semibold bg-white border border-stone-300 rounded text-slate-700 cursor-pointer focus:outline-none focus:border-emerald-600"
                          >
                            <option value="ikke_gjennomgatt_forst">⭐ Ikke gjennomgått først</option>
                            <option value="gjennomgatt_forst">✓ Gjennomgått først</option>
                            <option value="tittel">Alfabetisk</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="max-h-52 overflow-y-auto border border-stone-200 rounded-lg p-2 bg-stone-50/50 space-y-1.5">
                      {studentSubjectMaterials.length === 0 ? (
                        <p className="text-slate-400 text-[11px] py-4 text-center">Ingen fagmateriell tilgjengelig for elevens fag.</p>
                      ) : processedSessionMaterials.length === 0 ? (
                        <p className="text-slate-500 text-[11px] py-3 text-center">
                          {sessionMaterialFilter === 'ikke_gjennomgatt'
                            ? `Alt materiell er allerede gjennomgått med ${student.name.split(' ')[0]}!`
                            : sessionMaterialFilter === 'gjennomgatt'
                            ? `Ingen oppgaver er markert som gjennomgått med ${student.name.split(' ')[0]} ennå.`
                            : 'Ingen oppgaver matcher søket.'}
                        </p>
                      ) : (
                        processedSessionMaterials.map((mat) => {
                          const isChecked = sessionCoveredMaterialIds.includes(mat.id);
                          const statusInfo = studentMaterialStatusMap.get(mat.id);
                          const isGjennomgatt = !!statusInfo?.isGjennomgatt;
                          return (
                            <label
                              key={mat.id}
                              className={`flex items-center justify-between p-2 rounded-lg transition-colors cursor-pointer border ${
                                isChecked
                                  ? 'bg-emerald-50/90 border-emerald-400 text-slate-900 font-medium shadow-2xs'
                                  : isGjennomgatt
                                  ? 'bg-emerald-50/20 border-emerald-200 hover:border-emerald-300 text-slate-700'
                                  : 'bg-white border-stone-200 hover:border-emerald-300 text-slate-700'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0 pr-2">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleCoveredMaterialId(mat.id)}
                                  className="rounded text-emerald-600 focus:ring-emerald-500"
                                />
                                <div className="min-w-0">
                                  <div className="text-xs truncate font-medium text-slate-900">{mat.title}</div>
                                  {mat.term && <span className="text-[10px] text-slate-400">{mat.term}</span>}
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${getCategoryBadgeClass(mat.category)}`}>
                                  {getCategoryLabel(mat.category)}
                                </span>
                                {isGjennomgatt ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-700 shrink-0" />
                                    <span>Gjennomgått</span>
                                    {statusInfo.completedDate && (
                                      <span className="text-emerald-800 font-normal opacity-80">({statusInfo.completedDate})</span>
                                    )}
                                  </span>
                                ) : statusInfo?.status === 'under_arbeid' ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                                    Under arbeid
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-stone-100 text-slate-500 border border-stone-200">
                                    Ikke gjennomgått
                                  </span>
                                )}
                              </div>
                            </label>
                          );
                        })
                      )}
                    </div>

                    {sessionCoveredMaterialIds.length > 0 && (
                      <label className="flex items-center gap-2 mt-2 text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={autoMarkCompleted}
                          onChange={(e) => setAutoMarkCompleted(e.target.checked)}
                          className="rounded text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="text-[11px] font-medium">
                          Merk valgte oppgaver som <strong>«Gjennomgått»</strong> i fremdriftsmatrisen automatisk
                        </span>
                      </label>
                    )}
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Vurdering & Veiledernotat
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Skriv hva som fungerte, elevens forståelse, utfordringer som oppstod..."
                      value={sessionContent}
                      onChange={(e) => setSessionContent(e.target.value)}
                      className="w-full p-2.5 border border-stone-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Lekser / Avtale til neste veiledningstime (valgfritt)
                    </label>
                    <input
                      type="text"
                      placeholder="f.eks. Regne oppgave 1–4 i eksamenssettet til neste tirsdag"
                      value={sessionHomework}
                      onChange={(e) => setSessionHomework(e.target.value)}
                      className="w-full p-2 border border-stone-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-800"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
                    <button
                      type="button"
                      onClick={() => {
                        setShowNoteForm(false);
                        setIsEditingNote(false);
                        setEditingNoteId(null);
                      }}
                      className="px-3 py-1.5 rounded-lg border border-stone-300 text-slate-600 hover:bg-stone-100"
                    >
                      Avbryt
                    </button>
                    <button
                      type="submit"
                      disabled={!sessionContent.trim() && !sessionTopicsCovered.trim()}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-slate-900 text-white font-medium hover:bg-slate-800 disabled:opacity-50 shadow-2xs"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{isEditingNote ? 'Oppdater time' : 'Lagre veiledningstime'}</span>
                    </button>
                  </div>
                </form>
              )}

              {/* List of notes & sessions */}
              <div className="space-y-3">
                {(!student.notes || student.notes.length === 0) ? (
                  <div className="text-center py-10 bg-stone-50 rounded-xl border border-stone-200 space-y-2">
                    <MessageSquare className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="font-semibold text-slate-700">Ingen veiledningstimer eller notater logget ennå</p>
                    <p className="text-slate-400 text-xs">
                      Bruk knappen ovenfor for å loggføre hva som ble gjennomgått i dag.
                    </p>
                  </div>
                ) : (
                  student.notes.map((note) => {
                    const isExpanded = expandedNoteId === note.id;
                    const coveredMaterials = (note.coveredMaterialIds || [])
                      .map((id) => db.materials.find((m) => m.id === id))
                      .filter(Boolean) as Material[];

                    return (
                      <div
                        key={note.id}
                        className={`bg-white rounded-xl border transition-all shadow-2xs overflow-hidden ${
                          isExpanded ? 'border-emerald-400 ring-1 ring-emerald-400/20' : 'border-stone-200 hover:border-stone-300'
                        }`}
                      >
                        {/* Clickable Card Header */}
                        <div
                          onClick={() => setExpandedNoteId(isExpanded ? null : note.id)}
                          className="p-3.5 sm:p-4 cursor-pointer hover:bg-stone-50/70 transition-colors flex items-start justify-between gap-3 select-none"
                        >
                          <div className="space-y-1.5 flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap text-[11px]">
                              <span className="font-bold text-slate-800 flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                {note.date}
                              </span>
                              {note.durationMinutes && (
                                <span className="text-slate-500 flex items-center gap-1 bg-stone-100 px-2 py-0.5 rounded font-medium">
                                  <Clock className="w-3 h-3 text-slate-400" />
                                  {note.durationMinutes} min
                                </span>
                              )}
                              <span
                                className={`font-semibold uppercase tracking-wider px-2 py-0.5 rounded text-[10px] ${
                                  note.type === 'time'
                                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                    : note.type === 'oppfølging'
                                    ? 'bg-blue-50 text-blue-800 border border-blue-200'
                                    : note.type === 'mestring'
                                    ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                                }`}
                              >
                                {note.type}
                              </span>
                              <span className="text-slate-400">• {note.author}</span>
                            </div>

                            {note.topicsCovered && (
                              <div className="font-semibold text-slate-900 text-xs">
                                Tema: {note.topicsCovered}
                              </div>
                            )}

                            {/* Note summary snippet */}
                            <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                              {note.content}
                            </p>

                            {/* Covered materials badges preview */}
                            {coveredMaterials.length > 0 && (
                              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                                <span className="text-[11px] text-slate-400 font-medium">Gjennomgått:</span>
                                {coveredMaterials.map((mat) => (
                                  <span
                                    key={mat.id}
                                    className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded bg-stone-100 text-slate-700 border border-stone-200"
                                  >
                                    <BookOpen className="w-3 h-3 text-emerald-600" />
                                    {mat.title}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-1 shrink-0 pt-0.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditNote(note);
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-stone-200/60 transition-colors"
                              title="Rediger denne timen"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteNote(note.id);
                              }}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                              title="Slett denne timen"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                            <div className="p-1.5 text-slate-400">
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </div>
                          </div>
                        </div>

                        {/* Expanded Details Section */}
                        {isExpanded && (
                          <div className="p-4 border-t border-stone-100 bg-stone-50/60 space-y-3.5 text-xs">
                            {/* Topics */}
                            {note.topicsCovered && (
                              <div>
                                <h5 className="font-semibold text-slate-500 text-[11px] uppercase tracking-wider mb-1">
                                  Temaer gjennomgått
                                </h5>
                                <div className="p-2.5 bg-white rounded-lg border border-stone-200 font-medium text-slate-900">
                                  {note.topicsCovered}
                                </div>
                              </div>
                            )}

                            {/* Full Note Content */}
                            <div>
                              <h5 className="font-semibold text-slate-500 text-[11px] uppercase tracking-wider mb-1">
                                Veilederens notat & observasjoner
                              </h5>
                              <div className="p-2.5 bg-white rounded-lg border border-stone-200 text-slate-800 leading-relaxed whitespace-pre-wrap">
                                {note.content}
                              </div>
                            </div>

                            {/* Covered Materials detailed cards with file preview */}
                            {coveredMaterials.length > 0 && (
                              <div>
                                <h5 className="font-semibold text-slate-500 text-[11px] uppercase tracking-wider mb-1.5">
                                  Gjennomgåtte oppgaver og fagmateriell ({coveredMaterials.length})
                                </h5>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {coveredMaterials.map((mat) => {
                                    const asgn = db.assignments.find((a) => a.studentId === student.id && a.materialId === mat.id);
                                    return (
                                      <div
                                        key={mat.id}
                                        className="p-2.5 bg-white rounded-lg border border-stone-200 flex items-center justify-between gap-2 shadow-2xs"
                                      >
                                        <div className="min-w-0">
                                          <div className="font-semibold text-slate-900 truncate">{mat.title}</div>
                                          <div className="flex items-center gap-1.5 mt-0.5">
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${getCategoryBadgeClass(mat.category)}`}>
                                              {getCategoryLabel(mat.category)}
                                            </span>
                                            {asgn && (
                                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${getStatusBadgeClass(asgn.status)}`}>
                                                {getStatusLabel(asgn.status)}
                                              </span>
                                            )}
                                          </div>
                                        </div>

                                        {/* File preview button if files exist */}
                                        {mat.files && mat.files.length > 0 && (
                                          <button
                                            type="button"
                                            onClick={() => setPreviewingFile(mat.files![0])}
                                            className="p-1.5 rounded-lg bg-stone-100 hover:bg-emerald-100 text-slate-600 hover:text-emerald-800 transition-colors shrink-0"
                                            title={`Se ${mat.files[0].name}`}
                                          >
                                            <Eye className="w-3.5 h-3.5" />
                                          </button>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Homework / Next Steps */}
                            {note.homeworkOrNextSteps && (
                              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-1">
                                <div className="font-bold text-amber-900 text-xs flex items-center gap-1.5">
                                  <Target className="w-3.5 h-3.5 text-amber-700" />
                                  Avtale til neste veiledningstime / lekser
                                </div>
                                <p className="text-amber-950 leading-relaxed pl-5 whitespace-pre-wrap">
                                  {note.homeworkOrNextSteps}
                                </p>
                              </div>
                            )}

                            {/* Footer action buttons in detail view */}
                            <div className="flex items-center justify-between pt-2 border-t border-stone-200/60">
                              <button
                                type="button"
                                onClick={() => handleDeleteNote(note.id)}
                                className="inline-flex items-center gap-1 text-rose-600 hover:text-rose-800 font-medium"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Slett time</span>
                              </button>

                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setExpandedNoteId(null)}
                                  className="px-2.5 py-1 rounded-md border border-stone-300 bg-white text-slate-700 hover:bg-stone-50"
                                >
                                  Lukk detaljer
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleEditNote(note)}
                                  className="inline-flex items-center gap-1 px-3 py-1 rounded-md bg-slate-900 text-white font-medium hover:bg-slate-800 shadow-2xs"
                                >
                                  <Edit3 className="w-3 h-3" />
                                  <span>Rediger time</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Delete Confirmation Alert */}
        {showDeleteConfirm && (
          <div className="p-4 bg-rose-50 border-t border-rose-200 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-rose-800">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>Er du sikker på at du vil slette {student.name}? Dette sletter også alle elevens tildelinger.</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3 py-1 bg-white border border-rose-200 rounded text-slate-700 hover:bg-stone-100"
              >
                Avbryt
              </button>
              <button
                onClick={() => {
                  onDeleteStudent(student.id);
                  onClose();
                }}
                className="px-3 py-1 bg-rose-600 text-white rounded font-medium hover:bg-rose-700 shadow-2xs"
              >
                Ja, slett elev
              </button>
            </div>
          </div>
        )}

        {previewingFile && (
          <FilePreviewModal
            file={previewingFile}
            onClose={() => setPreviewingFile(null)}
          />
        )}
      </div>
    </div>
  );
};
