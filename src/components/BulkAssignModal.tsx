import React, { useState, useMemo } from 'react';
import { X, Send, CheckCircle2, Users, BookOpen } from 'lucide-react';
import { AppDatabase, Assignment, AssignmentStatus, Material, Student } from '../types';

interface BulkAssignModalProps {
  db: AppDatabase;
  defaultMaterial?: Material | null;
  defaultStudent?: Student | null;
  onClose: () => void;
  onSaveAssignments: (assignments: Assignment[]) => void;
}

export const BulkAssignModal: React.FC<BulkAssignModalProps> = ({
  db,
  defaultMaterial,
  defaultStudent,
  onClose,
  onSaveAssignments,
}) => {
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>(
    defaultMaterial?.id || (db.materials[0]?.id || '')
  );
  const [targetStatus, setTargetStatus] = useState<AssignmentStatus>('tildelt');
  const [teacherNote, setTeacherNote] = useState('');

  const currentMaterial = useMemo(() => {
    return db.materials.find((m) => m.id === selectedMaterialId);
  }, [db.materials, selectedMaterialId]);

  // Eligible students (students taking this material's subject)
  const eligibleStudents = useMemo(() => {
    if (!currentMaterial) return db.students;
    return db.students.filter((s) =>
      s.enrolledSubjectIds.includes(currentMaterial.subjectId)
    );
  }, [db.students, currentMaterial]);

  // Selected student IDs for bulk assignment
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>(
    defaultStudent ? [defaultStudent.id] : []
  );

  // Toggle select all
  const handleSelectAll = () => {
    if (selectedStudentIds.length === eligibleStudents.length) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(eligibleStudents.map((s) => s.id));
    }
  };

  const handleToggleStudent = (studentId: string) => {
    if (selectedStudentIds.includes(studentId)) {
      setSelectedStudentIds(selectedStudentIds.filter((id) => id !== studentId));
    } else {
      setSelectedStudentIds([...selectedStudentIds, studentId]);
    }
  };

  const handleAssign = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMaterialId || selectedStudentIds.length === 0) return;

    const updatedAssignments: Assignment[] = selectedStudentIds.map((studId) => {
      const existing = db.assignments.find(
        (a) => a.studentId === studId && a.materialId === selectedMaterialId
      );

      return {
        id: existing?.id || `asgn-${Date.now()}-${studId.slice(-4)}`,
        studentId: studId,
        materialId: selectedMaterialId,
        status: targetStatus,
        assignedDate: existing?.assignedDate || new Date().toISOString().slice(0, 10),
        completedDate:
          targetStatus === 'gjennomgatt' || targetStatus === 'levert'
            ? new Date().toISOString().slice(0, 10)
            : undefined,
        teacherNote: teacherNote.trim() || existing?.teacherNote || '',
        studentScore: existing?.studentScore || '',
      };
    });

    onSaveAssignments(updatedAssignments);
    onClose();
  };

  const currentSubject = db.subjects.find((s) => s.id === currentMaterial?.subjectId);

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full border border-stone-200 shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="bg-stone-50 border-b border-stone-200 p-4 sm:p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-700 text-white flex items-center justify-center">
              <Send className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Tildel fagmateriell til elever</h3>
              <p className="text-xs text-slate-500">
                Velg oppgave/eksamen og tildel til én eller flere elever
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleAssign} className="p-5 sm:p-6 overflow-y-auto space-y-4 text-xs">
          
          {/* Material selector */}
          <div>
            <label className="block text-slate-700 font-semibold mb-1">Velg pensumdel eller eksamen *</label>
            <select
              value={selectedMaterialId}
              onChange={(e) => {
                setSelectedMaterialId(e.target.value);
                setSelectedStudentIds([]);
              }}
              className="w-full p-2 border border-stone-300 rounded-lg bg-white"
            >
              {db.materials.map((m) => {
                const sub = db.subjects.find((s) => s.id === m.subjectId);
                return (
                  <option key={m.id} value={m.id}>
                    [{sub?.name}] {m.title} ({m.category})
                  </option>
                );
              })}
            </select>
          </div>

          {currentMaterial && (
            <div className="bg-stone-50 p-2.5 rounded-lg border border-stone-200 text-[11px] text-slate-600">
              <span className="font-semibold text-slate-800">Fag:</span> {currentSubject?.name} •{' '}
              <span className="font-semibold text-slate-800">Beskrivelse:</span> {currentMaterial.description}
            </div>
          )}

          {/* Status selector */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Sett status *</label>
              <select
                value={targetStatus}
                onChange={(e) => setTargetStatus(e.target.value as AssignmentStatus)}
                className="w-full p-2 border border-stone-300 rounded-lg bg-white font-medium"
              >
                <option value="tildelt">Tildelt (Lekse / Oppgave gitt)</option>
                <option value="gjennomgatt">Gjennomgått i time (Fullført i dag)</option>
                <option value="under_arbeid">Under arbeid</option>
                <option value="levert">Levert</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Lærernotat (valgfritt)</label>
              <input
                type="text"
                placeholder="F.eks. Gjennomgått i veiledningstimen"
                value={teacherNote}
                onChange={(e) => setTeacherNote(e.target.value)}
                className="w-full p-2 border border-stone-300 rounded-lg"
              />
            </div>
          </div>

          {/* Students Checklist */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-slate-700 font-semibold flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-slate-500" />
                Velg elever i {currentSubject?.name || 'faget'}:
              </label>
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-emerald-700 hover:text-emerald-800 text-[11px] font-medium"
              >
                {selectedStudentIds.length === eligibleStudents.length ? 'Fjern alle' : 'Velg alle elever'}
              </button>
            </div>

            <div className="border border-stone-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto divide-y divide-stone-100">
              {eligibleStudents.length === 0 ? (
                <div className="p-4 text-center text-slate-400">Ingen elever tar dette faget ennå.</div>
              ) : (
                eligibleStudents.map((stud) => {
                  const existing = db.assignments.find(
                    (a) => a.studentId === stud.id && a.materialId === selectedMaterialId
                  );
                  const isChecked = selectedStudentIds.includes(stud.id);

                  return (
                    <label
                      key={stud.id}
                      className={`flex items-center justify-between p-2.5 cursor-pointer transition-colors ${
                        isChecked ? 'bg-emerald-50/50' : 'hover:bg-stone-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleStudent(stud.id)}
                          className="rounded text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="font-medium text-slate-900">{stud.name}</span>
                        <span className="text-[10px] text-slate-400">{stud.classGroup}</span>
                      </div>

                      {existing ? (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-stone-100 text-slate-600 border border-stone-200">
                          Nå: {existing.status}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400">Ikke tildelt</span>
                      )}
                    </label>
                  );
                })
              )}
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-between pt-3 border-t border-stone-200">
            <span className="text-slate-500 text-[11px]">
              {selectedStudentIds.length} elev(er) valgt
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 rounded-lg border border-stone-300 text-slate-700 hover:bg-stone-100"
              >
                Avbryt
              </button>
              <button
                type="submit"
                disabled={selectedStudentIds.length === 0}
                className="px-4 py-1.5 rounded-lg bg-emerald-700 text-white font-medium hover:bg-emerald-800 disabled:opacity-50 shadow-2xs"
              >
                Fullfør tildeling
              </button>
            </div>
          </div>
        </form>

      </div>
    </div>
  );
};
