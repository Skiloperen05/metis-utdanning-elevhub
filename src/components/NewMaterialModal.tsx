import React, { useState, useRef } from 'react';
import { X, BookOpen, Plus, Save, ExternalLink, Paperclip, Upload, Trash2, Eye, FileText, File } from 'lucide-react';
import { AppDatabase, Material, MaterialCategory, MaterialFile } from '../types';
import { FilePreviewModal } from './FilePreviewModal';

interface NewMaterialModalProps {
  db: AppDatabase;
  defaultSubjectId?: string;
  materialToEdit?: Material | null;
  onClose: () => void;
  onSaveMaterial: (material: Material) => void;
}

export const NewMaterialModal: React.FC<NewMaterialModalProps> = ({
  db,
  defaultSubjectId,
  materialToEdit,
  onClose,
  onSaveMaterial,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [subjectId, setSubjectId] = useState<string>(
    materialToEdit?.subjectId || defaultSubjectId || db.subjects[0]?.id || ''
  );
  const [title, setTitle] = useState(materialToEdit?.title || '');
  const [category, setCategory] = useState<MaterialCategory>(
    materialToEdit?.category || 'eksamen'
  );
  const [term, setTerm] = useState(materialToEdit?.term || 'Vår 2024');
  const [description, setDescription] = useState(materialToEdit?.description || '');
  const [attachedNotes, setAttachedNotes] = useState(materialToEdit?.attachedNotes || '');
  const [externalUrl, setExternalUrl] = useState(materialToEdit?.externalUrl || '');
  const [estimatedMinutes, setEstimatedMinutes] = useState<number>(
    materialToEdit?.estimatedMinutes || 120
  );
  const [importance, setImportance] = useState<'kjerne' | 'anbefalt' | 'fordypning'>(
    materialToEdit?.importance || 'kjerne'
  );
  const [files, setFiles] = useState<MaterialFile[]>(materialToEdit?.files || []);
  const [previewingFile, setPreviewingFile] = useState<MaterialFile | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = e.target.files;
    if (!uploadedFiles || uploadedFiles.length === 0) return;

    setIsUploading(true);
    const fileList: File[] = Array.from(uploadedFiles);

    const promises = fileList.map((file: File) => {
      return new Promise<MaterialFile>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          resolve({
            id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            name: file.name,
            size: file.size,
            type: file.type || 'application/octet-stream',
            dataUrl: reader.result as string,
            uploadedAt: new Date().toISOString().slice(0, 10),
          });
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    });

    Promise.all(promises)
      .then((newMaterialFiles) => {
        setFiles((prev) => [...prev, ...newMaterialFiles]);
        setIsUploading(false);
      })
      .catch((err) => {
        console.error('Error reading files:', err);
        setIsUploading(false);
      });
  };

  const handleRemoveFile = (fileId: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !subjectId) return;

    const newOrUpdated: Material = {
      id: materialToEdit?.id || `mat-${Date.now()}`,
      subjectId,
      title: title.trim(),
      category,
      term: term.trim() || undefined,
      description: description.trim(),
      attachedNotes: attachedNotes.trim() || undefined,
      externalUrl: externalUrl.trim() || undefined,
      estimatedMinutes: Number(estimatedMinutes) || undefined,
      importance,
      files,
      createdAt: materialToEdit?.createdAt || new Date().toISOString().slice(0, 10),
    };

    onSaveMaterial(newOrUpdated);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-xl w-full border border-stone-200 shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="bg-stone-50 border-b border-stone-200 p-4 sm:p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-700 text-white flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                {materialToEdit ? 'Rediger fagmateriell' : 'Legg til nytt fagmateriell'}
              </h3>
              <p className="text-xs text-slate-500">
                Eksamensgjennomganger, pensum, lekser og øvingsoppgaver
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-4 text-xs">
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Fag *</label>
              <select
                required
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                className="w-full p-2 border border-stone-300 rounded-lg bg-white"
              >
                {db.subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Kategori *</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as MaterialCategory)}
                className="w-full p-2 border border-stone-300 rounded-lg bg-white"
              >
                <option value="eksamen">Eksamensgjennomgang</option>
                <option value="pensum">Pensummodul</option>
                <option value="lekse">Lekser & Oppgavesett</option>
                <option value="teori">Teori / Formelark / CAS</option>
                <option value="prove">Prøve / Termintest</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Tittel på fagmateriell *</label>
            <input
              type="text"
              required
              placeholder="F.eks. Eksamen 1T Vår 2024 - Gjennomgang av del 1 og del 2"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full p-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-slate-800"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-700 font-semibold mb-1">Semester / Termin / Uke</label>
              <input
                type="text"
                placeholder="F.eks. Vår 2024 eller Uke 38"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                className="w-full p-2 border border-stone-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Estimert tidsbruk (min)</label>
              <input
                type="number"
                min={10}
                max={600}
                step={10}
                value={estimatedMinutes}
                onChange={(e) => setEstimatedMinutes(Number(e.target.value))}
                className="w-full p-2 border border-stone-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Prioritet i faget</label>
              <select
                value={importance}
                onChange={(e) => setImportance(e.target.value as any)}
                className="w-full p-2 border border-stone-300 rounded-lg bg-white"
              >
                <option value="kjerne">Kjernepensum (må gjøres)</option>
                <option value="anbefalt">Anbefalt øving</option>
                <option value="fordypning">Fordypning / Ekstra</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Beskrivelse / Læringsmål</label>
            <textarea
              rows={2}
              placeholder="Beskriv innholdet, hva oppgavesettet tester, eller hvilke oppgaver som skal prioriteres..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full p-2 border border-stone-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Lærerinstruks / Sensorveiledning</label>
            <textarea
              rows={2}
              placeholder="Viktige punkter læreren skal legge vekt på under gjennomgangen med elevene..."
              value={attachedNotes}
              onChange={(e) => setAttachedNotes(e.target.value)}
              className="w-full p-2 border border-stone-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-semibold mb-1">Nettlenke / Ressurs (Utdanningsdirektoratet e.l.)</label>
            <input
              type="url"
              placeholder="https://..."
              value={externalUrl}
              onChange={(e) => setExternalUrl(e.target.value)}
              className="w-full p-2 border border-stone-300 rounded-lg"
            />
          </div>

          {/* File Upload Section */}
          <div className="pt-1">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-slate-700 font-semibold flex items-center gap-1.5">
                <Paperclip className="w-3.5 h-3.5 text-slate-500" />
                Vedlagte filer (eksamensoppgaver, PDF, løsningsforslag)
              </label>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 hover:text-emerald-800 disabled:opacity-50"
              >
                <Upload className="w-3 h-3" />
                {isUploading ? 'Laster opp...' : 'Last opp fil'}
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.txt"
              onChange={handleFileUpload}
              className="hidden"
            />

            {files.length === 0 ? (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-stone-200 rounded-xl p-4 text-center cursor-pointer hover:border-emerald-500 hover:bg-emerald-50/20 transition-all text-slate-400 group"
              >
                <Upload className="w-5 h-5 mx-auto text-slate-400 group-hover:text-emerald-600 mb-1" />
                <p className="text-xs text-slate-600 font-medium group-hover:text-emerald-800">
                  Trykk for å legge til eksamenssett, oppgaver eller PDF
                </p>
                <p className="text-[10px] text-slate-400">
                  Støtter PDF, oppgavehefter, Word og bilder. Filen lagres trygt for visning i appen.
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {files.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between p-2 rounded-lg border border-stone-200 bg-stone-50 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <FileText className="w-4 h-4 text-emerald-700 shrink-0" />
                      <span className="font-medium text-slate-800 truncate" title={file.name}>
                        {file.name}
                      </span>
                      <span className="text-[10px] text-slate-400 shrink-0">
                        ({formatSize(file.size)})
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => setPreviewingFile(file)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-white border border-stone-200 text-slate-700 hover:bg-stone-100"
                        title="Forhåndsvis fil"
                      >
                        <Eye className="w-3 h-3" />
                        Vis
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(file.id)}
                        className="p-1 rounded text-slate-400 hover:text-rose-600"
                        title="Fjern fil"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
              className="px-4 py-1.5 rounded-lg bg-emerald-700 text-white font-medium hover:bg-emerald-800 shadow-2xs"
            >
              {materialToEdit ? 'Lagre endringer' : 'Opprett fagmateriell'}
            </button>
          </div>
        </form>

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
