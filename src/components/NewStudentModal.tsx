import React, { useState } from 'react';
import { X, UserPlus, Target, BookOpen } from 'lucide-react';
import { AppDatabase, MasteryLevel, Student } from '../types';

interface NewStudentModalProps {
  db: AppDatabase;
  onClose: () => void;
  onSaveStudent: (newStudent: Student) => void;
}

const AVATAR_COLORS = [
  'bg-emerald-100 text-emerald-800 border-emerald-300',
  'bg-blue-100 text-blue-800 border-blue-300',
  'bg-purple-100 text-purple-800 border-purple-300',
  'bg-amber-100 text-amber-800 border-amber-300',
  'bg-rose-100 text-rose-800 border-rose-300',
  'bg-teal-100 text-teal-800 border-teal-300',
  'bg-indigo-100 text-indigo-800 border-indigo-300',
];

export const NewStudentModal: React.FC<NewStudentModalProps> = ({
  db,
  onClose,
  onSaveStudent,
}) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [classGroup, setClassGroup] = useState('Privatist Vår 2025 - Gruppe A');
  const [targetGrade, setTargetGrade] = useState<number>(5);
  const [currentMastery, setCurrentMastery] = useState<MasteryLevel>('middels');
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>(
    db.subjects.length > 0 ? [db.subjects[0].id] : []
  );
  const [strengths, setStrengths] = useState('');
  const [areasToImprove, setAreasToImprove] = useState('');
  const [personalGoals, setPersonalGoals] = useState('');
  const [specialConsiderations, setSpecialConsiderations] = useState('');

  const handleToggleSubject = (subId: string) => {
    if (selectedSubjects.includes(subId)) {
      setSelectedSubjects(selectedSubjects.filter((id) => id !== subId));
    } else {
      setSelectedSubjects([...selectedSubjects, subId]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const randomColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

    const newStudent: Student = {
      id: `stud-${Date.now()}`,
      name: name.trim(),
      email: email.trim() || `${name.toLowerCase().replace(/\s+/g, '.')}@metis-elev.no`,
      phone: phone.trim(),
      classGroup: classGroup.trim(),
      enrolledSubjectIds: selectedSubjects,
      targetGrade,
      currentMastery,
      strengths: strengths.trim(),
      areasToImprove: areasToImprove.trim(),
      personalGoals: personalGoals.trim(),
      specialConsiderations: specialConsiderations.trim(),
      notes: [
        {
          id: `note-${Date.now()}`,
          date: new Date().toISOString().slice(0, 10),
          author: 'Lærer',
          content: 'Elevkort opprettet i Metis Lærerhub.',
          type: 'oppfølging',
        },
      ],
      avatarBg: randomColor,
      createdAt: new Date().toISOString().slice(0, 10),
    };

    onSaveStudent(newStudent);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-xl w-full border border-stone-200 shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="bg-stone-50 border-b border-stone-200 p-4 sm:p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Opprett nytt elevkort</h3>
              <p className="text-xs text-slate-500">Registrer en ny elev ved Metis Utdanning</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-4 text-xs">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Fullt navn *</label>
              <input
                type="text"
                required
                placeholder="F.eks. Sander Olsen"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-slate-800"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Klasse / Gruppe</label>
              <input
                type="text"
                placeholder="F.eks. Privatist V25 - Gruppe A"
                value={classGroup}
                onChange={(e) => setClassGroup(e.target.value)}
                className="w-full p-2 border border-stone-300 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">E-post</label>
              <input
                type="email"
                placeholder="elev@metis-elev.no"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-2 border border-stone-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Telefonnummer</label>
              <input
                type="tel"
                placeholder="F.eks. 987 65 432"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full p-2 border border-stone-300 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Målkarakter (1-6)</label>
              <input
                type="number"
                min={1}
                max={6}
                value={targetGrade}
                onChange={(e) => setTargetGrade(Number(e.target.value))}
                className="w-full p-2 border border-stone-300 rounded-lg font-bold text-slate-900"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Nåværende mestringsnivå</label>
              <select
                value={currentMastery}
                onChange={(e) => setCurrentMastery(e.target.value as MasteryLevel)}
                className="w-full p-2 border border-stone-300 rounded-lg bg-white"
              >
                <option value="lav">Trenger grunnleggende støtte</option>
                <option value="middels">Middels mestring</option>
                <option value="god">God mestring</option>
                <option value="svart_god">Svært høy måloppnåelse</option>
              </select>
            </div>
          </div>

          {/* Subjects selection */}
          <div>
            <label className="block text-slate-700 font-semibold mb-1.5 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-slate-500" />
              Velg fag eleven tar hos Metis:
            </label>
            <div className="grid grid-cols-2 gap-2">
              {db.subjects.map((sub) => (
                <label
                  key={sub.id}
                  className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                    selectedSubjects.includes(sub.id)
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-medium'
                      : 'bg-stone-50 border-stone-200 text-slate-600'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedSubjects.includes(sub.id)}
                    onChange={() => handleToggleSubject(sub.id)}
                    className="rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span>{sub.name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Strengths & Improvement areas */}
          <div className="space-y-3 pt-1">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Styrker / Kompetanse</label>
              <input
                type="text"
                placeholder="F.eks. Rask til å forstå formler, flink i GeoGebra"
                value={strengths}
                onChange={(e) => setStrengths(e.target.value)}
                className="w-full p-2 border border-stone-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Forbedringsområder / Utfordringer</label>
              <input
                type="text"
                placeholder="F.eks. Sliter med fortegnsskjema og del 1 uten hjelpemidler"
                value={areasToImprove}
                onChange={(e) => setAreasToImprove(e.target.value)}
                className="w-full p-2 border border-stone-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Personlige mål & studieplaner</label>
              <input
                type="text"
                placeholder="F.eks. Trenger 5-er for opptak på tannlege/sivilingeniør"
                value={personalGoals}
                onChange={(e) => setPersonalGoals(e.target.value)}
                className="w-full p-2 border border-stone-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Tilrettelegging / Spesielle hensyn</label>
              <input
                type="text"
                placeholder="F.eks. 1 time utvidet tid ved eksamen, dysleksi, etc."
                value={specialConsiderations}
                onChange={(e) => setSpecialConsiderations(e.target.value)}
                className="w-full p-2 border border-stone-300 rounded-lg"
              />
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-stone-200">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg border border-stone-300 text-slate-700 hover:bg-stone-100"
            >
              Avbryt
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-slate-900 text-white font-medium hover:bg-slate-800 shadow-2xs"
            >
              Opprett elevkort
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
