import React, { useState, useMemo } from 'react';
import { 
  Calendar, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Plus, 
  Printer, 
  Download, 
  Eye, 
  User, 
  BookOpen, 
  Search, 
  Filter, 
  ChevronDown, 
  ChevronUp, 
  CheckSquare, 
  Square, 
  Trash2, 
  Edit3, 
  FileText, 
  ArrowRight,
  ExternalLink,
  Sparkles
} from 'lucide-react';
import { AppDatabase, PlannedSession, Student, Subject, Material, Assignment } from '../types';
import { getCategoryBadgeClass, getCategoryLabel } from '../lib/helpers';
import { generateSessionPacketPDF } from '../lib/sessionPdfGenerator';

interface SessionsViewProps {
  db: AppDatabase;
  onSelectStudent: (student: Student) => void;
  onOpenSessionPlanner: (defaultStudentId?: string, defaultSubjectId?: string, sessionToEdit?: PlannedSession) => void;
  onCompleteSession: (sessionId: string, completedMaterialIds?: string[]) => void;
  onDeleteSession: (sessionId: string) => void;
  onUpdateSession: (session: PlannedSession) => void;
}

export const SessionsView: React.FC<SessionsViewProps> = ({
  db,
  onSelectStudent,
  onOpenSessionPlanner,
  onCompleteSession,
  onDeleteSession,
  onUpdateSession,
}) => {
  const [filterTab, setFilterTab] = useState<'planlagt' | 'gjennomfort' | 'alle'>('planlagt');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudentFilter, setSelectedStudentFilter] = useState<string>('all');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('all');
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);

  // PDF Preview State
  const [downloadNotice, setDownloadNotice] = useState<string | null>(null);

  const sessions = useMemo(() => db.sessions || [], [db.sessions]);

  // Statistics
  const totalPlanned = useMemo(() => {
    return sessions.filter((s) => s.status === 'planlagt').length;
  }, [sessions]);

  const totalCompleted = useMemo(() => {
    return sessions.filter((s) => s.status === 'gjennomfort').length;
  }, [sessions]);

  // Today's date string
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // Filtered & sorted sessions
  const filteredSessions = useMemo(() => {
    return sessions
      .filter((s) => {
        if (filterTab === 'planlagt' && s.status !== 'planlagt') return false;
        if (filterTab === 'gjennomfort' && s.status !== 'gjennomfort') return false;
        if (selectedStudentFilter !== 'all' && s.studentId !== selectedStudentFilter) return false;
        if (selectedSubjectFilter !== 'all' && s.subjectId !== selectedSubjectFilter) return false;

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const student = db.students.find((st) => st.id === s.studentId);
          const subject = db.subjects.find((sub) => sub.id === s.subjectId);
          const studentName = student?.name?.toLowerCase() || '';
          const subjectName = subject?.name?.toLowerCase() || '';
          const title = s.title?.toLowerCase() || '';
          const goals = s.goals?.toLowerCase() || '';
          return studentName.includes(q) || subjectName.includes(q) || title.includes(q) || goals.includes(q);
        }

        return true;
      })
      .sort((a, b) => {
        // Sort planlagt: closest date first
        // Sort gjennomført: newest completed first
        if (filterTab === 'gjennomfort') {
          return b.date.localeCompare(a.date);
        }
        return a.date.localeCompare(b.date);
      });
  }, [sessions, filterTab, selectedStudentFilter, selectedSubjectFilter, searchQuery, db.students, db.subjects]);

  // Toggle item completed inside a session
  const handleToggleItemCompleted = (session: PlannedSession, materialId: string) => {
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
  };

  // Mark an entire session as completed and automatically update student assignments
  const handleMarkSessionCompleted = (session: PlannedSession) => {
    const allMaterialIds = session.items.map((i) => i.materialId);
    onCompleteSession(session.id, allMaterialIds);
  };

  // Generate PDF on the fly for a session
  const handleDownloadSessionPdf = (session: PlannedSession) => {
    const student = db.students.find((s) => s.id === session.studentId);
    const subject = db.subjects.find((s) => s.id === session.subjectId);
    if (!student || !subject) return;

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
      setDownloadNotice(`Timeplan og hefte for ${student.name} ble lastet ned!`);
      setTimeout(() => setDownloadNotice(null), 4000);
    } catch (e) {
      console.error('Feil ved generering av PDF:', e);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Header Banner */}
      <div className="bg-white border border-stone-200 rounded-2xl p-5 sm:p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-emerald-700 text-white flex items-center justify-center shrink-0 shadow-2xs">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                  Veiledningstimer & Planlegging
                </h1>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                  {totalPlanned} planlagt
                </span>
                {totalCompleted > 0 && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-stone-100 text-slate-600 border border-stone-200">
                    {totalCompleted} gjennomført
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1 max-w-2xl">
                Oversikt over alle planlagte og gjennomførte undervisningstimer. Når du markerer en time som gjennomført, oppdateres elevens fremdrift og materialmatrise automatisk uten at du må føre noe to ganger.
              </p>
            </div>
          </div>

          <button
            onClick={() => onOpenSessionPlanner()}
            id="btn-plan-new-session"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-700 text-white font-bold hover:bg-emerald-800 transition-colors text-xs shadow-2xs shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Planlegg ny time</span>
          </button>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6 pt-5 border-t border-stone-100 text-xs">
          <div className="bg-stone-50 rounded-xl p-3.5 border border-stone-200/80">
            <div className="text-slate-500 font-medium text-[11px]">Kommende planlagte timer</div>
            <div className="text-2xl font-bold text-emerald-800 mt-0.5">{totalPlanned}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Klar til undervisning og utskrift</div>
          </div>

          <div className="bg-stone-50 rounded-xl p-3.5 border border-stone-200/80">
            <div className="text-slate-500 font-medium text-[11px]">Fullførte veiledningstimer</div>
            <div className="text-2xl font-bold text-slate-900 mt-0.5">{totalCompleted}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Logget med oppgaver og sensorfokus</div>
          </div>

          <div className="bg-stone-50 rounded-xl p-3.5 border border-stone-200/80">
            <div className="text-slate-500 font-medium text-[11px]">Automatisert dobbeltføring</div>
            <div className="text-2xl font-bold text-emerald-700 mt-0.5">100 %</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Oppgaver oppdateres direkte på eleven</div>
          </div>
        </div>
      </div>

      {downloadNotice && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-2xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-700" />
          <span>{downloadNotice}</span>
        </div>
      )}

      {/* Filter and search bar */}
      <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        
        {/* Status tabs */}
        <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl text-xs">
          <button
            onClick={() => setFilterTab('planlagt')}
            className={`px-3.5 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
              filterTab === 'planlagt'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-emerald-600" />
            <span>Planlagte ({totalPlanned})</span>
          </button>

          <button
            onClick={() => setFilterTab('gjennomfort')}
            className={`px-3.5 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
              filterTab === 'gjennomfort'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-slate-700" />
            <span>Gjennomførte ({totalCompleted})</span>
          </button>

          <button
            onClick={() => setFilterTab('alle')}
            className={`px-3.5 py-1.5 rounded-lg font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
              filterTab === 'alle'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Alle ({sessions.length})</span>
          </button>
        </div>

        {/* Filter controls */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <div className="relative flex-1 sm:w-56">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Søk i timer, elever, mål..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <select
            value={selectedStudentFilter}
            onChange={(e) => setSelectedStudentFilter(e.target.value)}
            className="py-1.5 px-2.5 bg-stone-50 border border-stone-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none cursor-pointer"
          >
            <option value="all">Alle elever ({db.students.length})</option>
            {db.students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          <select
            value={selectedSubjectFilter}
            onChange={(e) => setSelectedSubjectFilter(e.target.value)}
            className="py-1.5 px-2.5 bg-stone-50 border border-stone-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none cursor-pointer"
          >
            <option value="all">Alle fag ({db.subjects.length})</option>
            {db.subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} - {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Session Cards List */}
      {filteredSessions.length === 0 ? (
        <div className="bg-white border border-stone-200 rounded-2xl p-10 text-center space-y-3 shadow-2xs">
          <div className="w-12 h-12 rounded-2xl bg-stone-100 text-slate-400 flex items-center justify-center mx-auto">
            <Calendar className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-slate-900 text-sm">
            {filterTab === 'planlagt' 
              ? 'Ingen planlagte timer funnet'
              : filterTab === 'gjennomfort'
              ? 'Ingen gjennomførte timer funnet'
              : 'Ingen timer funnet'}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {filterTab === 'planlagt'
              ? 'Når du planlegger en time via timeplanleggeren, lagres den her og på elevens profil, og du kan markere den som gjort med ett klikk.'
              : 'Gjennomførte timer vil vises her som en historikk over hva eleven har mestret.'}
          </p>
          <button
            onClick={() => onOpenSessionPlanner()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 text-white font-bold hover:bg-emerald-800 transition-colors text-xs shadow-2xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Planlegg din første veiledningstime</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredSessions.map((session) => {
            const student = db.students.find((s) => s.id === session.studentId);
            const subject = db.subjects.find((s) => s.id === session.subjectId);
            const isExpanded = expandedSessionId === session.id;
            const isToday = session.date === todayStr;
            const isPast = session.date < todayStr && session.status === 'planlagt';
            const isCompleted = session.status === 'gjennomfort';

            const itemsCount = session.items?.length || 0;
            const completedItemsCount = (session.items || []).filter((i) => i.completed).length;

            return (
              <div
                key={session.id}
                className={`bg-white border rounded-2xl transition-all shadow-2xs overflow-hidden ${
                  isCompleted 
                    ? 'border-stone-200 bg-stone-50/40' 
                    : isToday 
                    ? 'border-emerald-300 ring-2 ring-emerald-500/10' 
                    : isPast 
                    ? 'border-amber-300 bg-amber-50/20' 
                    : 'border-stone-200 hover:border-stone-300'
                }`}
              >
                {/* Session Card Main Row */}
                <div className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  
                  {/* Left: Date badge & main details */}
                  <div className="flex items-start gap-3.5">
                    {/* Date Pill / Badge */}
                    <div className={`shrink-0 w-16 text-center rounded-xl p-2 border flex flex-col items-center justify-center ${
                      isCompleted
                        ? 'bg-stone-100 text-slate-600 border-stone-200'
                        : isToday
                        ? 'bg-emerald-700 text-white border-emerald-800 shadow-2xs'
                        : isPast
                        ? 'bg-amber-100 text-amber-900 border-amber-300'
                        : 'bg-stone-50 text-slate-700 border-stone-200'
                    }`}>
                      <span className="text-[10px] font-bold uppercase tracking-wider">
                        {isToday ? 'I DAG' : new Date(session.date).toLocaleDateString('no-NO', { weekday: 'short' })}
                      </span>
                      <span className="text-base font-extrabold leading-tight">
                        {new Date(session.date).getDate()}
                      </span>
                      <span className="text-[10px] font-medium opacity-80">
                        {new Date(session.date).toLocaleDateString('no-NO', { month: 'short' })}
                      </span>
                    </div>

                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Status Badge */}
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isCompleted
                            ? 'bg-emerald-100 text-emerald-800'
                            : isToday
                            ? 'bg-emerald-600 text-white'
                            : isPast
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-stone-100 text-slate-600'
                        }`}>
                          {isCompleted ? '✓ Gjennomført' : isToday ? 'Planlagt i dag' : isPast ? 'Dato passert' : 'Planlagt time'}
                        </span>

                        {subject && (
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-stone-100 text-slate-800 border border-stone-200">
                            {subject.code} • {subject.name}
                          </span>
                        )}

                        <span className="text-xs text-slate-500 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>kl. {session.time}</span>
                        </span>
                      </div>

                      <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                        {session.title}
                      </h3>

                      {/* Student row */}
                      {student && (
                        <div className="flex items-center gap-2 pt-0.5">
                          <button
                            type="button"
                            onClick={() => onSelectStudent(student)}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 hover:text-emerald-900 hover:underline cursor-pointer"
                          >
                            <div className="w-5 h-5 rounded-full bg-slate-900 text-white text-[10px] font-bold flex items-center justify-center">
                              {student.name.charAt(0)}
                            </div>
                            <span>{student.name}</span>
                            <span className="text-[11px] font-normal text-slate-500">
                              ({student.classGroup} • Mål: Karakter {student.targetGrade})
                            </span>
                          </button>
                        </div>
                      )}

                      {session.goals && (
                        <p className="text-xs text-slate-600 italic line-clamp-1">
                          «{session.goals}»
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right: Actions & status summary */}
                  <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0 lg:self-center border-t lg:border-t-0 pt-3 lg:pt-0 border-stone-100">
                    
                    {/* Primary Complete Button */}
                    {!isCompleted ? (
                      <button
                        type="button"
                        onClick={() => handleMarkSessionCompleted(session)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 text-white font-bold hover:bg-emerald-800 transition-colors text-xs shadow-2xs cursor-pointer"
                        title="Marker hele timen som gjennomført. Dette oppdaterer automatisk oppgavene på elevkortet til 'Gjennomgått'!"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Marker som gjort</span>
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 font-semibold text-xs border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Fullført</span>
                      </span>
                    )}

                    {/* Download PDF Packet */}
                    <button
                      type="button"
                      onClick={() => handleDownloadSessionPdf(session)}
                      className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl border border-stone-200 bg-white text-slate-700 hover:bg-stone-50 transition-colors text-xs font-medium cursor-pointer"
                      title="Last ned A4-PDF med oppgavesett og notater"
                    >
                      <Download className="w-3.5 h-3.5 text-slate-500" />
                      <span className="hidden sm:inline">PDF</span>
                    </button>

                    {/* Edit Session */}
                    <button
                      type="button"
                      onClick={() => onOpenSessionPlanner(session.studentId, session.subjectId, session)}
                      className="p-2 rounded-xl border border-stone-200 bg-white text-slate-600 hover:text-slate-900 hover:bg-stone-50 transition-colors text-xs cursor-pointer"
                      title="Rediger time / legg til oppgaver"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete Session */}
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Er du sikker på at du vil slette veiledningstimen for ${student?.name || 'eleven'}?`)) {
                          onDeleteSession(session.id);
                        }
                      }}
                      className="p-2 rounded-xl border border-stone-200 bg-white text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors text-xs cursor-pointer"
                      title="Slett time"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    {/* Expand/Collapse Items Details */}
                    <button
                      type="button"
                      onClick={() => setExpandedSessionId(isExpanded ? null : session.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl border border-stone-200 bg-stone-50 text-slate-700 hover:bg-stone-100 transition-colors text-xs font-semibold cursor-pointer"
                    >
                      <span>{itemsCount} oppgaver</span>
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Expanded Details: Materials & Tasks Checklist */}
                {isExpanded && (
                  <div className="bg-stone-50/80 border-t border-stone-200 p-4 sm:p-5 space-y-4 text-xs">
                    <div className="flex items-center justify-between gap-2 border-b border-stone-200 pb-2">
                      <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                        <CheckSquare className="w-4 h-4 text-emerald-700" />
                        Gjennomgangsliste for timen ({completedItemsCount}/{itemsCount} fullført)
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Kryss av oppgaver etter hvert som dere går gjennom dem
                      </span>
                    </div>

                    {session.teacherNotes && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-900 text-xs">
                        <strong>Lærernotat til timen:</strong> {session.teacherNotes}
                      </div>
                    )}

                    {itemsCount === 0 ? (
                      <div className="text-slate-400 italic text-xs py-2">
                        Ingen oppgaver eller pensumdeler er lagt til denne timen ennå.{' '}
                        <button
                          type="button"
                          onClick={() => onOpenSessionPlanner(session.studentId, session.subjectId, session)}
                          className="text-emerald-700 font-semibold underline cursor-pointer"
                        >
                          Legg til oppgaver
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {session.items.map((item, idx) => {
                          const mat = db.materials.find((m) => m.id === item.materialId);
                          const isDone = item.completed;

                          return (
                            <div
                              key={item.materialId}
                              className={`p-3 rounded-xl border flex items-start justify-between gap-3 transition-colors ${
                                isDone
                                  ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
                                  : 'bg-white border-stone-200 text-slate-800'
                              }`}
                            >
                              <div className="flex items-start gap-2.5 flex-1">
                                <button
                                  type="button"
                                  onClick={() => handleToggleItemCompleted(session, item.materialId)}
                                  className="mt-0.5 text-slate-500 hover:text-emerald-700 cursor-pointer"
                                  title={isDone ? 'Marker som ikke fullført' : 'Marker som fullført'}
                                >
                                  {isDone ? (
                                    <CheckSquare className="w-4 h-4 text-emerald-700" />
                                  ) : (
                                    <Square className="w-4 h-4 text-slate-400" />
                                  )}
                                </button>

                                <div className="space-y-1 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-bold text-slate-900 text-xs">
                                      {idx + 1}. {mat?.title || 'Materiale'}
                                    </span>
                                    {mat && (
                                      <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded ${getCategoryBadgeClass(mat.category)}`}>
                                        {getCategoryLabel(mat.category)}
                                      </span>
                                    )}
                                    {isDone && (
                                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded">
                                        ✓ Fullført
                                      </span>
                                    )}
                                  </div>

                                  {mat?.description && (
                                    <p className="text-slate-600 text-xs line-clamp-2">
                                      {mat.description}
                                    </p>
                                  )}

                                  {item.customNote && (
                                    <div className="text-[11px] text-emerald-900 bg-white p-1.5 rounded border border-emerald-200 inline-block">
                                      <strong>Elevinstruks:</strong> {item.customNote}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Quick action bar inside expanded card */}
                    <div className="pt-2 flex items-center justify-between gap-2 border-t border-stone-200">
                      <div className="text-[11px] text-slate-500">
                        {isCompleted 
                          ? 'Timen er registrert som gjennomført.' 
                          : 'Trykk «Marker som gjort» for å oppdatere elevens progresjonsmatrise.'}
                      </div>

                      <div className="flex items-center gap-2">
                        {!isCompleted && (
                          <button
                            type="button"
                            onClick={() => handleMarkSessionCompleted(session)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 text-white font-bold hover:bg-emerald-800 text-xs shadow-2xs cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Marker hele timen som gjennomført</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDownloadSessionPdf(session)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-300 bg-white text-slate-700 hover:bg-stone-50 text-xs font-semibold cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Last ned timepakke (PDF)</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};
