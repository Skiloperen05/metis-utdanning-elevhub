import React, { useState, useEffect } from 'react';
import { X, BookOpen, Save, Trash2, AlertTriangle } from 'lucide-react';
import { Subject } from '../types';

interface SubjectModalProps {
  isOpen: boolean;
  subjectToEdit?: Subject | null;
  onClose: () => void;
  onSaveSubject: (subject: Subject) => void;
  onDeleteSubject?: (subjectId: string) => void;
}

export const SubjectModal: React.FC<SubjectModalProps> = ({
  isOpen,
  subjectToEdit,
  onClose,
  onSaveSubject,
  onDeleteSubject,
}) => {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [gradeLevel, setGradeLevel] = useState('VG1');
  const [description, setDescription] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (subjectToEdit) {
      setCode(subjectToEdit.code);
      setName(subjectToEdit.name);
      setGradeLevel(subjectToEdit.gradeLevel);
      setDescription(subjectToEdit.description);
    } else {
      setCode('');
      setName('');
      setGradeLevel('VG1');
      setDescription('');
    }
    setShowDeleteConfirm(false);
  }, [subjectToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) return;

    const subject: Subject = {
      id: subjectToEdit ? subjectToEdit.id : `sub-${code.trim().toLowerCase().replace(/[^a-z0-9]/g, '')}-${Date.now()}`,
      code: code.trim().toUpperCase(),
      name: name.trim(),
      gradeLevel: gradeLevel.trim(),
      description: description.trim(),
      color: subjectToEdit?.color || 'bg-emerald-50 text-emerald-800 border-emerald-200',
    };

    onSaveSubject(subject);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-md w-full border border-stone-200 shadow-2xl overflow-hidden my-auto">
        <div className="flex items-center justify-between p-5 border-b border-stone-200 bg-stone-50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-base">
                {subjectToEdit ? 'Rediger fag' : 'Legg til nytt fag'}
              </h2>
              <p className="text-xs text-slate-500">
                {subjectToEdit ? 'Oppdater fagdetaljer' : 'Opprett et fag i fag- og materialbanken'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-stone-200/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Fagkode <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="f.eks. 1T, S2, R2, FY1"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full p-2 rounded-lg border border-stone-300 bg-white font-semibold uppercase text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-800"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Trinn / Nivå
              </label>
              <select
                value={gradeLevel}
                onChange={(e) => setGradeLevel(e.target.value)}
                className="w-full p-2 rounded-lg border border-stone-300 bg-white font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-800"
              >
                <option value="VG1">VG1</option>
                <option value="VG2">VG2</option>
                <option value="VG3">VG3</option>
                <option value="Privatist">Privatist</option>
                <option value="Påbygg">Påbygg</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Fagnavn <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="f.eks. Matematikk 1T, Matematikk S2, Fysikk 1"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-2 rounded-lg border border-stone-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-800"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Beskrivelse / Læreplan
            </label>
            <textarea
              rows={3}
              placeholder="Kort beskrivelse av faget, pensumkrav eller eksamensform..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-2 rounded-lg border border-stone-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-800"
            />
          </div>

          {/* Delete confirmation section */}
          {showDeleteConfirm && subjectToEdit && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-2 text-rose-800">
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Bekreft sletting av faget</span>
              </div>
              <p className="text-[11px] text-rose-700">
                Er du sikker? Dette vil fjerne faget fra oversikten og fra elevenes faglister.
              </p>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-2.5 py-1 rounded bg-white border border-rose-200 text-slate-700 font-medium hover:bg-stone-50 text-xs"
                >
                  Avbryt
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (onDeleteSubject) {
                      onDeleteSubject(subjectToEdit.id);
                      onClose();
                    }
                  }}
                  className="px-2.5 py-1 rounded bg-rose-600 text-white font-medium hover:bg-rose-700 text-xs shadow-2xs"
                >
                  Ja, slett fag
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-stone-100">
            {subjectToEdit && onDeleteSubject && !showDeleteConfirm ? (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="inline-flex items-center gap-1 text-rose-600 hover:text-rose-800 font-medium"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Slett fag</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 rounded-lg border border-stone-300 text-slate-600 hover:bg-stone-100 font-medium"
              >
                Avbryt
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold shadow-2xs transition-colors"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{subjectToEdit ? 'Lagre endringer' : 'Opprett fag'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
