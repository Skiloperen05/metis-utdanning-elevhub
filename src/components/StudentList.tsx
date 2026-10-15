import React, { useState, useMemo } from 'react';
import { 
  Users, 
  Search, 
  Plus, 
  BookOpen, 
  Award, 
  ChevronRight, 
  Clock, 
  Target, 
  GraduationCap,
  MessageSquare,
  AlertCircle,
  Printer,
  FileText
} from 'lucide-react';
import { AppDatabase, Student, MasteryLevel } from '../types';
import { getMasteryBadgeClass, getMasteryLabel } from '../lib/helpers';

interface StudentListProps {
  db: AppDatabase;
  onSelectStudent: (student: Student) => void;
  onOpenNewStudent: () => void;
  onOpenSessionPlanner?: (studentId: string, subjectId?: string) => void;
}

export const StudentList: React.FC<StudentListProps> = ({
  db,
  onSelectStudent,
  onOpenNewStudent,
  onOpenSessionPlanner,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('all');
  const [selectedMastery, setSelectedMastery] = useState<MasteryLevel | 'all'>('all');

  const filteredStudents = useMemo(() => {
    return db.students.filter((student) => {
      const sName = student.name || '';
      const sGroup = student.classGroup || '';
      const sEmail = student.email || '';
      const matchesSearch =
        sName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sGroup.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sEmail.toLowerCase().includes(searchQuery.toLowerCase());
      const subjectIds = student.enrolledSubjectIds || [];
      const matchesSubject =
        selectedSubjectId === 'all' || subjectIds.includes(selectedSubjectId);
      const matchesMastery =
        selectedMastery === 'all' || student.currentMastery === selectedMastery;
      return matchesSearch && matchesSubject && matchesMastery;
    });
  }, [db.students, searchQuery, selectedSubjectId, selectedMastery]);

  return (
    <div className="space-y-4">
      {/* Search & Filter Header */}
      <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Søk etter elevnavn, klasse eller e-post..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-stone-200 bg-stone-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-800"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Subject filter */}
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-stone-200 bg-stone-50 text-slate-700"
            >
              <option value="all">Alle fag</option>
              {db.subjects.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.name} ({sub.code})
                </option>
              ))}
            </select>

            {/* Mastery filter */}
            <select
              value={selectedMastery}
              onChange={(e) => setSelectedMastery(e.target.value as MasteryLevel | 'all')}
              className="px-2.5 py-1.5 text-xs rounded-lg border border-stone-200 bg-stone-50 text-slate-700"
            >
              <option value="all">Alle mestringsnivåer</option>
              <option value="svart_god">Svært høy måloppnåelse</option>
              <option value="god">God mestring</option>
              <option value="middels">Middels mestring</option>
              <option value="lav">Trenger grunnleggende støtte</option>
            </select>

            <button
              onClick={onOpenNewStudent}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              Opprett ny elev
            </button>
          </div>
        </div>
      </div>

      {/* Grid of Student Cards (Elevkort) */}
      {db.students.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-stone-300 p-12 text-center text-slate-500 shadow-2xs space-y-3">
          <Users className="w-10 h-10 mx-auto text-slate-400" />
          <div>
            <p className="font-semibold text-slate-800 text-sm">Ingen elever er registrert ennå</p>
            <p className="text-xs text-slate-500 mt-1">Opprett dine elever for å tilpasse oppgaver, veiledning og fremdriftsmatrise.</p>
          </div>
          <button
            type="button"
            onClick={onOpenNewStudent}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold shadow-2xs transition-colors"
          >
            + Opprett første elev
          </button>
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="bg-white rounded-xl border border-stone-200 p-12 text-center text-slate-500 shadow-2xs">
          <Users className="w-10 h-10 mx-auto text-slate-300 mb-2" />
          <p className="font-medium text-slate-700">Ingen elever samsvarer med søket.</p>
          <p className="text-xs text-slate-400 mt-1">Prøv å fjerne filtrene eller legg til en ny elev.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStudents.map((student) => {
            // Count assignments for this student
            const studentAssignments = db.assignments.filter((a) => a.studentId === student.id);
            const completedCount = studentAssignments.filter(
              (a) => a.status === 'gjennomgatt' || a.status === 'levert'
            ).length;
            const inProgressCount = studentAssignments.filter((a) => a.status === 'under_arbeid').length;
            const assignedCount = studentAssignments.filter((a) => a.status === 'tildelt').length;

            const studentSubjects = db.subjects.filter((s) =>
              (student.enrolledSubjectIds || []).includes(s.id)
            );

            const lastNote = student.notes && student.notes.length > 0
              ? student.notes[student.notes.length - 1]
              : null;

            return (
              <div
                key={student.id}
                onClick={() => onSelectStudent(student)}
                className="bg-white rounded-xl border border-stone-200 p-5 shadow-2xs hover:shadow-md hover:border-slate-300 transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  {/* Top card banner: Avatar, Name, Target Grade */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm ${student.avatarBg} shrink-0`}
                      >
                        {student.name.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900 group-hover:text-emerald-700 transition-colors">
                          {student.name}
                        </h3>
                        <p className="text-xs text-slate-500">{student.classGroup}</p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-slate-900 text-white shadow-2xs">
                        <Target className="w-3 h-3 text-emerald-400" />
                        Mål: {student.targetGrade}
                      </span>
                    </div>
                  </div>

                  {/* Mastery Badge */}
                  <div className="mb-3">
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-md ${getMasteryBadgeClass(student.currentMastery)}`}>
                      {getMasteryLabel(student.currentMastery)}
                    </span>
                  </div>

                  {/* Enrolled Subjects */}
                  <div className="mb-3">
                    <div className="text-[11px] font-medium text-slate-400 mb-1">Fag:</div>
                    <div className="flex flex-wrap gap-1.5">
                      {studentSubjects.map((s) => (
                        <span
                          key={s.id}
                          className="px-2 py-0.5 rounded text-[11px] font-medium bg-stone-100 text-slate-700 border border-stone-200"
                        >
                          {s.name}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Progress Stats */}
                  <div className="bg-stone-50 rounded-lg p-2.5 border border-stone-100 mb-3 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-slate-600">
                      <span>Fremdrift i pensum & eksamener:</span>
                      <span className="font-semibold text-slate-900">
                        {completedCount} av {studentAssignments.length}
                      </span>
                    </div>
                    {/* Progress Bar */}
                    <div className="w-full h-1.5 bg-stone-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-600 rounded-full transition-all duration-300"
                        style={{
                          width: `${
                            studentAssignments.length > 0
                              ? Math.round((completedCount / studentAssignments.length) * 100)
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                      <span>{inProgressCount} under arbeid</span>
                      <span>{assignedCount} tildelt</span>
                    </div>
                  </div>

                  {/* Strengths / Special notes preview */}
                  {student.strengths && (
                    <p className="text-xs text-slate-600 line-clamp-2 italic mb-2">
                      &ldquo;{student.strengths}&rdquo;
                    </p>
                  )}
                </div>

                {/* Footer: Latest note & Action buttons */}
                <div className="pt-3 border-t border-stone-100 flex items-center justify-between text-xs text-slate-500 gap-2">
                  {lastNote ? (
                    <span className="flex items-center gap-1 truncate max-w-[150px]" title={lastNote.content}>
                      <MessageSquare className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="truncate">{lastNote.content}</span>
                    </span>
                  ) : (
                    <span className="text-slate-400 italic">Ingen notater</span>
                  )}

                  <div className="flex items-center gap-1.5 shrink-0">
                    {onOpenSessionPlanner && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenSessionPlanner(student.id, student.enrolledSubjectIds[0]);
                        }}
                        className="px-2 py-1 rounded bg-stone-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border border-stone-200 hover:border-emerald-300 font-medium text-[11px] transition-colors flex items-center gap-1"
                        title="Planlegg veiledningstime og skriv ut oppgavesett for denne eleven"
                      >
                        <Printer className="w-3 h-3 text-emerald-700" />
                        <span>Planlegg</span>
                      </button>
                    )}

                    <span className="text-emerald-700 font-medium flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                      Elevkort <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
