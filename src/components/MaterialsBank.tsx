import React, { useState, useMemo } from 'react';
import { 
  BookOpen, 
  Search, 
  Plus, 
  ExternalLink, 
  CheckCircle2, 
  Users, 
  Edit2, 
  Trash2, 
  Send, 
  FileText,
  ChevronRight,
  Folder,
  ArrowLeft,
  Paperclip,
  Eye,
  Info,
  Layers,
  GraduationCap,
  Clock,
  ChevronDown,
  Check
} from 'lucide-react';
import { AppDatabase, Material, MaterialCategory, AssignmentStatus, MaterialFile, Subject } from '../types';
import { getCategoryBadgeClass, getCategoryLabel, getStatusBadgeClass, getStatusLabel } from '../lib/helpers';
import { FilePreviewModal } from './FilePreviewModal';

interface MaterialsBankProps {
  db: AppDatabase;
  onOpenNewMaterial: (defaultSubjectId?: string) => void;
  onEditMaterial: (material: Material) => void;
  onDeleteMaterial: (materialId: string) => void;
  onOpenAssignForMaterial: (material: Material) => void;
  onQuickToggleStudentAssignment: (studentId: string, materialId: string, nextStatus: AssignmentStatus) => void;
  onOpenNewSubject?: () => void;
  onEditSubject?: (subject: Subject) => void;
}

