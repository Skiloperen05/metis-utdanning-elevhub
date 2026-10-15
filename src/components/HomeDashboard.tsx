import React, { useState, useMemo } from 'react';
import {
  Users,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Search,
  Printer,
  TrendingUp,
  ArrowUpRight,
  Calendar,
  Clock,
  Plus
} from 'lucide-react';
import { AppDatabase, Student, Material } from '../types';
import { getMasteryBadgeClass, getMasteryLabel } from '../lib/helpers';

interface HomeDashboardProps {
  db: AppDatabase;
  onNavigateToMatrix: (subjectId?: string) => void;
  onNavigateToSessions?: () => void;
  onSelectStudent: (student: Student) => void;
  onSelectMaterial: (material: Material) => void;
  onOpenNewStudent: () => void;
  onOpenNewMaterial: () => void;
  onOpenBulkAssign: () => void;
  onOpenSessionPlanner: (defaultStudentId?: string, defaultSubjectId?: string) => void;
  onCompleteSession?: (sessionId: string, completedMaterialIds?: string[]) => void;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  db,
  onNavigateToMatrix,
  onNavigateToSessions,
  onSelectStudent,
  onOpenSessionPlanner,
  onCompleteSession,
}) => {
  // Search & filter states
  const [studentSearch, setStudentSearch] = useState('');
  const [subjectFilter, setSubjectFilter] = useState<string>('alle');
  const [sortOrder, setSortOrder] = useState<'lowest_first' | 'highest_first' | 'name_asc'>('lowest_first');

  const plannedSessions = useMemo(() => {
    return (db.sessions || [])
      .filter((s) => s.status === 'planlagt')
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  }, [db.sessions]);

  // 1. Overall Calculations
  const totalStudents = db.students.length;
  const totalMaterials = db.materials.length;
  const totalSubjects = db.subjects.length;
  const totalAssignments = db.assignments.length;

  const completedAssignmentsCount = useMemo(() => {
    return db.assignments.filter(
      (a) => a.status === 'gjennomgatt' || a.status === 'levert'
    ).length;
  }, [db.assignments]);

  const inProgressAssignmentsCount = useMemo(() => {
    return db.assignments.filter(
      (a) => a.status === 'under_arbeid' || a.status === 'tildelt'
    ).length;
  }, [db.assignments]);

  const overallAssignmentCompletionRate = useMemo(() => {
    if (totalAssignments === 0) return 0;
    return Math.round((completedAssignmentsCount / totalAssignments) * 100);
  }, [completedAssignmentsCount, totalAssignments]);

  // 2. Completion Per Subject
  const subjectStats = useMemo(() => {
    return db.subjects.map((subject) => {
      const subjectMaterials = db.materials.filter((m) => m.subjectId === subject.id);
      const subjectMaterialIds = new Set(subjectMaterials.map((m) => m.id));
      const enrolledStudents = db.students.filter((s) => (s.enrolledSubjectIds || []).includes(subject.id));

      const potentialWorkload = subjectMaterials.length * enrolledStudents.length;
      const subjectAssignments = db.assignments.filter((a) => subjectMaterialIds.has(a.materialId));

      const completedInSubject = subjectAssignments.filter(
        (a) => a.status === 'gjennomgatt' || a.status === 'levert'
      ).length;

      const inProgressInSubject = subjectAssignments.filter(
        (a) => a.status === 'under_arbeid' || a.status === 'tildelt'
      ).length;

      const completionRate = potentialWorkload > 0
        ? Math.round((completedInSubject / potentialWorkload) * 100)
        : (subjectAssignments.length > 0
            ? Math.round((completedInSubject / subjectAssignments.length) * 100)
            : 0);

      return {
        subject,
        materialsCount: subjectMaterials.length,
        enrolledCount: enrolledStudents.length,
        potentialWorkload,
        completedCount: completedInSubject,
        inProgressCount: inProgressInSubject,
        completionRate: Math.min(100, completionRate),
      };
    });
  }, [db.subjects, db.materials, db.students, db.assignments]);

  // 3. Completion Per Student
  const studentStats = useMemo(() => {
    return db.students.map((student) => {
      const subjectIds = student.enrolledSubjectIds || [];
      const enrolledSubjects = db.subjects.filter((s) => subjectIds.includes(s.id));
      const relevantMaterials = db.materials.filter((m) => subjectIds.includes(m.subjectId));
      const studentAssignments = db.assignments.filter((a) => a.studentId === student.id);
      
      const completedCount = studentAssignments.filter(
        (a) => a.status === 'gjennomgatt' || a.status === 'levert'
      ).length;

      const inProgressCount = studentAssignments.filter(
        (a) => a.status === 'under_arbeid' || a.status === 'tildelt'
      ).length;

      const totalExpected = Math.max(relevantMaterials.length, studentAssignments.length);
      const completionRate = totalExpected > 0 ? Math.round((completedCount / totalExpected) * 100) : 0;

      return {
        student,
        enrolledSubjects,
        totalExpected,
        completedCount,
        inProgressCount,
        completionRate: Math.min(100, completionRate),
      };
    });
  }, [db.students, db.subjects, db.materials, db.assignments]);

  // Filtered and Sorted Students
  const filteredStudents = useMemo(() => {
    let list = studentStats.filter((item) => {
      const sName = item.student.name || '';
      const sGroup = item.student.classGroup || '';
      const matchesSearch =
        sName.toLowerCase().includes(studentSearch.toLowerCase()) ||
        sGroup.toLowerCase().includes(studentSearch.toLowerCase());

      const subjectIds = item.student.enrolledSubjectIds || [];
      const matchesSubject =
        subjectFilter === 'alle' ||
        subjectIds.includes(subjectFilter);

      return matchesSearch && matchesSubject;
    });

    list.sort((a, b) => {
      if (sortOrder === 'lowest_first') return a.completionRate - b.completionRate;
      if (sortOrder === 'highest_first') return b.completionRate - a.completionRate;
      if (sortOrder === 'name_asc') return (a.student.name || '').localeCompare(b.student.name || '', 'no');
      return 0;
    });

    return list;
  }, [studentStats, studentSearch, subjectFilter, sortOrder]);

  const studentsNeedingSupportCount = useMemo(() => {
    return studentStats.filter(
      (s) => s.completionRate < 45 || s.student.currentMastery === 'lav' || (s.student.notes || []).some((n) => n.type === 'varsel')
    ).length;
  }, [studentStats]);

  return (
    <div className="space-y-8 pb-12">
      
      {/* Calm Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Oversikt og fremdrift
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Gjennomføringsgrad per fag og elev. Start her for rask status ved oppstart.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigateToMatrix('all')}
            id="dashboard-btn-open-matrix"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors shadow-2xs"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Åpne matrisen</span>
            <ArrowRight className="w-3.5 h-3.5 ml-0.5 text-slate-400" />
          </button>
        </div>
      </div>

      {/* Clean KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI 1: Overall Completion */}
        <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold text-slate-600">Gjennomføring totalt</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900">{overallAssignmentCompletionRate}%</span>
            <span className="text-xs text-slate-500">av alle oppgaver</span>
          </div>
          <div className="w-full bg-stone-100 rounded-full h-2 overflow-hidden">
            <div
              className="bg-emerald-600 h-2 rounded-full transition-all duration-500"
              style={{ width: `${overallAssignmentCompletionRate}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-500 pt-1">
            {completedAssignmentsCount} fullført • {inProgressAssignmentsCount} i arbeid
          </p>
        </div>

        {/* KPI 2: Active Students */}
        <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold text-slate-600">Elever</span>
            <Users className="w-4 h-4 text-slate-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900">{totalStudents}</span>
            <span className="text-xs text-slate-500">aktive elever</span>
          </div>
          <div className="w-full bg-stone-100 rounded-full h-2 overflow-hidden">
            <div
              className="bg-slate-700 h-2 rounded-full"
              style={{
                width: `${totalStudents > 0 ? Math.round((studentStats.filter(s => s.completionRate >= 50).length / totalStudents) * 100) : 0}%`
              }}
            />
          </div>
          <p className="text-[11px] text-slate-500 pt-1">
            {studentStats.filter(s => s.completionRate >= 50).length} elever over 50%
          </p>
        </div>

        {/* KPI 3: Fag & Oppgaver */}
        <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold text-slate-600">Fag & oppgaver</span>
            <BookOpen className="w-4 h-4 text-slate-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900">{totalSubjects} fag</span>
            <span className="text-xs text-slate-500">• {totalMaterials} oppgaver</span>
          </div>
          <div className="w-full bg-stone-100 rounded-full h-2 overflow-hidden">
            <div
              className="bg-slate-500 h-2 rounded-full"
              style={{ width: `${Math.min(100, totalMaterials * 8)}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-500 pt-1">
            Eksamener, pensum og lekser
          </p>
        </div>

        {/* KPI 4: Trenger oppfølging */}
        <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold text-slate-600">Trenger oppfølging</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900">{studentsNeedingSupportCount}</span>
            <span className="text-xs text-slate-500">under 45% progresjon</span>
          </div>
          <div className="w-full bg-stone-100 rounded-full h-2 overflow-hidden">
            <div
              className="bg-amber-500 h-2 rounded-full"
              style={{
                width: `${totalStudents > 0 ? (studentsNeedingSupportCount / totalStudents) * 100 : 0}%`
              }}
            />
          </div>
          <p className="text-[11px] text-slate-500 pt-1">
            Prioriteres øverst i listen under
          </p>
        </div>

      </div>

      {/* PLANLAGTE VEILEDNINGSTIMER */}
      <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Planlagte veiledningstimer
              </h2>
              <p className="text-xs text-slate-500">
                {plannedSessions.length > 0
                  ? `${plannedSessions.length} time${plannedSessions.length === 1 ? '' : 'r'} venter på gjennomføring`
                  : 'Ingen timer planlagt for øyeblikket'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenSessionPlanner()}
              id="dashboard-btn-plan-session"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 text-xs font-semibold transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-700" />
              <span>Planlegg ny time</span>
            </button>
            {onNavigateToSessions && (
              <button
                onClick={onNavigateToSessions}
                id="dashboard-btn-view-sessions"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-stone-200 hover:bg-stone-50 text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
              >
                <span>Se alle timer</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              </button>
            )}
          </div>
        </div>

        {plannedSessions.length === 0 ? (
          <div className="text-center py-6 px-4 bg-stone-50 rounded-lg border border-dashed border-stone-200">
            <p className="text-xs text-slate-500">
              Du har ingen planlagte timer ennå. Bruk «Planlegg ny time» for å sette opp 1-times økter med oppgavehefter for elevene.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {plannedSessions.slice(0, 6).map((session) => {
              const student = db.students.find((s) => s.id === session.studentId);
              const subject = db.subjects.find((s) => s.id === session.subjectId);

              return (
                <div
                  key={session.id}
                  className="p-3.5 rounded-lg border border-stone-200 bg-stone-50/50 hover:bg-white hover:border-emerald-300 hover:shadow-2xs transition-all flex flex-col justify-between gap-3"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        {session.date} kl. {session.time}
                      </span>
                      {subject && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-stone-200/70 text-slate-700">
                          {subject.code}
                        </span>
                      )}
                    </div>

                    <div
                      onClick={() => student && onSelectStudent(student)}
                      className="font-bold text-slate-900 hover:text-emerald-700 text-sm cursor-pointer transition-colors"
                    >
                      {student ? student.name : 'Ukjent elev'}
                    </div>

                    <p className="text-xs text-slate-600 line-clamp-1 font-medium">
                      {session.title}
                    </p>

                    <div className="text-[11px] text-slate-500">
                      {session.items?.length || 0} oppgaver i timeheftet
                    </div>
                  </div>

                  <div className="pt-2 border-t border-stone-200/70 flex items-center justify-between gap-2">
                    {student && (
                      <button
                        onClick={() => onSelectStudent(student)}
                        className="text-xs text-slate-600 hover:text-slate-900 font-medium cursor-pointer"
                      >
                        Åpne elevkort
                      </button>
                    )}

                    {onCompleteSession && (
                      <button
                        onClick={() => {
                          onCompleteSession(session.id);
                        }}
                        className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 px-2.5 py-1 rounded-md transition-colors cursor-pointer ml-auto"
                        title="Marker som gjennomført og oppdater elevens matrise"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Marker gjort</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION 1: GJENNOMFØRINGSGRAD PER FAG */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-slate-700" />
            <span>Gjennomføringsgrad per fag</span>
          </h2>

          <button
            onClick={() => onNavigateToMatrix('all')}
            className="text-xs font-semibold text-slate-700 hover:text-slate-900 inline-flex items-center gap-1"
          >
            <span>Åpne full matrise</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Subjects Grid */}
        {subjectStats.length === 0 ? (
          <div className="bg-white rounded-xl border border-dashed border-stone-300 p-8 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center mx-auto text-slate-400">
              <BookOpen className="w-6 h-6" />
            </div>
            <div className="max-w-md mx-auto">
              <h3 className="font-semibold text-slate-800 text-sm">Ingen fag er registrert ennå</h3>
              <p className="text-xs text-slate-500 mt-1">
                Opprett et fag for å begynne å strukturere pensum, eksamener og elevfremdrift.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {subjectStats.map(({ subject, materialsCount, enrolledCount, completedCount, inProgressCount, potentialWorkload, completionRate }) => (
              <div
                key={subject.id}
                className="bg-white rounded-xl border border-stone-200 p-5 shadow-2xs flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-stone-100 text-slate-800 border border-stone-200">
                          {subject.code}
                        </span>
                        <span className="text-[11px] text-slate-500 font-medium">
                          {subject.gradeLevel}
                        </span>
                      </div>
                      <h3 className="font-bold text-slate-900 text-base mt-1">
                        {subject.name}
                      </h3>
                    </div>

                    <span className={`text-xl font-extrabold ${
                      completionRate >= 70
                        ? 'text-emerald-700'
                        : completionRate >= 40
                        ? 'text-amber-600'
                        : 'text-slate-700'
                    }`}>
                      {completionRate}%
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1">
                    <div className="w-full bg-stone-100 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-2 rounded-full transition-all duration-500 ${
                          completionRate >= 70
                            ? 'bg-emerald-600'
                            : completionRate >= 40
                            ? 'bg-amber-500'
                            : 'bg-slate-400'
                        }`}
                        style={{ width: `${completionRate}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>{completedCount} av {potentialWorkload > 0 ? potentialWorkload : materialsCount} oppgaver fullført</span>
                      <span>{enrolledCount} elev(er)</span>
                    </div>
                  </div>
                </div>

                {/* Action Button for Subject */}
                <button
                  onClick={() => onNavigateToMatrix(subject.id)}
                  className="w-full py-2 px-3 text-xs font-semibold text-slate-800 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                >
                  <span>Gå til matrisen for {subject.name}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SECTION 2: GJENNOMFØRINGSGRAD PER ELEV */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-700" />
              <span>Gjennomføringsgrad per elev</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Elever med lavest progresjon vises øverst slik at du raskt kan følge opp de som henger etter.
            </p>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="bg-white rounded-xl border border-stone-200 p-3 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Søk etter elevnavn eller klasse..."
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-stone-50 rounded-lg border border-stone-200 focus:outline-none focus:border-slate-800 focus:bg-white"
            />
          </div>

          {/* Subject Filter */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-500 shrink-0">Fag:</span>
            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="py-1.5 px-2.5 text-xs bg-stone-50 rounded-lg border border-stone-200 font-medium text-slate-700"
            >
              <option value="alle">Alle fag</option>
              {db.subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </div>

          {/* Sort Order */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-500 shrink-0">Sortering:</span>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as any)}
              className="py-1.5 px-2.5 text-xs bg-stone-50 rounded-lg border border-stone-200 font-medium text-slate-700"
            >
              <option value="lowest_first">Lavest gjennomføring først</option>
              <option value="highest_first">Høyest gjennomføring først</option>
              <option value="name_asc">Navn (A-Å)</option>
            </select>
          </div>
        </div>

        {/* Student Cards List */}
        {totalStudents === 0 ? (
          <div className="p-8 text-center bg-white rounded-xl border border-dashed border-stone-300 space-y-3">
            <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center mx-auto text-slate-400">
              <Users className="w-6 h-6" />
            </div>
            <div className="max-w-md mx-auto">
              <h3 className="font-semibold text-slate-800 text-sm">Ingen elever er registrert ennå</h3>
              <p className="text-xs text-slate-500 mt-1">
                Legg inn dine egne elever for å følge opp fag, veiledningstimer og oppgaver.
              </p>
            </div>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-xl border border-dashed border-stone-200 text-slate-400 text-xs">
            Ingen elever funnet med dette søket.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {filteredStudents.map(({ student, enrolledSubjects, totalExpected, completedCount, inProgressCount, completionRate }) => (
              <div
                key={student.id}
                className="bg-white rounded-xl border border-stone-200 p-4 shadow-2xs flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-10 h-10 rounded-full ${student.avatarBg} text-white font-bold flex items-center justify-center shrink-0 shadow-2xs text-sm`}>
                        {student.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3
                            onClick={() => onSelectStudent(student)}
                            className="font-bold text-slate-900 text-sm hover:text-emerald-700 cursor-pointer truncate"
                          >
                            {student.name}
                          </h3>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-stone-100 text-slate-600 border border-stone-200 shrink-0">
                            Mål: {student.targetGrade}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 truncate">
                          {student.classGroup}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className={`text-lg font-bold ${
                        completionRate >= 70
                          ? 'text-emerald-700'
                          : completionRate >= 40
                          ? 'text-amber-600'
                          : 'text-rose-600'
                      }`}>
                        {completionRate}%
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-3 space-y-1">
                    <div className="w-full bg-stone-100 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-2 rounded-full transition-all duration-500 ${
                          completionRate >= 70
                            ? 'bg-emerald-600'
                            : completionRate >= 40
                            ? 'bg-amber-500'
                            : 'bg-rose-500'
                        }`}
                        style={{ width: `${completionRate}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                      <span><strong>{completedCount}</strong> av {totalExpected} oppgaver gjennomgått</span>
                      {inProgressCount > 0 && (
                        <span className="text-amber-700 font-medium">{inProgressCount} i arbeid</span>
                      )}
                    </div>
                  </div>

                  {/* Enrolled Subjects Badges & Mastery */}
                  <div className="flex items-center justify-between gap-2 flex-wrap pt-2.5 mt-2 border-t border-stone-100">
                    <div className="flex items-center gap-1 flex-wrap">
                      {enrolledSubjects.map((sub) => (
                        <span
                          key={sub.id}
                          className="text-[10px] font-semibold px-2 py-0.5 rounded bg-stone-100 text-slate-700 border border-stone-200"
                        >
                          {sub.code}
                        </span>
                      ))}
                    </div>

                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${getMasteryBadgeClass(student.currentMastery)}`}>
                      {getMasteryLabel(student.currentMastery)}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-stone-100 text-xs">
                  <button
                    onClick={() => onSelectStudent(student)}
                    className="text-slate-700 hover:text-slate-900 font-semibold hover:underline inline-flex items-center gap-1"
                  >
                    <span>Åpne elevkort</span>
                    <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
                  </button>

                  <button
                    onClick={() => onOpenSessionPlanner(student.id, student.enrolledSubjectIds[0])}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 transition-colors"
                  >
                    <Printer className="w-3 h-3 text-emerald-700" />
                    <span>Planlegg time</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};
