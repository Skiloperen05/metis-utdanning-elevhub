import React, { useState, useMemo } from 'react';
import { 
  Check, 
  Clock, 
  BookOpen, 
  HelpCircle, 
  Filter, 
  Search, 
  ChevronRight, 
  Sparkles, 
  Info, 
  Calendar, 
  Grid, 
  List, 
  Columns, 
  Paperclip, 
  Eye, 
  FileText, 
  UserCheck, 
  CheckCircle2, 
  ExternalLink, 
  ChevronDown,
  Printer,
  Layers
} from 'lucide-react';
import { AppDatabase, Assignment, AssignmentStatus, MaterialCategory, Student, Material, MaterialFile, Subject } from '../types';
import { getCategoryBadgeClass, getCategoryLabel, getStatusBadgeClass, getStatusLabel } from '../lib/helpers';
import { getNextAssignmentStatus } from '../lib/storage';
import { FilePreviewModal } from './FilePreviewModal';

interface ProgressMatrixProps {
  db: AppDatabase;
  onUpdateAssignment: (assignment: Assignment) => void;
  onSelectStudent: (student: Student) => void;
  onSelectMaterial: (material: Material) => void;
  onOpenSessionPlanner?: (defaultStudentId?: string, defaultSubjectId?: string) => void;
  initialSubjectId?: string;
}