export const MaterialsBank: React.FC<MaterialsBankProps> = ({
  db,
  onOpenNewMaterial,
  onEditMaterial,
  onDeleteMaterial,
  onOpenAssignForMaterial,
  onQuickToggleStudentAssignment,
  onOpenNewSubject,
  onEditSubject,
}) => {
  // Navigation state: null = fagoversikt (viser mapper for alle fag); subjectId = inne i faget
  const [activeSubjectId, setActiveSubjectId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<MaterialCategory | 'all'>('all');
  const [selectedMaterialForDetail, setSelectedMaterialForDetail] = useState<Material | null>(null);
  const [previewingFile, setPreviewingFile] = useState<MaterialFile | null>(null);

  // Active subject
  const currentSubject = useMemo(() => {
    if (!activeSubjectId) return null;
    return db.subjects.find((s) => s.id === activeSubjectId) || null;
  }, [db.subjects, activeSubjectId]);

  // Materials for active subject (or all if activeSubjectId is null)
  const filteredMaterials = useMemo(() => {
    return db.materials.filter((mat) => {
      const matchesSubject = !activeSubjectId || mat.subjectId === activeSubjectId;
      const matchesCategory = selectedCategory === 'all' || mat.category === selectedCategory;
      const matchesSearch =
        searchQuery.trim() === '' ||
        mat.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        mat.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (mat.term && mat.term.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (mat.attachedNotes && mat.attachedNotes.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesSubject && matchesCategory && matchesSearch;
    });
  }, [db.materials, activeSubjectId, selectedCategory, searchQuery]);

  // Helper to calculate subject statistics
  const getSubjectStats = (subjectId: string) => {
    const materials = db.materials.filter((m) => m.subjectId === subjectId);
    const students = db.students.filter((s) => (s.enrolledSubjectIds || []).includes(subjectId));
    const materialIds = materials.map((m) => m.id);
    const completedAssignments = db.assignments.filter(
      (a) =>
        materialIds.includes(a.materialId) &&
        (a.status === 'gjennomgatt' || a.status === 'levert')
    ).length;
    const totalPossible = materials.length * students.length;
    const progressPct = totalPossible > 0 ? Math.round((completedAssignments / totalPossible) * 100) : 0;

    const examCount = materials.filter((m) => m.category === 'eksamen').length;
    const homeworkCount = materials.filter((m) => m.category === 'lekse').length;
    const syllabusCount = materials.filter((m) => m.category === 'pensum').length;

    return {
      materialCount: materials.length,
      studentCount: students.length,
      progressPct,
      examCount,
      homeworkCount,
      syllabusCount,
    };
  };

  return (
    <div className="space-y-4">
      {/* Top Header / Breadcrumb / Subject Switcher */}
      <div className="bg-white rounded-xl border border-stone-200 p-3.5 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          
          {/* Subject Switcher Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
            <button
              onClick={() => setActiveSubjectId(null)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-colors ${
                activeSubjectId === null
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-stone-100 text-slate-600 hover:bg-stone-200 hover:text-slate-900'
              }`}
            >
              <Folder className="w-3.5 h-3.5" />
              <span>Fagoversikt ({db.subjects.length})</span>
            </button>

            {db.subjects.map((sub) => {
              const count = db.materials.filter((m) => m.subjectId === sub.id).length;
              const isSelected = activeSubjectId === sub.id;

              return (
                <button
                  key={sub.id}
                  onClick={() => setActiveSubjectId(sub.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium shrink-0 transition-colors ${
                    isSelected
                      ? 'bg-emerald-700 text-white shadow-2xs'
                      : 'bg-stone-100 text-slate-700 hover:bg-stone-200'
                  }`}
                >
                  <span>{sub.name}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-semibold ${
                      isSelected
                        ? 'bg-emerald-800 text-emerald-100'
                        : 'bg-stone-200 text-slate-600'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Action button */}
          <div className="flex items-center gap-2 shrink-0">
            {onOpenNewSubject && (
              <button
                onClick={onOpenNewSubject}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-stone-100 text-slate-700 hover:bg-stone-200 border border-stone-200 transition-colors shadow-2xs"
                title="Opprett et nytt fag i skolesystemet"
              >
                <Plus className="w-3.5 h-3.5 text-slate-600" />
                <span>Nytt fag</span>
              </button>
            )}
            <button
              onClick={() => onOpenNewMaterial(activeSubjectId || undefined)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 transition-colors shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Legg til fagmateriell</span>
            </button>
          </div>

        </div>
      </div>

      {/* VIEW 1: FAGOVERSIKT (Hovedoversikt over alle faggrupper hvis ingen er valgt eller for navigasjon) */}
      {activeSubjectId === null && (
        <div className="space-y-4">
          <div className="bg-emerald-950 text-white rounded-2xl p-5 shadow-sm border border-emerald-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-emerald-400" />
                Fag- og Materialbanken
              </h2>
              <p className="text-xs text-emerald-200 mt-1">
                Velg et fag nedenfor for å se en kompakt liste over alle eksamener, pensumdeler, lekser og vedlagte filer.
              </p>
            </div>
            <span className="text-xs font-semibold px-3 py-1 rounded-lg bg-emerald-900/80 text-emerald-200 border border-emerald-800 shrink-0">
              Totalt {db.materials.length} fagdeler registrert
            </span>
          </div>

          {db.subjects.length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed border-stone-300 p-12 text-center text-slate-500 shadow-2xs space-y-3">
              <BookOpen className="w-10 h-10 mx-auto text-slate-400" />
              <div>
                <p className="font-semibold text-slate-800 text-sm">Ingen fag er opprettet ennå</p>
                <p className="text-xs text-slate-500 mt-1">Start med å opprette et fag for å legge inn pensum, eksamenssett og oppgaver.</p>
              </div>
              {onOpenNewSubject && (
                <button
                  type="button"
                  onClick={onOpenNewSubject}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold shadow-2xs transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Opprett første fag</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {db.subjects.map((sub) => {
              const stats = getSubjectStats(sub.id);

              return (
                <div
                  key={sub.id}
                  onClick={() => setActiveSubjectId(sub.id)}
                  className="bg-white rounded-xl border border-stone-200 p-5 shadow-2xs hover:shadow-md hover:border-emerald-400 transition-all cursor-pointer group flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-900 text-white">
                          {sub.code}
                        </span>
                        <span className="text-[11px] font-medium text-slate-500 bg-stone-100 px-2 py-0.5 rounded">
                          {sub.gradeLevel}
                        </span>
                      </div>
                      {onEditSubject && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditSubject(sub);
                          }}
                          className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-stone-100 transition-colors"
                          title="Rediger eller slett fag"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div>
                      <h3 className="font-bold text-slate-900 text-base group-hover:text-emerald-700 transition-colors flex items-center justify-between">
                        {sub.name}
                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-700 group-hover:translate-x-1 transition-all" />
                      </h3>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                        {sub.description}
                      </p>
                    </div>

                    {/* Stats Pill Row */}
                    <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-stone-100 text-center">
                      <div className="p-1.5 rounded-lg bg-purple-50 text-purple-900">
                        <div className="font-bold text-xs">{stats.examCount}</div>
                        <div className="text-[10px] text-purple-700">Eksamener</div>
                      </div>
                      <div className="p-1.5 rounded-lg bg-blue-50 text-blue-900">
                        <div className="font-bold text-xs">{stats.syllabusCount}</div>
                        <div className="text-[10px] text-blue-700">Pensum</div>
                      </div>
                      <div className="p-1.5 rounded-lg bg-amber-50 text-amber-900">
                        <div className="font-bold text-xs">{stats.homeworkCount}</div>
                        <div className="text-[10px] text-amber-700">Lekser</div>
                      </div>
                    </div>
                  </div>

                  {/* Bottom summary and progress */}
                  <div className="space-y-1.5 pt-1 border-t border-stone-100 text-xs">
                    <div className="flex items-center justify-between text-slate-600">
                      <span>
                        <strong>{stats.studentCount}</strong> elever påmeldt
                      </span>
                      <span className="font-bold text-emerald-700">
                        {stats.progressPct}% gjennomgått
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-stone-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-600 rounded-full"
                        style={{ width: `${stats.progressPct}%` }}
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

      {/* VIEW 2: INNE I ET VALGT FAG (KOMPAKT LISTE / KONTAKTLISTE-STIL) */}
      {activeSubjectId !== null && currentSubject && (
        <div className="space-y-4">
          
          {/* Subject Header Banner with Breadcrumb */}
          <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setActiveSubjectId(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-stone-100 transition-colors"
                title="Tilbake til alle fag"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-slate-900 text-base">
                    {currentSubject.name}
                  </h2>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-900 text-white">
                    {currentSubject.code}
                  </span>
                  <span className="text-[11px] text-slate-500 bg-stone-100 px-2 py-0.5 rounded">
                    {currentSubject.gradeLevel}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {currentSubject.description}
                </p>
              </div>
            </div>

            {/* Quick stats in subject and edit button */}
            <div className="flex items-center gap-2 text-xs">
              <div className="bg-stone-50 px-3 py-1.5 rounded-lg border border-stone-200 text-slate-600">
                <span className="font-semibold text-slate-900">
                  {db.students.filter((s) => s.enrolledSubjectIds.includes(currentSubject.id)).length}
                </span>{' '}
                elever
              </div>
              <div className="bg-stone-50 px-3 py-1.5 rounded-lg border border-stone-200 text-slate-600">
                <span className="font-semibold text-slate-900">
                  {filteredMaterials.length}
                </span>{' '}
                fagdeler
              </div>
              {onEditSubject && (
                <button
                  type="button"
                  onClick={() => onEditSubject(currentSubject)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-200 bg-stone-100 hover:bg-stone-200 text-slate-700 font-medium transition-colors"
                  title="Rediger fagnavn, kode eller slett fag"
                >
                  <Edit2 className="w-3.5 h-3.5 text-slate-600" />
                  <span>Rediger fag</span>
                </button>
              )}
            </div>
          </div>

          {/* Search and Category Filter Bar */}
          <div className="bg-white rounded-xl border border-stone-200 p-3 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative flex-1 w-full max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Søk i fagmateriellet..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-stone-200 bg-stone-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-800"
              />
            </div>

            {/* Category Filter Chips */}
            <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0 text-xs">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium shrink-0 transition-colors ${
                  selectedCategory === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'bg-stone-100 text-slate-600 hover:bg-stone-200'
                }`}
              >
                Alle ({db.materials.filter((m) => m.subjectId === currentSubject.id).length})
              </button>
              <button
                onClick={() => setSelectedCategory('eksamen')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium shrink-0 transition-colors ${
                  selectedCategory === 'eksamen'
                    ? 'bg-purple-700 text-white'
                    : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
                }`}
              >
                Eksamener ({db.materials.filter((m) => m.subjectId === currentSubject.id && m.category === 'eksamen').length})
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
                Teori / CAS
              </button>
            </div>
          </div>

          {/* KOMPAKT LISTE OVER FAGMATERIELL (Kontaktliste-stil) */}
          {filteredMaterials.length === 0 ? (
            <div className="bg-white rounded-xl border border-stone-200 p-12 text-center text-slate-500 shadow-2xs">
              <BookOpen className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <p className="font-medium text-slate-700">Ingen fagmateriell matcher dette filteret.</p>
              <p className="text-xs text-slate-400 mt-1">
                Opprett et nytt eksamenssett, pensumdel eller lekse for {currentSubject.name}.
              </p>
              <button
                onClick={() => onOpenNewMaterial(currentSubject.id)}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 text-white text-xs font-medium hover:bg-emerald-800 shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" />
                Legg til i {currentSubject.name}
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-stone-200 shadow-2xs overflow-hidden">
              
              {/* Header bar of compact list */}
              <div className="bg-stone-50 border-b border-stone-200 px-4 py-2.5 text-[11px] font-semibold text-slate-500 grid grid-cols-12 gap-2 items-center">
                <div className="col-span-5 sm:col-span-4">Fagmateriell & Kategori</div>
                <div className="col-span-4 sm:col-span-5">Hvem har gjennomgått (Elevstatus)</div>
                <div className="col-span-3 sm:col-span-3 text-right">Progresjon & Handlinger</div>
              </div>

              {/* List items */}
              <div className="divide-y divide-stone-100 text-xs">
                {filteredMaterials.map((mat) => {
                  const assignments = db.assignments.filter((a) => a.materialId === mat.id);
                  const eligibleStudents = db.students.filter((s) =>
                    s.enrolledSubjectIds.includes(mat.subjectId)
                  );
                  
                  // Students who completed
                  const completedStudents = eligibleStudents.filter((stud) => {
                    const asgn = assignments.find((a) => a.studentId === stud.id);
                    return asgn?.status === 'gjennomgatt' || asgn?.status === 'levert';
                  });

                  // Students who are in progress
                  const workingStudents = eligibleStudents.filter((stud) => {
                    const asgn = assignments.find((a) => a.studentId === stud.id);
                    return asgn?.status === 'under_arbeid' || asgn?.status === 'tildelt';
                  });

                  // Students remaining
                  const remainingStudents = eligibleStudents.filter((stud) => {
                    const asgn = assignments.find((a) => a.studentId === stud.id);
                    return !asgn || asgn.status === 'ikke_tildelt';
                  });

                  const completionPct =
                    eligibleStudents.length > 0
                      ? Math.round((completedStudents.length / eligibleStudents.length) * 100)
                      : 0;

                  const hasFiles = mat.files && mat.files.length > 0;

                  return (
                    <div
                      key={mat.id}
                      className="px-4 py-3 hover:bg-stone-50/70 transition-colors grid grid-cols-12 gap-2 items-center group cursor-pointer"
                      onClick={() => setSelectedMaterialForDetail(mat)}
                    >
                      {/* Left: Type, Title, Term & File badge */}
                      <div className="col-span-5 sm:col-span-4 min-w-0 pr-2">
                        <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                          <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded ${getCategoryBadgeClass(mat.category)}`}>
                            {getCategoryLabel(mat.category)}
                          </span>
                          {mat.term && (
                            <span className="text-[10px] text-slate-500 font-medium bg-stone-100 px-1.5 py-0.2 rounded border border-stone-200">
                              {mat.term}
                            </span>
                          )}
                          {hasFiles && (
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreviewingFile(mat.files![0]);
                              }}
                              className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 hover:bg-emerald-100 px-1.5 py-0.2 rounded border border-emerald-200 flex items-center gap-1 transition-colors"
                              title="Klikk for å forhåndsvise oppgavefil / PDF"
                            >
                              <Paperclip className="w-2.5 h-2.5" />
                              PDF
                            </span>
                          )}
                        </div>

                        <div className="font-semibold text-slate-900 truncate group-hover:text-emerald-700 transition-colors" title={mat.title}>
                          {mat.title}
                        </div>
                      </div>

                      {/* Middle: Short note about who completed it */}
                      <div className="col-span-4 sm:col-span-5 min-w-0 pr-2 text-[11px]">
                        {completedStudents.length > 0 ? (
                          <div className="space-y-0.5">
                            <div className="text-slate-800 font-medium truncate">
                              <span className="text-emerald-700 font-bold">Gjennomgått ({completedStudents.length}/{eligibleStudents.length}):</span>{' '}
                              {completedStudents.map((s) => s.name.split(' ')[0]).join(', ')}
                            </div>
                            {remainingStudents.length > 0 && (
                              <div className="text-slate-400 text-[10px] truncate">
                                Mangler: {remainingStudents.map((s) => s.name.split(' ')[0]).join(', ')}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-slate-400 italic">
                            Ingen elever har gjennomgått ennå ({eligibleStudents.length} elever i faget)
                          </div>
                        )}
                      </div>

                      {/* Right: Progress bar & Actions */}
                      <div className="col-span-3 sm:col-span-3 flex items-center justify-end gap-2.5" onClick={(e) => e.stopPropagation()}>
                        
                        {/* Progress */}
                        <div className="hidden sm:flex flex-col items-end gap-0.5 w-20 shrink-0">
                          <span className="text-[11px] font-bold text-slate-700">
                            {completionPct}%
                          </span>
                          <div className="w-full h-1 bg-stone-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-600 rounded-full"
                              style={{ width: `${completionPct}%` }}
                            />
                          </div>
                        </div>

                        {/* Quick action buttons */}
                        <div className="flex items-center gap-1">
                          {hasFiles && (
                            <button
                              onClick={() => setPreviewingFile(mat.files![0])}
                              className="p-1 rounded text-emerald-700 hover:bg-emerald-50 transition-colors"
                              title="Forhåndsvis oppgavehefte / fil"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => onOpenAssignForMaterial(mat)}
                            className="p-1 rounded text-slate-500 hover:text-slate-900 hover:bg-stone-100 transition-colors"
                            title="Tildel til elever"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onEditMaterial(mat)}
                            className="p-1 rounded text-slate-500 hover:text-slate-900 hover:bg-stone-100 transition-colors"
                            title="Rediger fagmateriell"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onDeleteMaterial(mat.id)}
                            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title="Slett"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          )}

        </div>
      )}

      {/* DETAIL DRAWER / MODAL NÅR MAN TRYYKER INN PÅ EN OPPGAVE */}
      {selectedMaterialForDetail && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 z-50 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full border border-stone-200 shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col">
            
            {/* Header */}
            <div className="bg-stone-50 border-b border-stone-200 p-4 sm:p-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-emerald-700 text-white flex items-center justify-center shrink-0">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                    <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded ${getCategoryBadgeClass(selectedMaterialForDetail.category)}`}>
                      {getCategoryLabel(selectedMaterialForDetail.category)}
                    </span>
                    {selectedMaterialForDetail.term && (
                      <span className="text-[10px] text-slate-600 bg-stone-200 px-1.5 py-0.2 rounded">
                        {selectedMaterialForDetail.term}
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm truncate" title={selectedMaterialForDetail.title}>
                    {selectedMaterialForDetail.title}
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => {
                    const toEdit = selectedMaterialForDetail;
                    setSelectedMaterialForDetail(null);
                    onEditMaterial(toEdit);
                  }}
                  className="p-1.5 text-xs rounded-lg border border-stone-300 text-slate-700 hover:bg-stone-100 flex items-center gap-1"
                >
                  <Edit2 className="w-3 h-3" />
                  Rediger
                </button>
                <button
                  onClick={() => setSelectedMaterialForDetail(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              
              {/* Description & Guide */}
              <div className="space-y-2">
                <div>
                  <h4 className="font-semibold text-slate-800 mb-1">Beskrivelse & Læringsmål</h4>
                  <p className="text-slate-600 leading-relaxed bg-stone-50 p-3 rounded-lg border border-stone-200">
                    {selectedMaterialForDetail.description || 'Ingen beskrivelse oppgitt.'}
                  </p>
                </div>

                {selectedMaterialForDetail.attachedNotes && (
                  <div>
                    <h4 className="font-semibold text-slate-800 mb-1">Lærerinstruks / Veiledningstips</h4>
                    <p className="text-slate-600 leading-relaxed bg-amber-50/50 p-3 rounded-lg border border-amber-200/60 italic">
                      {selectedMaterialForDetail.attachedNotes}
                    </p>
                  </div>
                )}
              </div>

              {/* Attached Files & Preview */}
              <div>
                <h4 className="font-semibold text-slate-800 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Paperclip className="w-3.5 h-3.5 text-slate-500" />
                    Vedlagte eksamensoppgaver & dokumenter
                  </span>
                  {selectedMaterialForDetail.files && selectedMaterialForDetail.files.length > 0 && (
                    <span className="text-[10px] text-slate-500 font-normal">
                      {selectedMaterialForDetail.files.length} fil(er)
                    </span>
                  )}
                </h4>

                {selectedMaterialForDetail.files && selectedMaterialForDetail.files.length > 0 ? (
                  <div className="space-y-1.5">
                    {selectedMaterialForDetail.files.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center justify-between p-2.5 rounded-lg border border-emerald-200 bg-emerald-50/30 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0 pr-2">
                          <FileText className="w-4 h-4 text-emerald-700 shrink-0" />
                          <span className="font-medium text-slate-900 truncate">
                            {file.name}
                          </span>
                        </div>
                        <button
                          onClick={() => setPreviewingFile(file)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg bg-emerald-700 text-white font-medium hover:bg-emerald-800 shrink-0 shadow-2xs"
                        >
                          <Eye className="w-3 h-3" />
                          Forhåndsvis oppgave
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 rounded-lg border border-dashed border-stone-200 text-center text-slate-400 text-xs">
                    Ingen oppgavefil er vedlagt ennå.{' '}
                    <button
                      onClick={() => {
                        const m = selectedMaterialForDetail;
                        setSelectedMaterialForDetail(null);
                        onEditMaterial(m);
                      }}
                      className="text-emerald-700 font-medium underline hover:text-emerald-800 ml-1"
                    >
                      Last opp PDF her
                    </button>
                  </div>
                )}
              </div>

              {/* External Resource link */}
              {selectedMaterialForDetail.externalUrl && (
                <div>
                  <h4 className="font-semibold text-slate-800 mb-1">Nettressurs (Udir / Matematikk.net)</h4>
                  <a
                    href={selectedMaterialForDetail.externalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-emerald-700 hover:text-emerald-800 hover:underline"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Åpne ekstern ressurs i ny fane
                  </a>
                </div>
              )}

              {/* Student status for this material */}
              <div className="pt-2 border-t border-stone-200">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-slate-500" />
                    Elever i faget – Status & Gjennomgang:
                  </h4>
                  <button
                    onClick={() => {
                      const mat = selectedMaterialForDetail;
                      setSelectedMaterialForDetail(null);
                      onOpenAssignForMaterial(mat);
                    }}
                    className="text-emerald-700 hover:text-emerald-800 text-[11px] font-medium"
                  >
                    + Tildel til flere
                  </button>
                </div>

                <div className="divide-y divide-stone-100 border border-stone-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                  {db.students
                    .filter((s) => s.enrolledSubjectIds.includes(selectedMaterialForDetail.subjectId))
                    .map((student) => {
                      const asgn = db.assignments.find(
                        (a) => a.studentId === student.id && a.materialId === selectedMaterialForDetail.id
                      );
                      const status = asgn?.status || 'ikke_tildelt';
                      const isDone = status === 'gjennomgatt' || status === 'levert';

                      return (
                        <div
                          key={student.id}
                          className="p-2.5 flex items-center justify-between hover:bg-stone-50 text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] ${student.avatarBg}`}>
                              {student.name.charAt(0)}
                            </div>
                            <span className="font-medium text-slate-900">{student.name}</span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${getStatusBadgeClass(status)}`}>
                              {getStatusLabel(status)}
                            </span>

                            {/* Quick status toggle button */}
                            <button
                              onClick={() => {
                                const next = isDone ? 'ikke_tildelt' : 'gjennomgatt';
                                onQuickToggleStudentAssignment(student.id, selectedMaterialForDetail.id, next);
                              }}
                              className={`px-2 py-1 rounded text-[10px] font-medium border transition-colors ${
                                isDone
                                  ? 'bg-stone-100 text-slate-600 border-stone-300 hover:bg-stone-200'
                                  : 'bg-emerald-700 text-white border-emerald-700 hover:bg-emerald-800'
                              }`}
                            >
                              {isDone ? 'Sett som ikke gjort' : 'Marker gjennomgått'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

            </div>

            {/* Footer */}
            <div className="bg-stone-50 border-t border-stone-200 p-3 flex justify-end shrink-0">
              <button
                onClick={() => setSelectedMaterialForDetail(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800"
              >
                Lukk
              </button>
            </div>

          </div>
        </div>
      )}

      {/* FILE PREVIEW MODAL */}
      {previewingFile && (
        <FilePreviewModal
          file={previewingFile}
          onClose={() => setPreviewingFile(null)}
        />
      )}

    </div>
  );
};