export const ProgressMatrix: React.FC<ProgressMatrixProps> = ({
  db,
  onUpdateAssignment,
  onSelectStudent,
  onSelectMaterial,
  onOpenSessionPlanner,
  initialSubjectId = 'all',
}) => {
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(initialSubjectId);

  // Sync selectedSubjectId if initialSubjectId changes
  React.useEffect(() => {
    if (initialSubjectId) {
      setSelectedSubjectId(initialSubjectId);
    }
  }, [initialSubjectId]);
  const [selectedCategory, setSelectedCategory] = useState<MaterialCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Matrix view options:
  // 'matrix' = 2D grid (split per subject when 'all' is selected to eliminate wide scrolling)
  // 'focus' = split master-detail view (grouped by subject on left, student checklist on right)
  const [viewMode, setViewMode] = useState<'matrix' | 'focus'>('matrix');
  const [isCompactColumns, setIsCompactColumns] = useState(true);

  // In focus mode: which material is currently selected
  const [focusMaterialId, setFocusMaterialId] = useState<string | null>(null);

  // Modal states
  const [activeCellModal, setActiveCellModal] = useState<{
    student: Student;
    material: Material;
    assignment?: Assignment;
  } | null>(null);

  const [previewingFile, setPreviewingFile] = useState<MaterialFile | null>(null);

  // Filter materials based on subject and category
  const filteredMaterials = useMemo(() => {
    return db.materials.filter((mat) => {
      const matchesSubject = selectedSubjectId === 'all' || mat.subjectId === selectedSubjectId;
      const matchesCategory = selectedCategory === 'all' || mat.category === selectedCategory;
      const matchesSearch = searchQuery.trim() === '' || 
        mat.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        mat.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (mat.term && mat.term.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesSubject && matchesCategory && matchesSearch;
    });
  }, [db.materials, selectedSubjectId, selectedCategory, searchQuery]);

  // Keep focusMaterialId valid
  const activeFocusMaterial = useMemo(() => {
    if (focusMaterialId) {
      const found = filteredMaterials.find((m) => m.id === focusMaterialId);
      if (found) return found;
    }
    return filteredMaterials[0] || null;
  }, [filteredMaterials, focusMaterialId]);

  // Get active material's subject
  const activeFocusSubject = useMemo(() => {
    if (!activeFocusMaterial) return null;
    return db.subjects.find((s) => s.id === activeFocusMaterial.subjectId) || null;
  }, [activeFocusMaterial, db.subjects]);

  // Filter students based on enrolled subject and search
  const filteredStudents = useMemo(() => {
    return db.students.filter((stud) => {
      const subjectIds = stud.enrolledSubjectIds || [];
      const matchesSubject = selectedSubjectId === 'all' || subjectIds.includes(selectedSubjectId);
      const matchesSearch = searchQuery.trim() === '' || 
        (stud.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (stud.classGroup || '').toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSubject && matchesSearch;
    });
  }, [db.students, selectedSubjectId, searchQuery]);

  // Quick helper to find assignment
  const getAssignment = (studentId: string, materialId: string): Assignment | undefined => {
    return db.assignments.find((a) => a.studentId === studentId && a.materialId === materialId);
  };

  // Quick cycle status on cell click
  const handleCellClick = (student: Student, material: Material, currentAssignment?: Assignment) => {
    const nextStatus = getNextAssignmentStatus(currentAssignment?.status);
    
    const newAssignment: Assignment = {
      id: currentAssignment?.id || `asgn-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      studentId: student.id,
      materialId: material.id,
      status: nextStatus,
      assignedDate: currentAssignment?.assignedDate || new Date().toISOString().slice(0, 10),
      completedDate: nextStatus === 'gjennomgatt' || nextStatus === 'levert' ? new Date().toISOString().slice(0, 10) : undefined,
      teacherNote: currentAssignment?.teacherNote || '',
      studentScore: currentAssignment?.studentScore || '',
    };

    onUpdateAssignment(newAssignment);
  };

  // Direct set status from Focus view
  const handleDirectSetStatus = (studentId: string, materialId: string, status: AssignmentStatus) => {
    const existing = getAssignment(studentId, materialId);
    const newAssignment: Assignment = {
      id: existing?.id || `asgn-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      studentId,
      materialId,
      status,
      assignedDate: existing?.assignedDate || new Date().toISOString().slice(0, 10),
      completedDate: status === 'gjennomgatt' || status === 'levert' ? new Date().toISOString().slice(0, 10) : undefined,
      teacherNote: existing?.teacherNote || '',
      studentScore: existing?.studentScore || '',
    };
    onUpdateAssignment(newAssignment);
  };

  // Render cell content based on status
  const renderCellIndicator = (status?: AssignmentStatus) => {
    switch (status) {
      case 'gjennomgatt':
      case 'levert':
        return (
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-emerald-700 text-white font-bold text-xs shadow-2xs">
            <Check className="w-3.5 h-3.5 stroke-[3]" />
          </span>
        );
      case 'under_arbeid':
        return (
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-amber-500 text-white font-bold text-xs shadow-2xs">
            <Clock className="w-3.5 h-3.5 stroke-[2.5]" />
          </span>
        );
      case 'tildelt':
        return (
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-blue-500 text-white font-bold text-xs shadow-2xs">
            <Calendar className="w-3.5 h-3.5" />
          </span>
        );
      case 'ikke_tildelt':
      default:
        return (
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-stone-100 text-slate-300 font-bold text-xs hover:bg-stone-200">
            –
          </span>
        );
    }
  };

  // Helper for short column headers in compact mode
  const getShortColumnHeader = (mat: Material) => {
    if (mat.category === 'eksamen' && mat.term) {
      return mat.term.replace('Vår ', 'V').replace('Høst ', 'H') + ' Eks';
    }
    const words = mat.title.split(' ');
    if (words.length > 2) {
      return words.slice(0, 2).join(' ');
    }
    return mat.title;
  };

  // Distinct subject badge color helper
  const getSubjectColorClass = (code?: string) => {
    switch (code) {
      case 'MAT1001': // 1T
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'REA3022': // R1
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'MAT1003': // 2P
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'NOR1260': // Norsk
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'REA3011': // Kjemi
        return 'bg-teal-100 text-teal-800 border-teal-300';
      default:
        return 'bg-stone-100 text-slate-800 border-stone-300';
    }
  };

  // Group materials by subject for Focus mode
  const materialsBySubject = useMemo(() => {
    const map = new Map<string, { subject: Subject; materials: Material[] }>();

    db.subjects.forEach((sub) => {
      const mats = filteredMaterials.filter((m) => m.subjectId === sub.id);
      if (mats.length > 0) {
        map.set(sub.id, { subject: sub, materials: mats });
      }
    });

    return Array.from(map.values());
  }, [db.subjects, filteredMaterials]);

  // Render a specific subject's matrix table
  const renderSubjectMatrixTable = (
    subject: Subject,
    materialsToRender: Material[],
    studentsToRender: Student[],
    isStandalone = false
  ) => {
    if (materialsToRender.length === 0 || studentsToRender.length === 0) {
      return null;
    }

    return (
      <div 
        key={subject.id} 
        className={`bg-white rounded-xl border border-stone-200 shadow-2xs overflow-hidden ${!isStandalone ? 'mb-6' : ''}`}
      >
        {/* Subject Header Bar */}
        <div className="bg-stone-50/90 px-4 py-2.5 border-b border-stone-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${getSubjectColorClass(subject.code)}`}>
              {subject.code}
            </span>
            <h3 className="font-bold text-slate-900 text-sm">
              {subject.name}
            </h3>
            <span className="text-[11px] text-slate-500 font-medium">
              • {materialsToRender.length} fagdeler • {studentsToRender.length} elever
            </span>
          </div>

          <div className="flex items-center gap-2">
            {selectedSubjectId === 'all' && (
              <button
                onClick={() => setSelectedSubjectId(subject.id)}
                className="text-[11px] text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-1 bg-white px-2 py-1 rounded border border-stone-200 hover:bg-stone-50 transition-colors"
                title="Vis kun dette faget"
              >
                Fokuser på {subject.name}
                <ChevronRight className="w-3 h-3" />
              </button>
            )}
            {onOpenSessionPlanner && (
              <button
                onClick={() => onOpenSessionPlanner(undefined, subject.id)}
                className="text-[11px] text-slate-700 hover:text-slate-900 font-medium flex items-center gap-1 bg-white px-2 py-1 rounded border border-stone-200 hover:bg-stone-50 transition-colors"
                title="Sett sammen veiledningstime for dette faget"
              >
                <Printer className="w-3 h-3 text-emerald-700" />
                Timepakke / Print
              </button>
            )}
          </div>
        </div>

        {/* The Matrix Table for this Subject */}
        <div className="overflow-x-auto max-h-[60vh]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-stone-50/95 backdrop-blur-xs border-b border-stone-200 sticky top-0 z-10">
                {/* Sticky student column */}
                <th className="p-3 text-xs font-semibold text-slate-700 w-52 min-w-[190px] sticky left-0 bg-stone-50 z-20 border-r border-stone-200 shadow-[2px_0_4px_rgba(0,0,0,0.02)]">
                  <div className="flex items-center justify-between">
                    <span>Elev ({studentsToRender.length})</span>
                    <span className="text-[10px] font-normal text-slate-400">Gjennomført</span>
                  </div>
                </th>

                {/* Subject Material Column Headers */}
                {materialsToRender.map((mat) => {
                  const completedForMat = db.assignments.filter(
                    (a) => a.materialId === mat.id && (a.status === 'gjennomgatt' || a.status === 'levert')
                  ).length;
                  const hasFiles = mat.files && mat.files.length > 0;

                  return (
                    <th
                      key={mat.id}
                      className={`p-2 text-xs font-medium text-slate-800 border-r border-stone-100 hover:bg-stone-100/70 transition-colors cursor-pointer group ${
                        isCompactColumns ? 'w-20 min-w-[75px] max-w-[85px] text-center' : 'min-w-[150px] max-w-[180px]'
                      }`}
                      onClick={() => onSelectMaterial(mat)}
                      title={`${mat.title}\nTermin: ${mat.term || '–'}\nFullført av: ${completedForMat}/${studentsToRender.length}`}
                    >
                      {isCompactColumns ? (
                        <div className="flex flex-col items-center gap-1">
                          <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded truncate max-w-[70px] ${getCategoryBadgeClass(mat.category)}`}>
                            {mat.term ? mat.term.replace('Vår ', 'V').replace('Høst ', 'H') : getCategoryLabel(mat.category).slice(0, 4)}
                          </span>
                          <span className="font-semibold text-slate-900 group-hover:text-emerald-700 transition-colors text-[11px] truncate max-w-[70px]">
                            {getShortColumnHeader(mat)}
                          </span>
                          <div className="flex items-center gap-1 text-[9px] text-slate-400">
                            <span>{completedForMat}/{studentsToRender.length}</span>
                            {hasFiles && (
                              <Paperclip
                                className="w-2.5 h-2.5 text-emerald-700"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPreviewingFile(mat.files![0]);
                                }}
                              />
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${getCategoryBadgeClass(mat.category)}`}>
                              {getCategoryLabel(mat.category)}
                            </span>
                            {mat.term && (
                              <span className="text-[10px] text-slate-400 font-normal">
                                {mat.term}
                              </span>
                            )}
                          </div>
                          <span className="font-semibold text-slate-900 group-hover:text-emerald-700 transition-colors line-clamp-2 leading-snug">
                            {mat.title}
                          </span>
                          <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1 pt-1 border-t border-stone-100">
                            <span>Fullført: <strong>{completedForMat}/{studentsToRender.length}</strong></span>
                            {hasFiles && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPreviewingFile(mat.files![0]);
                                }}
                                className="text-emerald-700 hover:underline flex items-center gap-0.5"
                              >
                                <Paperclip className="w-2.5 h-2.5" /> PDF
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody className="divide-y divide-stone-100 text-xs">
              {studentsToRender.map((student) => {
                const completedCount = materialsToRender.filter((m) => {
                  const a = getAssignment(student.id, m.id);
                  return a?.status === 'gjennomgatt' || a?.status === 'levert';
                }).length;
                const percent = Math.round((completedCount / materialsToRender.length) * 100);

                return (
                  <tr key={student.id} className="hover:bg-stone-50/80 transition-colors">
                    {/* Student Row Header */}
                    <td className="p-3 sticky left-0 bg-white z-10 border-r border-stone-200 shadow-[2px_0_4px_rgba(0,0,0,0.02)]">
                      <div className="flex items-center justify-between">
                        <div 
                          className="flex items-center gap-2 cursor-pointer group"
                          onClick={() => onSelectStudent(student)}
                        >
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${student.avatarBg} shrink-0`}>
                            {student.name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <span className="font-semibold text-slate-900 group-hover:text-emerald-700 transition-colors block truncate text-xs">
                              {student.name}
                            </span>
                            <span className="text-[10px] text-slate-400 block truncate">
                              Mål: {student.targetGrade} • {student.classGroup}
                            </span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="font-semibold text-slate-700 text-[11px]">{percent}%</span>
                          <div className="w-12 bg-stone-100 rounded-full h-1 mt-0.5 overflow-hidden">
                            <div className="bg-emerald-600 h-1 rounded-full" style={{ width: `${percent}%` }} />
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Matrix Cells */}
                    {materialsToRender.map((mat) => {
                      const assignment = getAssignment(student.id, mat.id);
                      return (
                        <td
                          key={mat.id}
                          className="p-1.5 text-center border-r border-stone-100 relative group cursor-pointer hover:bg-stone-100/60 transition-colors"
                          onClick={() => handleCellClick(student, mat, assignment)}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            setActiveCellModal({ student, material: mat, assignment });
                          }}
                        >
                          <div className="flex items-center justify-center">
                            {renderCellIndicator(assignment?.status)}
                          </div>
                          {assignment?.teacherNote && (
                            <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-600" />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      
      {/* Top Filter and Mode Switcher Header */}
      <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-2xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          
          {/* Subject Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
            <button
              onClick={() => setSelectedSubjectId('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-colors ${
                selectedSubjectId === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-stone-100 text-slate-600 hover:bg-stone-200'
              }`}
            >
              Alle fag (Oppdelt per fag)
            </button>
            {db.subjects.map((sub) => {
              const count = db.materials.filter((m) => m.subjectId === sub.id).length;
              const isSelected = selectedSubjectId === sub.id;
              return (
                <button
                  key={sub.id}
                  onClick={() => setSelectedSubjectId(sub.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium shrink-0 transition-colors ${
                    isSelected
                      ? 'bg-emerald-700 text-white shadow-2xs'
                      : 'bg-stone-100 text-slate-700 hover:bg-stone-200'
                  }`}
                >
                  {sub.name}
                  <span className={`ml-1.5 text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                    isSelected ? 'bg-emerald-800 text-emerald-100' : 'bg-stone-200 text-slate-600'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* View Mode Switcher */}
          <div className="flex items-center gap-2 self-start lg:self-center shrink-0">
            <div className="bg-stone-100 p-0.5 rounded-lg flex items-center border border-stone-200">
              <button
                onClick={() => setViewMode('matrix')}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-all ${
                  viewMode === 'matrix'
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Vis hele matrisen med ruter (oppdelt per fag)"
              >
                <Grid className="w-3.5 h-3.5" />
                Matrise-rutenett
              </button>
              <button
                onClick={() => setViewMode('focus')}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-all ${
                  viewMode === 'focus'
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Fokusvisning: Viser oppgavene tydelig gruppert etter fag til venstre og elevsjekkliste til høyre"
              >
                <Columns className="w-3.5 h-3.5" />
                Fokusvisning per oppgave
              </button>
            </div>

            {viewMode === 'matrix' && (
              <button
                onClick={() => setIsCompactColumns(!isCompactColumns)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                  isCompactColumns
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    : 'bg-stone-100 text-slate-700 border-stone-200 hover:bg-stone-200'
                }`}
                title="Slå av/på kompakt rutenett"
              >
                {isCompactColumns ? '⚡ Kompakt' : 'Utvidet'}
              </button>
            )}

            {onOpenSessionPlanner && (
              <button
                onClick={() => onOpenSessionPlanner()}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-700 text-white hover:bg-emerald-800 transition-colors shadow-2xs"
                title="Sett sammen og skriv ut veiledningspakke for time"
              >
                <Printer className="w-3.5 h-3.5" />
                Planlegg time & Print
              </button>
            )}
          </div>

        </div>

        {/* Second Row: Category Filter and Search */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-2 border-t border-stone-100">
          
          {/* Category Filter Chips */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium shrink-0 transition-colors ${
                selectedCategory === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'bg-stone-100 text-slate-600 hover:bg-stone-200'
              }`}
            >
              Alle kategorier ({filteredMaterials.length})
            </button>
            <button
              onClick={() => setSelectedCategory('eksamen')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium shrink-0 transition-colors ${
                selectedCategory === 'eksamen'
                  ? 'bg-purple-700 text-white'
                  : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
              }`}
            >
              Eksamener
            </button>
            <button
              onClick={() => setSelectedCategory('pensum')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium shrink-0 transition-colors ${
                selectedCategory === 'pensum'
                  ? 'bg-blue-700 text-white'
                  : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
              }`}
            >
              Pensum
            </button>
            <button
              onClick={() => setSelectedCategory('lekse')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium shrink-0 transition-colors ${
                selectedCategory === 'lekse'
                  ? 'bg-amber-700 text-white'
                  : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
              }`}
            >
              Lekser
            </button>
            <button
              onClick={() => setSelectedCategory('teori')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium shrink-0 transition-colors ${
                selectedCategory === 'teori'
                  ? 'bg-teal-700 text-white'
                  : 'bg-teal-50 text-teal-700 hover:bg-teal-100'
              }`}
            >
              Teori
            </button>
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Søk i oppgave, termin, elev..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1 text-xs rounded-lg border border-stone-200 bg-stone-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-800"
            />
          </div>

        </div>
      </div>

      {/* MODE 1: MATRIX VIEW (Grouped per Subject to eliminate horizontal marathon scrolling) */}
      {viewMode === 'matrix' && (
        <div>
          {db.subjects.length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed border-stone-300 p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center mx-auto text-slate-400">
                <Grid className="w-6 h-6" />
              </div>
              <div className="max-w-md mx-auto">
                <h3 className="font-semibold text-slate-800 text-sm">Fremdriftsmatrisen er tom</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Det finnes ingen registrerte fag eller materiell ennå. Opprett dine egne fag og fagdeler for å ta i bruk matrisen.
                </p>
              </div>
            </div>
          ) : filteredMaterials.length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed border-stone-300 p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center mx-auto text-slate-400">
                <Grid className="w-6 h-6" />
              </div>
              <div className="max-w-md mx-auto">
                <h3 className="font-semibold text-slate-800 text-sm">Ingen oppgaver eller materiell funnet</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Legg til eksamener, pensumdeler eller leksesett under «Materiellbank» for de opprettede fagene.
                </p>
              </div>
            </div>
          ) : selectedSubjectId === 'all' ? (
            /* RENDER SUBJECT BY SUBJECT: Eliminates 60 columns side-by-side! */
            <div className="space-y-4">
              {db.subjects.map((sub) => {
                const subMaterials = filteredMaterials.filter((m) => m.subjectId === sub.id);
                const subStudents = db.students.filter(
                  (s) => (s.enrolledSubjectIds || []).includes(sub.id) &&
                    (searchQuery.trim() === '' || (s.name || '').toLowerCase().includes(searchQuery.toLowerCase()))
                );

                if (subMaterials.length === 0) return null;

                return renderSubjectMatrixTable(sub, subMaterials, subStudents, false);
              })}
            </div>
          ) : (
            /* SINGLE SUBJECT MATRIX */
            (() => {
              const currentSubject = db.subjects.find((s) => s.id === selectedSubjectId);
              if (!currentSubject) return null;
              return renderSubjectMatrixTable(currentSubject, filteredMaterials, filteredStudents, true);
            })()
          )}

          {/* Legend */}
          <div className="bg-stone-50 p-3 rounded-xl border border-stone-200 text-xs flex flex-wrap items-center justify-between gap-3 mt-4">
            <div className="flex items-center gap-4 flex-wrap">
              <span className="font-semibold text-slate-700">Tegnforklaring:</span>
              <span className="inline-flex items-center gap-1 text-emerald-800 font-medium">
                <span className="w-2.5 h-2.5 rounded bg-emerald-700" /> Gjennomgått / Fullført (✓)
              </span>
              <span className="inline-flex items-center gap-1 text-amber-800 font-medium">
                <span className="w-2.5 h-2.5 rounded bg-amber-500" /> Under arbeid (⏱)
              </span>
              <span className="inline-flex items-center gap-1 text-blue-800 font-medium">
                <span className="w-2.5 h-2.5 rounded bg-blue-500" /> Tildelt (📅)
              </span>
              <span className="inline-flex items-center gap-1 text-slate-400">
                <span className="w-2.5 h-2.5 rounded bg-stone-300" /> Ikke tildelt (–)
              </span>
            </div>

            <div className="text-slate-500 text-[11px]">
              Klikk på en rute for å veksle status • Høyreklikk for notat
            </div>
          </div>
        </div>
      )}

      {/* MODE 2: SPLIT "FOKUSVISNING PER OPPGAVE" (With distinct Subject Grouping & Clear Subject Labels) */}
      {viewMode === 'focus' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          
          {/* Left Column (5 cols): Grouped by SUBJECT so teacher always knows what belongs where */}
          <div className="lg:col-span-5 bg-white rounded-xl border border-stone-200 shadow-2xs overflow-hidden flex flex-col h-[75vh]">
            <div className="bg-stone-50 border-b border-stone-200 p-3 flex items-center justify-between shrink-0">
              <span className="font-semibold text-slate-800 text-xs flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-emerald-700" />
                Fagdeler gruppert etter fag ({filteredMaterials.length})
              </span>
              <span className="text-[10px] text-slate-400">
                Velg oppgave for elevsjekkliste
              </span>
            </div>

            <div className="divide-y divide-stone-100 overflow-y-auto flex-1">
              {materialsBySubject.map(({ subject, materials }) => (
                <div key={subject.id} className="bg-white">
                  {/* Distinct Subject Header Divider */}
                  <div className="bg-stone-100/80 px-3 py-1.5 border-y border-stone-200 sticky top-0 z-10 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${getSubjectColorClass(subject.code)}`}>
                        {subject.code}
                      </span>
                      <span className="font-bold text-slate-800 text-xs">{subject.name}</span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-medium">
                      {materials.length} oppgaver
                    </span>
                  </div>

                  {/* Material items in this subject */}
                  <div className="divide-y divide-stone-100">
                    {materials.map((mat) => {
                      const isSelected = activeFocusMaterial?.id === mat.id;
                      const completedCount = db.assignments.filter(
                        (a) => a.materialId === mat.id && (a.status === 'gjennomgatt' || a.status === 'levert')
                      ).length;
                      const totalStudents = db.students.filter((s) => (s.enrolledSubjectIds || []).includes(mat.subjectId)).length;
                      const pct = totalStudents > 0 ? Math.round((completedCount / totalStudents) * 100) : 0;
                      const hasFiles = mat.files && mat.files.length > 0;

                      return (
                        <div
                          key={mat.id}
                          onClick={() => setFocusMaterialId(mat.id)}
                          className={`p-3 cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-emerald-50/80 border-l-4 border-l-emerald-700 text-slate-900'
                              : 'hover:bg-stone-50 text-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {/* Subject Badge */}
                              <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${getSubjectColorClass(subject.code)}`}>
                                {subject.name.replace('Matematikk ', 'Matte ')}
                              </span>
                              {/* Category Badge */}
                              <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded ${getCategoryBadgeClass(mat.category)}`}>
                                {getCategoryLabel(mat.category)}
                              </span>
                              {mat.term && (
                                <span className="text-[10px] text-slate-500 font-medium bg-stone-100 px-1 py-0.2 rounded">
                                  {mat.term}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-800 shrink-0">
                              {completedCount}/{totalStudents} ferdig ({pct}%)
                            </div>
                          </div>

                          <div className="font-semibold text-xs truncate flex items-center justify-between">
                            <span className="truncate">{mat.title}</span>
                            {hasFiles && (
                              <span className="text-[10px] text-emerald-700 flex items-center gap-0.5 ml-1 shrink-0 font-normal">
                                <Paperclip className="w-2.5 h-2.5" /> PDF
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column (7 cols): Selected Task Detail & Direct Student Checklist */}
          <div className="lg:col-span-7 bg-white rounded-xl border border-stone-200 shadow-2xs overflow-hidden flex flex-col h-[75vh]">
            {activeFocusMaterial && activeFocusSubject ? (
              <>
                {/* Header with Clear Subject Banner */}
                <div className="bg-stone-50 border-b border-stone-200 p-4 shrink-0 space-y-2.5">
                  
                  {/* PROMINENT SUBJECT BANNER */}
                  <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-stone-200">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold px-2.5 py-0.5 rounded-lg border ${getSubjectColorClass(activeFocusSubject.code)} shadow-2xs`}>
                        {activeFocusSubject.name} ({activeFocusSubject.code})
                      </span>
                      <span className="text-xs text-slate-500 font-medium">
                        {activeFocusSubject.level}
                      </span>
                    </div>

                    {/* File preview button if attached */}
                    {activeFocusMaterial.files && activeFocusMaterial.files.length > 0 && (
                      <button
                        onClick={() => setPreviewingFile(activeFocusMaterial.files![0])}
                        className="inline-flex items-center gap-1.5 px-3 py-1 text-xs rounded-lg bg-emerald-700 text-white font-medium hover:bg-emerald-800 shadow-2xs transition-colors"
                        title="Forhåndsvis oppgavehefte eller sensorveiledning"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Forhåndsvis oppgavehefte (PDF)
                      </button>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${getCategoryBadgeClass(activeFocusMaterial.category)}`}>
                        {getCategoryLabel(activeFocusMaterial.category)}
                      </span>
                      {activeFocusMaterial.term && (
                        <span className="text-[10px] text-slate-600 bg-stone-200 px-2 py-0.5 rounded font-medium">
                          {activeFocusMaterial.term}
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold text-slate-900 text-sm sm:text-base">{activeFocusMaterial.title}</h3>
                    <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">
                      {activeFocusMaterial.description}
                    </p>
                  </div>
                </div>

                {/* Checklist of all students for this task */}
                <div className="p-4 flex-1 overflow-y-auto space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-semibold mb-2">
                    <span>Elever påmeldt i {activeFocusSubject.name} ({db.students.filter((s) => (s.enrolledSubjectIds || []).includes(activeFocusMaterial.subjectId)).length}):</span>
                    <span>Status i veiledningstimen</span>
                  </div>

                  <div className="space-y-2">
                    {db.students
                      .filter((s) => (s.enrolledSubjectIds || []).includes(activeFocusMaterial.subjectId))
                      .map((student) => {
                        const asgn = getAssignment(student.id, activeFocusMaterial.id);
                        const status = asgn?.status || 'ikke_tildelt';

                        return (
                          <div
                            key={student.id}
                            className="p-3 rounded-xl border border-stone-200 bg-white hover:border-emerald-300 hover:shadow-2xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                          >
                            <div className="flex items-center gap-2.5">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${student.avatarBg} shrink-0`}>
                                {student.name.charAt(0)}
                              </div>
                              <div>
                                <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                                  <span>{student.name}</span>
                                  <span className="text-[10px] text-slate-400 font-normal">({student.classGroup})</span>
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  Målkarakter: <strong className="text-slate-700">{student.targetGrade}</strong>
                                  {asgn?.studentScore && (
                                    <span className="ml-2 text-emerald-700 font-semibold">
                                      • Resultat: {asgn.studentScore}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Status Buttons */}
                            <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                              <button
                                onClick={() => handleDirectSetStatus(student.id, activeFocusMaterial.id, 'ikke_tildelt')}
                                className={`px-2 py-1 rounded text-[11px] font-medium border transition-colors ${
                                  status === 'ikke_tildelt'
                                    ? 'bg-slate-200 text-slate-800 border-slate-300 font-bold'
                                    : 'bg-stone-50 text-slate-500 border-stone-200 hover:bg-stone-100'
                                }`}
                              >
                                Ikke tildelt
                              </button>
                              <button
                                onClick={() => handleDirectSetStatus(student.id, activeFocusMaterial.id, 'tildelt')}
                                className={`px-2 py-1 rounded text-[11px] font-medium border transition-colors ${
                                  status === 'tildelt'
                                    ? 'bg-blue-600 text-white border-blue-600 font-bold shadow-2xs'
                                    : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                                }`}
                              >
                                Tildelt
                              </button>
                              <button
                                onClick={() => handleDirectSetStatus(student.id, activeFocusMaterial.id, 'under_arbeid')}
                                className={`px-2 py-1 rounded text-[11px] font-medium border transition-colors ${
                                  status === 'under_arbeid'
                                    ? 'bg-amber-500 text-white border-amber-500 font-bold shadow-2xs'
                                    : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                                }`}
                              >
                                Under arbeid
                              </button>
                              <button
                                onClick={() => handleDirectSetStatus(student.id, activeFocusMaterial.id, 'gjennomgatt')}
                                className={`px-2.5 py-1 rounded text-[11px] font-medium border transition-colors flex items-center gap-1 ${
                                  status === 'gjennomgatt' || status === 'levert'
                                    ? 'bg-emerald-700 text-white border-emerald-700 font-bold shadow-2xs'
                                    : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                                }`}
                              >
                                <Check className="w-3 h-3 stroke-[3]" />
                                Gjennomgått
                              </button>
                              <button
                                onClick={() => setActiveCellModal({ student, material: activeFocusMaterial, assignment: asgn })}
                                className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-stone-100"
                                title="Legg til lærernotat eller poengsum"
                              >
                                <Sparkles className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </>
            ) : (
              <div className="p-12 text-center text-slate-400 my-auto">
                <BookOpen className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                <p>Velg en oppgave eller et eksamenssett fra listen til venstre for å registrere fremdrift.</p>
              </div>
            )}
          </div>

        </div>
      )}

      {/* Quick Cell Edit Modal */}
      {activeCellModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 border border-stone-200 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-slate-900 text-sm">Gjennomgangsdetaljer</h3>
                <p className="text-xs text-slate-500">
                  {activeCellModal.student.name} • {activeCellModal.material.title}
                </p>
              </div>
              <button
                onClick={() => setActiveCellModal(null)}
                className="text-slate-400 hover:text-slate-700 text-xs px-2 py-1 rounded"
              >
                Lukk
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-medium mb-1">Status</label>
                <select
                  value={activeCellModal.assignment?.status || 'ikke_tildelt'}
                  onChange={(e) => {
                    const status = e.target.value as AssignmentStatus;
                    const updated: Assignment = {
                      id: activeCellModal.assignment?.id || `asgn-${Date.now()}`,
                      studentId: activeCellModal.student.id,
                      materialId: activeCellModal.material.id,
                      status,
                      assignedDate: activeCellModal.assignment?.assignedDate || new Date().toISOString().slice(0, 10),
                      completedDate: status === 'gjennomgatt' || status === 'levert' ? new Date().toISOString().slice(0, 10) : undefined,
                      teacherNote: activeCellModal.assignment?.teacherNote || '',
                      studentScore: activeCellModal.assignment?.studentScore || '',
                    };
                    onUpdateAssignment(updated);
                    setActiveCellModal({ ...activeCellModal, assignment: updated });
                  }}
                  className="w-full p-2 border border-stone-300 rounded-lg bg-white"
                >
                  <option value="ikke_tildelt">Ikke tildelt</option>
                  <option value="tildelt">Tildelt / Lekse gitt</option>
                  <option value="under_arbeid">Under arbeid</option>
                  <option value="gjennomgatt">Gjennomgått i time</option>
                  <option value="levert">Fullført / Levert</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Lærernotat / Veiledningskommentar</label>
                <textarea
                  rows={3}
                  value={activeCellModal.assignment?.teacherNote || ''}
                  placeholder="F.eks. Gjennomgikk oppgave 3 og 4 i veiledningstimen, eleven forsto formelen."
                  onChange={(e) => {
                    const updated: Assignment = {
                      id: activeCellModal.assignment?.id || `asgn-${Date.now()}`,
                      studentId: activeCellModal.student.id,
                      materialId: activeCellModal.material.id,
                      status: activeCellModal.assignment?.status || 'ikke_tildelt',
                      assignedDate: activeCellModal.assignment?.assignedDate || new Date().toISOString().slice(0, 10),
                      completedDate: activeCellModal.assignment?.completedDate,
                      teacherNote: e.target.value,
                      studentScore: activeCellModal.assignment?.studentScore || '',
                    };
                    onUpdateAssignment(updated);
                    setActiveCellModal({ ...activeCellModal, assignment: updated });
                  }}
                  className="w-full p-2 border border-stone-300 rounded-lg bg-white"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Elevens poengsum / delkarakter (valgfritt)</label>
                <input
                  type="text"
                  value={activeCellModal.assignment?.studentScore || ''}
                  placeholder="F.eks. 5+, 42/50p eller Bestått"
                  onChange={(e) => {
                    const updated: Assignment = {
                      id: activeCellModal.assignment?.id || `asgn-${Date.now()}`,
                      studentId: activeCellModal.student.id,
                      materialId: activeCellModal.material.id,
                      status: activeCellModal.assignment?.status || 'ikke_tildelt',
                      assignedDate: activeCellModal.assignment?.assignedDate || new Date().toISOString().slice(0, 10),
                      completedDate: activeCellModal.assignment?.completedDate,
                      teacherNote: activeCellModal.assignment?.teacherNote || '',
                      studentScore: e.target.value,
                    };
                    onUpdateAssignment(updated);
                    setActiveCellModal({ ...activeCellModal, assignment: updated });
                  }}
                  className="w-full p-2 border border-stone-300 rounded-lg bg-white"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setActiveCellModal(null)}
                className="px-4 py-1.5 bg-emerald-700 text-white rounded-lg font-medium hover:bg-emerald-800 shadow-2xs text-xs"
              >
                Ferdig
              </button>
            </div>
          </div>
        </div>
      )}

      {/* File Preview Modal */}
      {previewingFile && (
        <FilePreviewModal
          file={previewingFile}
          onClose={() => setPreviewingFile(null)}
        />
      )}

    </div>
  );
};
