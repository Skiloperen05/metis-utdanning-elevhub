import React, { useState, useMemo } from 'react';
import { 
  X, 
  Printer, 
  Download, 
  Calendar, 
  Clock, 
  User, 
  BookOpen, 
  CheckSquare, 
  Square, 
  Plus, 
  FileText, 
  Paperclip, 
  Eye, 
  Check, 
  CheckCircle2,
  Send,
  Sparkles,
  ArrowRight,
  GraduationCap,
  Maximize2,
  Minimize2,
  Copy,
  ExternalLink,
  Info,
  Search,
  ArrowUpDown
} from 'lucide-react';
import { AppDatabase, Student, Material, AssignmentStatus, Assignment, MaterialFile, PlannedSession, SessionStatus } from '../types';
import { getCategoryBadgeClass, getCategoryLabel } from '../lib/helpers';
import { FilePreviewModal } from './FilePreviewModal';
import { generateSessionPacketPDF } from '../lib/sessionPdfGenerator';

interface SessionPlannerModalProps {
  db: AppDatabase;
  defaultStudentId?: string;
  defaultSubjectId?: string;
  initialSession?: PlannedSession | null;
  onClose: () => void;
  onBulkUpdateAssignments?: (assignments: Assignment[]) => void;
  onSaveSession: (session: PlannedSession, autoAssignToStudent: boolean, markAsCompleted: boolean) => void;
}

export const SessionPlannerModal: React.FC<SessionPlannerModalProps> = ({
  db,
  defaultStudentId,
  defaultSubjectId,
  initialSession,
  onClose,
  onBulkUpdateAssignments,
  onSaveSession,
}) => {
  // State for session metadata
  const [selectedStudentId, setSelectedStudentId] = useState<string>(
    initialSession?.studentId || defaultStudentId || db.students[0]?.id || ''
  );

  const selectedStudent = useMemo(() => {
    return db.students.find((s) => s.id === selectedStudentId) || null;
  }, [db.students, selectedStudentId]);

  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(
    initialSession?.subjectId || defaultSubjectId || selectedStudent?.enrolledSubjectIds[0] || db.subjects[0]?.id || ''
  );

  const selectedSubject = useMemo(() => {
    return db.subjects.find((s) => s.id === selectedSubjectId) || null;
  }, [db.subjects, selectedSubjectId]);

  // Session details
  const [sessionDate, setSessionDate] = useState(
    initialSession?.date || new Date().toISOString().slice(0, 10)
  );
  const [sessionTime, setSessionTime] = useState(
    initialSession?.time || '14:00 - 15:30'
  );
  const [sessionTitle, setSessionTitle] = useState(
    initialSession?.title || 'Veiledningstime: Eksamenstrening og oppgaveløsning'
  );
  const [sessionGoals, setSessionGoals] = useState(
    initialSession?.goals || 'Gjennomgå utvalgte oppgaver, identifisere utfordringer og sikre måloppnåelse.'
  );
  const [teacherNotes, setTeacherNotes] = useState(
    initialSession?.teacherNotes || ''
  );
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>(
    initialSession?.status || 'planlagt'
  );
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);

  // Selected materials for this session
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>(
    initialSession ? initialSession.items.map((i) => i.materialId) : []
  );
  const [customItemNotes, setCustomItemNotes] = useState<{ [materialId: string]: string }>(
    initialSession
      ? Object.fromEntries(initialSession.items.map((i) => [i.materialId, i.customNote || '']))
      : {}
  );

  // Oppgaveark på egne A4-sider (hver oppgave på sin egen side i PDF)
  const [includeWorksheetsInPdf, setIncludeWorksheetsInPdf] = useState<boolean>(true);
  const [worksheetToggles, setWorksheetToggles] = useState<{ [materialId: string]: boolean }>({});

  // Sjekk om en spesifikk oppgave skal ha eget oppgaveark i PDF
  const isWorksheetEnabled = (materialId: string) => {
    if (!includeWorksheetsInPdf) return false;
    return worksheetToggles[materialId] !== false; // standard er true når oppgaven er valgt
  };

  const toggleWorksheetForMaterial = (materialId: string) => {
    setWorksheetToggles((prev) => ({
      ...prev,
      [materialId]: prev[materialId] !== undefined ? !prev[materialId] : false,
    }));
  };

  // View mode inside modal: 'select' (choose items) vs 'print-preview' (A4 print layout)
  const [activeTab, setActiveTab] = useState<'select' | 'preview'>('select');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [downloadNotice, setDownloadNotice] = useState<string | null>(null);

  // PDF Generation states
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [pdfResult, setPdfResult] = useState<{ blobUrl: string; filename: string } | null>(null);
  const [showPdfViewer, setShowPdfViewer] = useState(false);

  // Preview file modal
  const [previewingFile, setPreviewingFile] = useState<MaterialFile | null>(null);
  const [hasAppliedStatus, setHasAppliedStatus] = useState(false);

  // Filter & sorting states for material picker
  const [materialFilter, setMaterialFilter] = useState<'alle' | 'ikke_gjennomgatt' | 'gjennomgatt'>('alle');
  const [materialSort, setMaterialSort] = useState<'ikke_gjennomgatt_forst' | 'gjennomgatt_forst' | 'tittel' | 'kategori'>('ikke_gjennomgatt_forst');
  const [materialSearchQuery, setMaterialSearchQuery] = useState('');

  // Available materials for selected subject
  const availableMaterials = useMemo(() => {
    if (!selectedSubjectId) return [];
    return db.materials.filter((m) => m.subjectId === selectedSubjectId);
  }, [db.materials, selectedSubjectId]);

  // Map of student's progress and status for each material in this subject
  const studentMaterialStatusMap = useMemo(() => {
    const map = new Map<string, {
      status: AssignmentStatus;
      isGjennomgatt: boolean;
      completedDate?: string;
      studentScore?: string;
      teacherNote?: string;
      sessionCount: number;
      lastSessionDate?: string;
    }>();

    if (!selectedStudentId) return map;

    // 1. Direct assignments
    const studentAssignments = db.assignments.filter((a) => a.studentId === selectedStudentId);
    for (const a of studentAssignments) {
      const isGjennomgatt = a.status === 'gjennomgatt' || a.status === 'levert';
      map.set(a.materialId, {
        status: a.status,
        isGjennomgatt,
        completedDate: a.completedDate,
        studentScore: a.studentScore,
        teacherNote: a.teacherNote,
        sessionCount: 0,
      });
    }

    // 2. Student notes with coveredMaterialIds
    const currentStudent = db.students.find((s) => s.id === selectedStudentId);
    if (currentStudent && currentStudent.notes) {
      for (const note of currentStudent.notes) {
        for (const matId of note.coveredMaterialIds || []) {
          const existing = map.get(matId);
          if (existing) {
            existing.isGjennomgatt = true;
            existing.sessionCount = (existing.sessionCount || 0) + 1;
            existing.completedDate = existing.completedDate || note.date;
            if (note.date && (!existing.lastSessionDate || note.date > existing.lastSessionDate)) {
              existing.lastSessionDate = note.date;
            }
          } else {
            map.set(matId, {
              status: 'gjennomgatt',
              isGjennomgatt: true,
              completedDate: note.date,
              sessionCount: 1,
              lastSessionDate: note.date,
            });
          }
        }
      }
    }

    // 3. Previous completed or planned sessions in db.sessions
    if (db.sessions && db.sessions.length > 0) {
      const studentSessions = db.sessions.filter((s) => s.studentId === selectedStudentId);
      for (const session of studentSessions) {
        if (session.id === initialSession?.id) continue;
        const isSessionCompleted = session.status === 'gjennomfort';
        for (const item of session.items || []) {
          const itemCompleted = isSessionCompleted || item.completed === true;
          const existing = map.get(item.materialId);
          if (existing) {
            existing.sessionCount = (existing.sessionCount || 0) + 1;
            if (itemCompleted && !existing.isGjennomgatt) {
              existing.isGjennomgatt = true;
              existing.status = 'gjennomgatt';
              existing.completedDate = existing.completedDate || session.date;
            }
            if (session.date && (!existing.lastSessionDate || session.date > existing.lastSessionDate)) {
              existing.lastSessionDate = session.date;
            }
          } else {
            map.set(item.materialId, {
              status: itemCompleted ? 'gjennomgatt' : 'tildelt',
              isGjennomgatt: itemCompleted,
              completedDate: itemCompleted ? session.date : undefined,
              sessionCount: 1,
              lastSessionDate: session.date,
            });
          }
        }
      }
    }

    return map;
  }, [db.assignments, db.sessions, db.students, selectedStudentId, initialSession?.id]);

  // Statistics for materials in selected subject for this student
  const materialStats = useMemo(() => {
    let completedCount = 0;
    for (const mat of availableMaterials) {
      const statusInfo = studentMaterialStatusMap.get(mat.id);
      if (statusInfo?.isGjennomgatt) {
        completedCount++;
      }
    }
    const uncompletedCount = availableMaterials.length - completedCount;
    return {
      total: availableMaterials.length,
      completed: completedCount,
      uncompleted: uncompletedCount,
    };
  }, [availableMaterials, studentMaterialStatusMap]);

  // Filtered and sorted materials for the material picker
  const processedMaterials = useMemo(() => {
    let list = [...availableMaterials];

    // Search query filter
    if (materialSearchQuery.trim()) {
      const q = materialSearchQuery.toLowerCase().trim();
      list = list.filter((m) =>
        m.title.toLowerCase().includes(q) ||
        (m.description && m.description.toLowerCase().includes(q)) ||
        (m.term && m.term.toLowerCase().includes(q)) ||
        getCategoryLabel(m.category).toLowerCase().includes(q)
      );
    }

    // Status tab filter
    if (materialFilter === 'ikke_gjennomgatt') {
      list = list.filter((m) => {
        const info = studentMaterialStatusMap.get(m.id);
        return !info?.isGjennomgatt;
      });
    } else if (materialFilter === 'gjennomgatt') {
      list = list.filter((m) => {
        const info = studentMaterialStatusMap.get(m.id);
        return !!info?.isGjennomgatt;
      });
    }

    // Sorting
    list.sort((a, b) => {
      const aInfo = studentMaterialStatusMap.get(a.id);
      const bInfo = studentMaterialStatusMap.get(b.id);
      const aGjennomgatt = !!aInfo?.isGjennomgatt;
      const bGjennomgatt = !!bInfo?.isGjennomgatt;

      if (materialSort === 'ikke_gjennomgatt_forst') {
        if (aGjennomgatt !== bGjennomgatt) {
          return aGjennomgatt ? 1 : -1; // uncompleted first
        }
        return a.title.localeCompare(b.title, 'nb');
      }

      if (materialSort === 'gjennomgatt_forst') {
        if (aGjennomgatt !== bGjennomgatt) {
          return aGjennomgatt ? -1 : 1; // completed first
        }
        return a.title.localeCompare(b.title, 'nb');
      }

      if (materialSort === 'kategori') {
        if (a.category !== b.category) {
          return a.category.localeCompare(b.category);
        }
        return a.title.localeCompare(b.title, 'nb');
      }

      // 'tittel'
      return a.title.localeCompare(b.title, 'nb');
    });

    return list;
  }, [availableMaterials, materialSearchQuery, materialFilter, materialSort, studentMaterialStatusMap]);

  // Helper to select all uncompleted materials
  const handleSelectAllUncompleted = () => {
    const uncompletedIds = availableMaterials
      .filter((m) => !studentMaterialStatusMap.get(m.id)?.isGjennomgatt)
      .map((m) => m.id);
    setSelectedMaterialIds(uncompletedIds);
  };

  // Toggle material selection
  const toggleMaterial = (id: string) => {
    setSelectedMaterialIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Chosen material objects
  const chosenMaterials = useMemo(() => {
    return selectedMaterialIds
      .map((id) => db.materials.find((m) => m.id === id))
      .filter((m): m is Material => m !== undefined);
  }, [selectedMaterialIds, db.materials]);

  // Oppgaver som skal ha eget oppgaveark
  const worksheetsToInclude = useMemo(() => {
    if (!includeWorksheetsInPdf) return [];
    return selectedMaterialIds.filter((id) => worksheetToggles[id] !== false);
  }, [includeWorksheetsInPdf, selectedMaterialIds, worksheetToggles]);

  // Handle printing
  const handlePrint = () => {
    try {
      window.print();
    } catch (e) {
      console.warn('window.print in iframe:', e);
    }
    setDownloadNotice(
      'Utskriftsdialogen ble forsøkt åpnet! Dersom nettleseren din blokkerer dialogen i forhåndsvisningsvinduet (iframe), kan du enten klikke «Åpne i ny fane» eller «Kopier tekst (Word/Docs)» for å skrive ut uten begrensninger.'
    );
  };

  // Open standalone app in a new tab without iframe sandbox
  const handleOpenInNewTab = () => {
    window.open(window.location.href, '_blank');
  };

  // Copy structured text to clipboard for Word / Docs / OneNote
  const handleCopyPacketText = async () => {
    if (!selectedStudent || !selectedSubject) return;

    const lines: string[] = [
      `METIS UTDANNING • VEILEDNINGSTIME`,
      `==================================================`,
      `Tittel: ${sessionTitle}`,
      `Dato & Tid: ${sessionDate} kl. ${sessionTime}`,
      ``,
      `ELEV- OG FAGINFORMASJON`,
      `--------------------------------------------------`,
      `Elev: ${selectedStudent.name} (${selectedStudent.classGroup})`,
      `Fag: ${selectedSubject.name} (${selectedSubject.code})`,
      `Målkarakter: Karakter ${selectedStudent.targetGrade}`,
      sessionGoals ? `Mål for timen: ${sessionGoals}` : '',
      teacherNotes ? `Lærernotat: ${teacherNotes}` : '',
      ``,
      `GJENNOMGANGSPLAN (${chosenMaterials.length} OPPGAVER/DELER)`,
      `--------------------------------------------------`,
      ...chosenMaterials.map((mat, idx) => {
        return [
          `${idx + 1}. [${getCategoryLabel(mat.category).toUpperCase()}] ${mat.title}${mat.term ? ` (${mat.term})` : ''}`,
          `   Beskrivelse: ${mat.description || 'Ingen'}`.trim(),
          mat.attachedNotes ? `   Sensorveiledning/fokus: ${mat.attachedNotes}` : '',
          customItemNotes[mat.id] ? `   Oppgaveinstruks: ${customItemNotes[mat.id]}` : '',
          `   Status: [ ] Gjennomgått i time   [ ] Mestring god   [ ] Lekse til neste gang`,
          `   Notater fra timen: __________________________________________________`,
          ``
        ].filter(Boolean).join('\n');
      }),
      `OPPSUMMERING & AVTALER FOR NESTE VEILEDNINGSTIME`,
      `--------------------------------------------------`,
      `Felles notater/avtaler: `,
      `Lekse / repetisjon: `
    ].filter(Boolean);

    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 3500);
    } catch (err) {
      console.error('Kopiering feilet:', err);
    }
  };

  // Handle download of printable HTML session packet
  const handleDownloadPacket = () => {
    if (!selectedStudent || !selectedSubject) return;

    const worksheetMaterials = includeWorksheetsInPdf
      ? chosenMaterials.filter((m) => isWorksheetEnabled(m.id))
      : [];

    const htmlContent = `
<!DOCTYPE html>
<html lang="no">
<head>
  <meta charset="UTF-8">
  <title>Timepakke - ${selectedStudent.name} - ${selectedSubject.name}</title>
  <style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 40px; color: #1e293b; line-height: 1.5; background: #ffffff; }
    .header { border-bottom: 2px solid #047857; padding-bottom: 15px; margin-bottom: 25px; display: flex; justify-content: space-between; align-items: flex-end; }
    .title { font-size: 24px; font-weight: bold; color: #0f172a; margin: 0; }
    .subtitle { font-size: 14px; color: #047857; font-weight: bold; }
    .info-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-bottom: 25px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .info-item { font-size: 13px; }
    .info-item strong { color: #334155; }
    .section-title { font-size: 16px; font-weight: bold; color: #0f172a; margin-top: 25px; margin-bottom: 12px; border-bottom: 1px solid #cbd5e1; padding-bottom: 5px; }
    .task-card { border: 1px solid #cbd5e1; border-radius: 8px; padding: 15px; margin-bottom: 15px; page-break-inside: avoid; }
    .task-header { display: flex; justify-content: space-between; margin-bottom: 8px; font-weight: bold; }
    .task-desc { font-size: 13px; color: #475569; margin-bottom: 10px; }
    .notes-box { background: #fefce8; border: 1px dashed #ca8a04; border-radius: 6px; padding: 10px; font-size: 12px; color: #854d0e; }
    .checkbox-row { margin-top: 12px; padding-top: 10px; border-top: 1px dashed #e2e8f0; display: flex; gap: 20px; font-size: 12px; }
    .notes-lines { border-bottom: 1px dotted #94a3b8; height: 28px; margin-top: 10px; }
    .page-break { page-break-before: always; margin-top: 50px; }
    .worksheet-box { border: 1px solid #94a3b8; border-radius: 8px; padding: 25px; min-height: 800px; }
    .worksheet-grid { border: 1px dashed #cbd5e1; border-radius: 6px; height: 420px; margin-top: 15px; background: repeating-linear-gradient(0deg, transparent, transparent 27px, #e2e8f0 28px); }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
      .page-break { page-break-before: always; }
    }
  </style>
</head>
<body>
  <!-- SIDE 1: TIMEPLAN OG OVERSIKT -->
  <div class="header">
    <div>
      <div class="subtitle">METIS UTDANNING • VEILEDNINGSTIME</div>
      <h1 class="title">${sessionTitle}</h1>
    </div>
    <div style="text-align: right; font-size: 12px; color: #64748b;">
      Utskrevet: ${new Date().toLocaleDateString('no-NO')}
    </div>
  </div>

  <div class="info-box">
    <div class="info-item"><strong>Elev:</strong> ${selectedStudent.name} (${selectedStudent.classGroup})</div>
    <div class="info-item"><strong>Fag:</strong> ${selectedSubject.name} (${selectedSubject.code})</div>
    <div class="info-item"><strong>Målkarakter:</strong> Karakter ${selectedStudent.targetGrade}</div>
    <div class="info-item"><strong>Dato & Tid:</strong> ${sessionDate} kl. ${sessionTime}</div>
    ${sessionGoals ? `<div class="info-item" style="grid-column: span 2;"><strong>Mål for timen:</strong> ${sessionGoals}</div>` : ''}
    ${teacherNotes ? `<div class="info-item" style="grid-column: span 2;"><strong>Lærerkommentar:</strong> ${teacherNotes}</div>` : ''}
  </div>

  <div class="section-title">Gjennomgangsplan & Sjekkliste (${chosenMaterials.length} deler)</div>

  ${chosenMaterials.map((mat, idx) => `
    <div class="task-card">
      <div class="task-header">
        <span>${idx + 1}. [${getCategoryLabel(mat.category).toUpperCase()}] ${mat.title}</span>
        ${mat.term ? `<span style="font-size: 12px; color: #64748b;">${mat.term}</span>` : ''}
      </div>
      <div class="task-desc">${mat.description || 'Ingen beskrivelse oppgitt.'}</div>
      ${mat.attachedNotes ? `<div class="notes-box"><strong>Fokus / Sensorveiledning:</strong> ${mat.attachedNotes}</div>` : ''}
      ${customItemNotes[mat.id] ? `<div style="margin-top: 8px; font-size: 12px; color: #1e293b;"><strong>Notat for denne oppgaven:</strong> ${customItemNotes[mat.id]}</div>` : ''}
      
      <div style="margin-top: 12px;">
        <div style="font-size: 11px; font-weight: bold; color: #64748b;">Elevens notater / vurdering i timen:</div>
        <div class="notes-lines"></div>
        <div class="notes-lines"></div>
      </div>

      <div class="checkbox-row">
        <span>[ ] Gjennomgått i time</span>
        <span>[ ] Mestring god</span>
        <span>[ ] Trenger mer øving</span>
        <span>[ ] Lekse til neste gang</span>
      </div>
    </div>
  `).join('')}

  <div class="section-title" style="margin-top: 30px;">Oppsummering & Neste skritt</div>
  <div style="height: 80px; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px; font-size: 12px; color: #94a3b8;">
    Skriv ned felles avtaler, lekser til neste veiledningstime eller viktige formler eleven skal repetere...
  </div>

  <!-- DEDIKERTE OPPGAVEARK PÅ EGNE SIDER -->
  ${worksheetMaterials.map((mat, idx) => `
    <div class="page-break"></div>
    <div class="header">
      <div>
        <div class="subtitle">METIS UTDANNING • OPPGAVEARK (${idx + 1} av ${worksheetMaterials.length})</div>
        <h2 style="font-size: 20px; font-weight: bold; color: #0f172a; margin: 4px 0 0 0;">${mat.title}</h2>
      </div>
      <div style="text-align: right; font-size: 12px; color: #64748b;">
        <div><strong>${selectedStudent.name}</strong> • ${selectedSubject.code}</div>
        <div>Dato: ${sessionDate}</div>
      </div>
    </div>

    <div class="worksheet-box">
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; margin-bottom: 15px;">
        <div style="font-size: 11px; font-weight: bold; color: #047857; text-transform: uppercase; margin-bottom: 4px;">
          Oppgavetekst & Problemstilling:
        </div>
        <div style="font-size: 14px; color: #1e293b; line-height: 1.6;">
          ${mat.description || 'Ingen oppgavetekst oppgitt.'}
        </div>
      </div>

      ${mat.attachedNotes ? `
        <div style="background: #fefce8; border: 1px dashed #ca8a04; border-radius: 6px; padding: 10px; font-size: 12px; color: #854d0e; margin-bottom: 12px;">
          <strong>Sensorveiledning & Fokusområde:</strong> ${mat.attachedNotes}
        </div>
      ` : ''}

      ${customItemNotes[mat.id] ? `
        <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 6px; padding: 10px; font-size: 12px; color: #065f46; margin-bottom: 12px;">
          <strong>Veilederens instruks til deg:</strong> ${customItemNotes[mat.id]}
        </div>
      ` : ''}

      <div style="font-size: 11px; font-weight: bold; color: #334155; margin-top: 15px;">
        ARBEIDSOMRÅDE & UTREGNING (kladd, formler, svar):
      </div>
      <div class="worksheet-grid"></div>

      <div style="margin-top: 20px; padding-top: 12px; border-top: 1px solid #cbd5e1; display: flex; justify-content: space-between; font-size: 12px;">
        <div>
          <strong>Egenvurdering:</strong> [ ] Selvstendig  [ ] Med veiledning  [ ] Må repeteres  [ ] Godkjent ✓
        </div>
        <div>
          <strong>Poeng / Vurdering:</strong> ____________
        </div>
      </div>
    </div>
  `).join('')}

</body>
</html>
    `;

    try {
      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Timeplan_${selectedStudent.name.replace(/\s+/g, '_')}_${sessionDate}.html`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        a.remove();
        URL.revokeObjectURL(url);
      }, 1000);
    } catch (err) {
      console.warn('Nedlasting trigget:', err);
    }

    setDownloadNotice(
      'Nedlastingsforespørsel ble sendt! Hvis nettleseren din blokkerer filen inne i denne forhåndsvisningen (iframe), klikk «Kopier tekst (Word/Docs)» for å lime inn i Word, eller åpne appen i en ny fane (↗) for direkte lagring.'
    );
  };

  // Generate and Download formatted PDF document
  const handleDownloadPdf = () => {
    if (!selectedStudent || !selectedSubject || chosenMaterials.length === 0) return;
    setIsGeneratingPdf(true);
    try {
      const pdf = generateSessionPacketPDF({
        sessionTitle,
        sessionDate,
        sessionTime,
        sessionGoals,
        teacherNotes,
        student: selectedStudent,
        subject: selectedSubject,
        materials: chosenMaterials,
        customItemNotes,
        includeTaskWorksheets: includeWorksheetsInPdf,
        worksheetsToInclude,
      });

      pdf.save();

      const blobUrl = pdf.getBlobUrl();
      setPdfResult({ blobUrl, filename: pdf.filename });
      setDownloadNotice(null);
    } catch (err) {
      console.error('Feil under generering av PDF:', err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Generate and open PDF in preview modal
  const handlePreviewPdf = () => {
    if (!selectedStudent || !selectedSubject || chosenMaterials.length === 0) return;
    setIsGeneratingPdf(true);
    try {
      const pdf = generateSessionPacketPDF({
        sessionTitle,
        sessionDate,
        sessionTime,
        sessionGoals,
        teacherNotes,
        student: selectedStudent,
        subject: selectedSubject,
        materials: chosenMaterials,
        customItemNotes,
        includeTaskWorksheets: includeWorksheetsInPdf,
        worksheetsToInclude,
      });

      const blobUrl = pdf.getBlobUrl();
      setPdfResult({ blobUrl, filename: pdf.filename });
      setShowPdfViewer(true);
    } catch (err) {
      console.error('Feil under forhåndsvisning av PDF:', err);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Save session into database and update student assignments
  const handleSaveSessionInternal = (markAsCompleted = false) => {
    if (!selectedStudent || !selectedSubject) return;

    const targetStatus: SessionStatus = markAsCompleted ? 'gjennomfort' : sessionStatus;

    const sessionObj: PlannedSession = {
      id: initialSession?.id || `sess-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      studentId: selectedStudent.id,
      subjectId: selectedSubject.id,
      title: sessionTitle.trim() || `Veiledningstime: ${selectedSubject.name}`,
      date: sessionDate,
      time: sessionTime,
      goals: sessionGoals,
      teacherNotes,
      summaryAfterSession: initialSession?.summaryAfterSession || '',
      status: targetStatus,
      items: selectedMaterialIds.map((matId) => ({
        materialId: matId,
        customNote: customItemNotes[matId] || '',
        completed: markAsCompleted || initialSession?.items?.find((i) => i.materialId === matId)?.completed || false,
      })),
      includeWorksheets: includeWorksheetsInPdf,
      createdAt: initialSession?.createdAt || new Date().toISOString(),
      completedAt: targetStatus === 'gjennomfort' ? (initialSession?.completedAt || new Date().toISOString()) : undefined,
    };

    onSaveSession(sessionObj, true, markAsCompleted);
    setSaveSuccessMessage(
      markAsCompleted
        ? `Timen er lagret og markert som gjennomført! Oppgaver på ${selectedStudent.name} er oppdatert automatisk.`
        : `Timen er lagret for ${selectedStudent.name}! Du finner den under Veiledningstimer og inne på elevkortet.`
    );
    setTimeout(() => {
      onClose();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-0 sm:p-3 z-50 overflow-y-auto">
      <div className={`bg-white border border-stone-200 shadow-2xl overflow-hidden flex flex-col transition-all duration-150 ${
        isFullscreen
          ? 'w-full h-full max-w-none max-h-screen rounded-none my-0'
          : 'max-w-4xl w-full rounded-2xl max-h-[94vh] my-auto'
      }`}>
        
        {/* Header */}
        <div className="bg-stone-50 border-b border-stone-200 p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-emerald-700 text-white flex items-center justify-center shadow-2xs">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                {initialSession ? 'Rediger veiledningstime' : 'Planlegg veiledningstime & Utskrift'}
              </h2>
              <p className="text-xs text-slate-500">
                Timen lagres automatisk i systemet og på eleven, og du kan laste ned PDF-hefte
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <div className="bg-stone-200/80 p-0.5 rounded-lg flex items-center text-xs">
              <button
                onClick={() => setActiveTab('select')}
                className={`px-3 py-1 rounded-md font-medium transition-all ${
                  activeTab === 'select'
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                1. Oppsett & Innhold ({selectedMaterialIds.length})
              </button>
              <button
                onClick={() => setActiveTab('preview')}
                disabled={selectedMaterialIds.length === 0}
                className={`px-3 py-1 rounded-md font-medium transition-all disabled:opacity-40 ${
                  activeTab === 'preview'
                    ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                2. Utskriftshefte ({selectedMaterialIds.length})
              </button>
            </div>

            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-stone-200 transition-colors ml-1 hidden sm:inline-flex"
              title={isFullscreen ? 'Lukk fullskjerm' : 'Åpne i fullskjerm'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-stone-200 transition-colors"
              title="Lukk modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {saveSuccessMessage && (
          <div className="bg-emerald-600 text-white px-4 py-2 text-xs font-semibold flex items-center gap-2 shadow-xs shrink-0">
            <CheckCircle2 className="w-4 h-4" />
            <span>{saveSuccessMessage}</span>
          </div>
        )}

        {/* TAB 1: SELECT CONTENT & CONFIGURE SESSION */}
        {activeTab === 'select' && (
          <div className="p-4 sm:p-6 overflow-y-auto space-y-5 text-xs flex-1">
            
            {/* Session Metadata Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 bg-stone-50 p-4 rounded-xl border border-stone-200">
              
              {/* Student */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-emerald-700" />
                  Elev
                </label>
                <select
                  value={selectedStudentId}
                  onChange={(e) => {
                    const sid = e.target.value;
                    setSelectedStudentId(sid);
                    const s = db.students.find((stud) => stud.id === sid);
                    if (s && s.enrolledSubjectIds.length > 0) {
                      setSelectedSubjectId(s.enrolledSubjectIds[0]);
                    }
                  }}
                  className="w-full p-2 rounded-lg border border-stone-300 bg-white font-medium cursor-pointer"
                >
                  {db.students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.classGroup} • Mål: {s.targetGrade})
                    </option>
                  ))}
                </select>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1 flex items-center gap-1">
                  <BookOpen className="w-3.5 h-3.5 text-emerald-700" />
                  Fag
                </label>
                <select
                  value={selectedSubjectId}
                  onChange={(e) => {
                    setSelectedSubjectId(e.target.value);
                    setSelectedMaterialIds([]);
                  }}
                  className="w-full p-2 rounded-lg border border-stone-300 bg-white font-medium cursor-pointer"
                >
                  {db.subjects.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name} ({sub.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Date */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-emerald-700" />
                  Dato
                </label>
                <input
                  type="date"
                  value={sessionDate}
                  onChange={(e) => setSessionDate(e.target.value)}
                  className="w-full p-2 rounded-lg border border-stone-300 bg-white"
                />
              </div>

              {/* Time */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-emerald-700" />
                  Klokkeslett
                </label>
                <input
                  type="text"
                  placeholder="f.eks. 14:00 - 15:30"
                  value={sessionTime}
                  onChange={(e) => setSessionTime(e.target.value)}
                  className="w-full p-2 rounded-lg border border-stone-300 bg-white"
                />
              </div>

              {/* Status */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1 flex items-center gap-1">
                  <CheckSquare className="w-3.5 h-3.5 text-emerald-700" />
                  Status
                </label>
                <select
                  value={sessionStatus}
                  onChange={(e) => setSessionStatus(e.target.value as SessionStatus)}
                  className="w-full p-2 rounded-lg border border-stone-300 bg-white font-semibold text-slate-800 cursor-pointer"
                >
                  <option value="planlagt">📅 Planlagt time</option>
                  <option value="gjennomfort">✓ Gjennomført</option>
                  <option value="avlyst">Avlyst</option>
                </select>
              </div>

              {/* Title */}
              <div className="sm:col-span-2 lg:col-span-2">
                <label className="block text-slate-700 font-semibold mb-1">Tittel for timen</label>
                <input
                  type="text"
                  value={sessionTitle}
                  onChange={(e) => setSessionTitle(e.target.value)}
                  className="w-full p-2 rounded-lg border border-stone-300 bg-white"
                />
              </div>

              {/* Goals */}
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="block text-slate-700 font-semibold mb-1">Mål for veiledningen</label>
                <input
                  type="text"
                  value={sessionGoals}
                  onChange={(e) => setSessionGoals(e.target.value)}
                  className="w-full p-2 rounded-lg border border-stone-300 bg-white"
                />
              </div>
            </div>

            {/* Oppgaveark / Egen side per oppgave Master-valg */}
            <div className="bg-emerald-50/90 border border-emerald-200 rounded-xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-emerald-700 text-white flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
                  <FileText className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-emerald-950 flex items-center gap-2 flex-wrap">
                    <span>Skriv ut oppgaveark på egne A4-sider</span>
                    <span className="text-[10px] bg-emerald-200 text-emerald-900 font-semibold px-2 py-0.5 rounded-full">
                      {worksheetsToInclude.length} av {selectedMaterialIds.length} ark valgt
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-800 leading-relaxed mt-0.5">
                    Legger ved oppgavetekst, sensorveiledning og elevens regne-/arbeidsfelt på egne sider i PDF-heftet. Du kan også velge bort enkeltark per oppgave under.
                  </p>
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-1.5 rounded-lg border border-emerald-300 hover:bg-emerald-50 transition-colors shrink-0 shadow-2xs">
                <input
                  type="checkbox"
                  checked={includeWorksheetsInPdf}
                  onChange={(e) => setIncludeWorksheetsInPdf(e.target.checked)}
                  className="w-4 h-4 accent-emerald-700 rounded cursor-pointer"
                />
                <span className="text-xs font-semibold text-emerald-900">
                  {includeWorksheetsInPdf ? 'Oppgaveark på' : 'Kun sjekkliste'}
                </span>
              </label>
            </div>

            {/* Material Picker */}
            <div className="space-y-2.5">
              {/* Material Picker Header & Controls */}
              <div className="bg-stone-50 border border-stone-200 rounded-xl p-3.5 space-y-3">
                
                {/* Top Row: Title, Student indicator, and Quick Action buttons */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div>
                    <div className="font-bold text-slate-900 text-xs sm:text-sm flex items-center gap-2 flex-wrap">
                      <span>Velg fagmateriell til timen</span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                        {selectedMaterialIds.length} valgt
                      </span>
                      {selectedStudent && (
                        <span className="text-[11px] font-medium text-slate-600 bg-white border border-stone-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <User className="w-3 h-3 text-emerald-700" />
                          {selectedStudent.name}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Gjennomgått materiell er markert med grønt. Du kan enkelt sortere og filtrere på hva som gjenstår.
                    </p>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                    <button
                      type="button"
                      onClick={handleSelectAllUncompleted}
                      disabled={materialStats.uncompleted === 0}
                      className="px-2.5 py-1.5 text-[11px] font-semibold bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 disabled:opacity-40 transition-colors shadow-2xs flex items-center gap-1 cursor-pointer"
                      title="Velg alle oppgaver som eleven ikke har gjennomgått ennå"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Velg ubehandlede ({materialStats.uncompleted})
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (selectedMaterialIds.length === availableMaterials.length) {
                          setSelectedMaterialIds([]);
                        } else {
                          setSelectedMaterialIds(availableMaterials.map((m) => m.id));
                        }
                      }}
                      className="px-2.5 py-1.5 text-[11px] font-medium text-slate-700 bg-white border border-stone-300 rounded-lg hover:bg-stone-100 transition-colors cursor-pointer"
                    >
                      {selectedMaterialIds.length === availableMaterials.length ? 'Fjern alle' : 'Velg alle i faget'}
                    </button>
                  </div>
                </div>

                {/* Second Row: Filters, Search, and Sorting */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 pt-2.5 border-t border-stone-200">
                  
                  {/* Status Filter Tabs */}
                  <div className="flex items-center gap-1 bg-stone-200/80 p-0.5 rounded-lg text-xs overflow-x-auto shrink-0">
                    <button
                      type="button"
                      onClick={() => setMaterialFilter('alle')}
                      className={`px-2.5 py-1 rounded-md font-semibold transition-all whitespace-nowrap cursor-pointer ${
                        materialFilter === 'alle'
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Alle ({materialStats.total})
                    </button>
                    <button
                      type="button"
                      onClick={() => setMaterialFilter('ikke_gjennomgatt')}
                      className={`px-2.5 py-1 rounded-md font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                        materialFilter === 'ikke_gjennomgatt'
                          ? 'bg-white text-emerald-950 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>
                      <span>Ikke gjennomgått ({materialStats.uncompleted})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMaterialFilter('gjennomgatt')}
                      className={`px-2.5 py-1 rounded-md font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                        materialFilter === 'gjennomgatt'
                          ? 'bg-white text-emerald-950 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                      <span>Gjennomgått ({materialStats.completed})</span>
                    </button>
                  </div>

                  {/* Search and Sort controls */}
                  <div className="flex items-center gap-2 flex-1 md:justify-end flex-wrap">
                    {/* Search Field */}
                    <div className="relative flex-1 min-w-[150px] sm:max-w-xs">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="Søk i oppgaver/tema..."
                        value={materialSearchQuery}
                        onChange={(e) => setMaterialSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-6 py-1 text-xs bg-white border border-stone-300 rounded-lg focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                      />
                      {materialSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setMaterialSearchQuery('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-xs cursor-pointer"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {/* Sort Dropdown */}
                    <div className="flex items-center gap-1 shrink-0">
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
                      <select
                        value={materialSort}
                        onChange={(e) => setMaterialSort(e.target.value as any)}
                        className="py-1 px-2 text-xs font-semibold bg-white border border-stone-300 rounded-lg text-slate-700 cursor-pointer focus:outline-none focus:border-emerald-600"
                      >
                        <option value="ikke_gjennomgatt_forst">⭐ Ikke gjennomgått først</option>
                        <option value="gjennomgatt_forst">✓ Gjennomgått først</option>
                        <option value="tittel">Alfabetisk (A–Å)</option>
                        <option value="kategori">Etter kategori</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Material List */}
              {availableMaterials.length === 0 ? (
                <div className="p-8 text-center text-slate-400 bg-stone-50 rounded-xl border border-dashed border-stone-200">
                  Ingen fagmateriell registrert i dette faget ennå.
                </div>
              ) : processedMaterials.length === 0 ? (
                <div className="p-6 text-center text-slate-500 bg-stone-50 rounded-xl border border-dashed border-stone-200 text-xs">
                  {materialFilter === 'gjennomgatt' ? (
                    <div>
                      <p className="font-semibold text-slate-700">Ingen oppgaver er gjennomgått med {selectedStudent?.name || 'eleven'} ennå.</p>
                      <p className="text-slate-500 mt-1">Bytt til fanen «Ikke gjennomgått» eller «Alle» for å velge materiell til timen.</p>
                    </div>
                  ) : materialFilter === 'ikke_gjennomgatt' ? (
                    <div>
                      <p className="font-semibold text-emerald-800">Alt fagmateriell i dette faget er allerede gjennomgått med {selectedStudent?.name || 'eleven'}!</p>
                      <p className="text-slate-500 mt-1">Du kan velge gjennomgåtte oppgaver på nytt under «Alle» for repetisjon.</p>
                    </div>
                  ) : (
                    <div>
                      <p className="font-semibold text-slate-700">Ingen oppgaver matchet søket «{materialSearchQuery}».</p>
                      <button
                        type="button"
                        onClick={() => setMaterialSearchQuery('')}
                        className="mt-2 text-emerald-700 font-semibold hover:underline cursor-pointer"
                      >
                        Nullstill søk
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {processedMaterials.map((mat) => {
                    const isSelected = selectedMaterialIds.includes(mat.id);
                    const hasFiles = mat.files && mat.files.length > 0;
                    const statusInfo = studentMaterialStatusMap.get(mat.id);
                    const isGjennomgatt = !!statusInfo?.isGjennomgatt;

                    return (
                      <div
                        key={mat.id}
                        onClick={() => toggleMaterial(mat.id)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col gap-2 relative ${
                          isSelected
                            ? 'bg-emerald-50/90 border-emerald-500 ring-2 ring-emerald-500/20 shadow-xs'
                            : isGjennomgatt
                            ? 'bg-emerald-50/25 border-emerald-200/80 hover:border-emerald-400'
                            : 'bg-white border-stone-200 hover:border-emerald-300 shadow-2xs'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2.5 min-w-0">
                            <div className="mt-0.5 text-emerald-700 shrink-0">
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 fill-emerald-100" />
                              ) : (
                                <Square className="w-4 h-4 text-slate-300" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {/* Category Badge */}
                                <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded ${getCategoryBadgeClass(mat.category)}`}>
                                  {getCategoryLabel(mat.category)}
                                </span>

                                {/* Term Badge */}
                                {mat.term && (
                                  <span className="text-[10px] text-slate-500 font-medium bg-stone-100 px-1.5 py-0.2 rounded">
                                    {mat.term}
                                  </span>
                                )}

                                {/* Progress Status Badge for Selected Student */}
                                {isGjennomgatt ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-2xs">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-700 shrink-0" />
                                    <span>Gjennomgått med {selectedStudent ? selectedStudent.name.split(' ')[0] : 'eleven'}</span>
                                    {statusInfo.completedDate && (
                                      <span className="text-emerald-800 font-normal opacity-90">({statusInfo.completedDate})</span>
                                    )}
                                  </span>
                                ) : statusInfo?.status === 'under_arbeid' ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                                    <Clock className="w-3 h-3 text-amber-600 shrink-0" />
                                    Under arbeid hos eleven
                                  </span>
                                ) : statusInfo?.status === 'tildelt' ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                                    Tildelt som lekse/oppgave
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-stone-100 text-slate-600 border border-stone-200">
                                    Ikke gjennomgått
                                  </span>
                                )}

                                {/* Previous session counter if used before */}
                                {statusInfo && statusInfo.sessionCount > 0 && (
                                  <span className="text-[10px] text-slate-500 bg-stone-100 px-1.5 py-0.2 rounded font-medium" title="Antall tidligere veiledningstimer dette materiellet har vært brukt i">
                                    I {statusInfo.sessionCount} time{statusInfo.sessionCount > 1 ? 'r' : ''}
                                  </span>
                                )}

                                {hasFiles && (
                                  <span className="text-[10px] text-emerald-700 bg-emerald-100/70 px-1.5 py-0.2 rounded font-medium flex items-center gap-0.5">
                                    <Paperclip className="w-2.5 h-2.5" />
                                    {mat.files!.length} fil(er) vedlagt
                                  </span>
                                )}
                              </div>

                              <h4 className="font-semibold text-slate-900 text-xs mt-1 flex items-center gap-2">
                                <span>{mat.title}</span>
                                {isGjennomgatt && !isSelected && (
                                  <span className="text-[10px] font-normal text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                                    Repetisjon
                                  </span>
                                )}
                              </h4>
                              <p className="text-slate-500 text-[11px] line-clamp-1">{mat.description}</p>
                            </div>
                          </div>

                          {/* Preview button for files */}
                          {hasFiles && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreviewingFile(mat.files![0]);
                              }}
                              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-emerald-800 bg-white border border-emerald-200 rounded-lg hover:bg-emerald-50 shrink-0 cursor-pointer"
                            >
                              <Eye className="w-3 h-3" />
                              Vis PDF
                            </button>
                          )}
                        </div>

                        {/* Optional custom note and worksheet toggle per item */}
                        {isSelected && (
                          <div className="pt-2 border-t border-emerald-100 pl-6 space-y-1.5" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-between gap-2 flex-wrap text-[11px]">
                              <label className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700 hover:text-emerald-800">
                                <input
                                  type="checkbox"
                                  checked={isWorksheetEnabled(mat.id)}
                                  onChange={() => toggleWorksheetForMaterial(mat.id)}
                                  disabled={!includeWorksheetsInPdf}
                                  className="w-3.5 h-3.5 accent-emerald-700 rounded cursor-pointer"
                                />
                                <span>Inkluder eget oppgaveark i PDF (egen side)</span>
                              </label>
                              <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                                isWorksheetEnabled(mat.id)
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-stone-100 text-slate-500'
                              }`}>
                                {isWorksheetEnabled(mat.id) ? '✓ Skrives ut på egen side' : 'Kun i sjekkliste'}
                              </span>
                            </div>

                            <input
                              type="text"
                              placeholder="Spesifikt notat for eleven på denne oppgaven (f.eks. 'fokus på oppgave 4')"
                              value={customItemNotes[mat.id] || ''}
                              onChange={(e) =>
                                setCustomItemNotes({ ...customItemNotes, [mat.id]: e.target.value })
                              }
                              className="w-full p-1.5 text-xs bg-white rounded border border-emerald-200 focus:outline-none"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* General teacher note */}
            <div>
              <label className="block text-slate-700 font-semibold mb-1">
                Lærerens interne notater til timen
              </label>
              <textarea
                rows={2}
                placeholder="F.eks. Husk å repetere ABC-formelen og gi ros for innsatsen på forrige ukesprøve..."
                value={teacherNotes}
                onChange={(e) => setTeacherNotes(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-stone-300 bg-white text-xs"
              />
            </div>

          </div>
        )}

        {/* TAB 2: PRINT PREVIEW & READY TO PRINT / EXPORT */}
        {activeTab === 'preview' && (
          <div className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs flex-1 bg-stone-100/50">
            
            {/* Beta Iframe Sandbox Explanation & PDF Download Banner */}
            <div className="bg-emerald-50/90 border border-emerald-200 rounded-xl p-3.5 text-xs text-emerald-950 shadow-2xs space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <div className="w-6 h-6 rounded-md bg-emerald-700 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                    <FileText className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <span className="font-bold text-emerald-950 text-xs">
                      Ferdig formatert PDF-timeplan for enkel utskrift og forhåndsvisning
                    </span>
                    <p className="text-[11px] text-emerald-800 leading-relaxed mt-0.5">
                      Du kan nå generere og laste ned en ekte <strong>.pdf-fil</strong> med Metis-topptekst, elevmål, gjennomgangstabell med sensornotater og avkryssingsbokser for veiledningstimen.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={handlePreviewPdf}
                    disabled={isGeneratingPdf}
                    className="inline-flex items-center gap-1 text-[11px] bg-white text-emerald-800 font-semibold px-2.5 py-1 rounded-lg border border-emerald-300 hover:bg-emerald-100 transition-colors shadow-2xs"
                    title="Forhåndsvis den genererte PDF-en på skjermen"
                  >
                    <Eye className="w-3 h-3 text-emerald-700" />
                    Forhåndsvis PDF
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadPdf}
                    disabled={isGeneratingPdf}
                    className="inline-flex items-center gap-1 text-[11px] bg-emerald-700 text-white font-bold px-3 py-1 rounded-lg hover:bg-emerald-800 transition-colors shadow-2xs"
                    title="Last ned PDF direkte til maskinen"
                  >
                    <Download className="w-3 h-3" />
                    Last ned PDF
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1.5 border-t border-emerald-200/60 text-[11px]">
                <div className="bg-white/90 p-2 rounded-lg border border-emerald-200">
                  <strong className="text-emerald-900 block flex items-center gap-1">
                    <Download className="w-3 h-3 text-emerald-700" /> 1. Last ned .PDF:
                  </strong>
                  <span>Genererer en A4-PDF med sidetall og avkryssingsbokser til veiledningen.</span>
                </div>
                <div className="bg-white/90 p-2 rounded-lg border border-emerald-200">
                  <strong className="text-emerald-900 block flex items-center gap-1">
                    <Eye className="w-3 h-3 text-emerald-700" /> 2. Se PDF før lansering:
                  </strong>
                  <span>Trykk <strong>«Forhåndsvis PDF»</strong> for å se dokumentet direkte her i appen.</span>
                </div>
                <div className="bg-white/90 p-2 rounded-lg border border-emerald-200">
                  <strong className="text-emerald-900 block flex items-center gap-1">
                    <Copy className="w-3 h-3 text-emerald-700" /> 3. Kopier til Word / OneNote:
                  </strong>
                  <span>Trykk <strong>«Kopier tekst»</strong> om du vil redigere videre i et tekstdokument.</span>
                </div>
              </div>
            </div>

            {/* Notice when PDF is ready */}
            {pdfResult && (
              <div className="bg-white border-2 border-emerald-600/40 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                    <Check className="w-4 h-4 stroke-[2.5]" />
                  </div>
                  <div>
                    <div className="font-semibold text-xs text-slate-900">
                      PDF-dokument er klart: <span className="font-mono text-emerald-700">{pdfResult.filename}</span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Formatert i henhold til A4 med elevinformasjon og oppgavesett.
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowPdfViewer(true)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-300 font-semibold text-xs hover:bg-emerald-100 transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Se PDF nå
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadPdf}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-700 text-white font-bold text-xs hover:bg-emerald-800 transition-colors shadow-2xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Last ned på nytt
                  </button>
                  <button
                    type="button"
                    onClick={() => window.open(pdfResult.blobUrl, '_blank')}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-stone-300 text-slate-600 hover:bg-stone-100 text-xs"
                    title="Åpne PDF i egen nettleserfane"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Dynamic notice if user tried to print or download HTML */}
            {downloadNotice && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start justify-between gap-2 text-[11px] text-amber-900">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <p>{downloadNotice}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setDownloadNotice(null)}
                  className="text-amber-600 hover:text-amber-900 text-xs font-bold px-1"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Toolbar for Print, Copy & Download */}
            <div className="bg-white p-3 rounded-xl border border-stone-200 shadow-2xs flex flex-wrap items-center justify-between gap-3 no-print">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-slate-800 text-xs">
                  Timepakke ({chosenMaterials.length} oppgaver valgt)
                </span>
                {hasAppliedStatus && (
                  <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1">
                    <Check className="w-3 h-3" /> Koblet til elevprofil
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-100 text-slate-700 border border-stone-300 hover:bg-stone-200 font-medium text-xs transition-colors"
                  title={isFullscreen ? 'Lukk fullskjerm' : 'Les hele heftet i fullskjerm'}
                >
                  {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                  <span>{isFullscreen ? 'Liten visning' : 'Fullskjerm / Lesemodus'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleCopyPacketText}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium text-xs transition-all border ${
                    copied
                      ? 'bg-emerald-700 text-white border-emerald-700 shadow-2xs'
                      : 'bg-white text-slate-700 hover:bg-stone-50 border-stone-300'
                  }`}
                  title="Kopier hele timepakken klar til å limes inn i Word eller Google Docs"
                >
                  {copied ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Kopiert til Word / Docs!' : 'Kopier tekst (Word/Docs)'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSaveSessionInternal(false)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 font-semibold text-xs cursor-pointer"
                  title="Lagre denne timepakken i appen på elevens profil"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Lagre time i appen</span>
                </button>

                <button
                  type="button"
                  onClick={handlePreviewPdf}
                  disabled={isGeneratingPdf}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-100 text-slate-800 border border-stone-300 hover:bg-stone-200 font-medium text-xs transition-colors"
                  title="Forhåndsvis PDF-dokumentet i appen"
                >
                  <Eye className="w-3.5 h-3.5 text-slate-600" />
                  Forhåndsvis PDF
                </button>

                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={isGeneratingPdf}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-700 text-white font-bold hover:bg-emerald-800 transition-colors shadow-2xs text-xs"
                  title="Generer og last ned som PDF for enkel utskrift"
                >
                  <Download className="w-3.5 h-3.5" />
                  {isGeneratingPdf ? 'Lager PDF...' : 'Last ned PDF (.pdf)'}
                </button>

                <button
                  type="button"
                  onClick={handlePrint}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-300 text-slate-700 hover:bg-stone-100 transition-colors text-xs"
                  title="Åpner utskriftsdialog for A4-utskrift eller Lagre som PDF"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Skriv ut (Print)
                </button>
              </div>
            </div>

            {/* The Actual A4 Document Preview Card (Formatted cleanly for printing) */}
            <div className="bg-white p-6 sm:p-8 rounded-xl border border-stone-300 shadow-md max-w-3xl mx-auto space-y-5 print:p-0 print:border-none print:shadow-none">
              
              {/* Header */}
              <div className="border-b-2 border-emerald-700 pb-3 flex items-start justify-between">
                <div>
                  <div className="text-[11px] font-bold tracking-wider text-emerald-800 uppercase">
                    Metis Utdanning • Veiledningshefte
                  </div>
                  <h1 className="text-xl font-bold text-slate-900 mt-0.5">{sessionTitle}</h1>
                </div>
                <div className="text-right text-[11px] text-slate-500">
                  <div>Dato: <strong>{sessionDate}</strong></div>
                  <div>Tid: <strong>{sessionTime}</strong></div>
                </div>
              </div>

              {/* Student & Subject Overview */}
              <div className="bg-stone-50 border border-stone-200 rounded-lg p-3.5 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                <div>
                  <span className="text-slate-400 block">Elev</span>
                  <strong className="text-slate-900 text-xs">{selectedStudent?.name}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block">Klasse / Gruppe</span>
                  <strong className="text-slate-900 text-xs">{selectedStudent?.classGroup}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block">Fag</span>
                  <strong className="text-slate-900 text-xs">{selectedSubject?.name}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block">Målkarakter</span>
                  <strong className="text-emerald-700 font-bold text-xs">Karakter {selectedStudent?.targetGrade}</strong>
                </div>

                {sessionGoals && (
                  <div className="col-span-2 sm:col-span-4 pt-1 border-t border-stone-200 mt-1">
                    <span className="text-slate-400 block">Mål for timen</span>
                    <p className="text-slate-700">{sessionGoals}</p>
                  </div>
                )}
              </div>

              {/* Chosen Tasks / Materials */}
              <div className="space-y-3">
                <div className="font-bold text-slate-900 text-xs border-b border-stone-200 pb-1 flex items-center justify-between">
                  <span>Oppgaver & Pensum ({chosenMaterials.length} deler)</span>
                  <span className="text-[10px] text-slate-400 font-normal">Avkrysningsskjema for timen</span>
                </div>

                {chosenMaterials.map((mat, idx) => (
                  <div key={mat.id} className="border border-stone-200 rounded-lg p-3.5 space-y-2 bg-white">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-xs">{idx + 1}.</span>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded ${getCategoryBadgeClass(mat.category)}`}>
                          {getCategoryLabel(mat.category)}
                        </span>
                        <h4 className="font-bold text-slate-900 text-xs">{mat.title}</h4>
                      </div>
                      {mat.term && (
                        <span className="text-[10px] text-slate-500">{mat.term}</span>
                      )}
                    </div>

                    <p className="text-slate-600 text-xs">{mat.description}</p>

                    {mat.attachedNotes && (
                      <div className="bg-amber-50 border border-amber-200 rounded p-2 text-[11px] text-amber-900 italic">
                        <strong>Lærerfokus / Sensorveiledning:</strong> {mat.attachedNotes}
                      </div>
                    )}

                    {customItemNotes[mat.id] && (
                      <div className="text-[11px] text-emerald-900 bg-emerald-50 p-2 rounded border border-emerald-200 font-medium">
                        <strong>Oppgaveinstruks:</strong> {customItemNotes[mat.id]}
                      </div>
                    )}

                    {/* Handwriting / Teacher Notes lines */}
                    <div className="pt-2">
                      <div className="text-[10px] text-slate-400 font-medium mb-1">Notater fra gjennomgangen:</div>
                      <div className="border-b border-dashed border-stone-300 h-6" />
                      <div className="border-b border-dashed border-stone-300 h-6" />
                    </div>

                    {/* Checkboxes for physical printout */}
                    <div className="pt-2 border-t border-stone-100 flex items-center gap-4 text-[11px] text-slate-600">
                      <label className="flex items-center gap-1.5">
                        <Square className="w-3.5 h-3.5 text-slate-400" /> Gjennomgått i time
                      </label>
                      <label className="flex items-center gap-1.5">
                        <Square className="w-3.5 h-3.5 text-slate-400" /> God mestring
                      </label>
                      <label className="flex items-center gap-1.5">
                        <Square className="w-3.5 h-3.5 text-slate-400" /> Lekse til neste gang
                      </label>
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer Summary Box */}
              <div className="border border-stone-200 rounded-lg p-3.5 space-y-1">
                <div className="font-semibold text-slate-800 text-xs">Oppsummering & Avtaler for neste time:</div>
                <div className="h-16 text-[10px] text-slate-400">
                  (Bruk dette feltet til felles notater under samtalen med eleven...)
                </div>
              </div>

            </div>

            {/* DEDIKERTE OPPGAVEARK FOR ELEVEN (HVER OPPGAVE PÅ EGEN SIDE) */}
            {includeWorksheetsInPdf &&
              chosenMaterials
                .filter((m) => isWorksheetEnabled(m.id))
                .map((mat, wsIdx, arr) => (
                  <div
                    key={`worksheet-${mat.id}`}
                    className="bg-white p-6 sm:p-8 rounded-xl border border-stone-300 shadow-md max-w-3xl mx-auto space-y-4 print:p-0 print:border-none print:shadow-none print:break-before-page"
                  >
                    {/* Header for eget oppgaveark */}
                    <div className="flex items-start justify-between border-b-2 border-emerald-700 pb-3">
                      <div>
                        <div className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
                          Metis Utdanning • Oppgaveark ({wsIdx + 1} av {arr.length})
                        </div>
                        <h2 className="text-lg font-bold text-slate-900 mt-0.5">{mat.title}</h2>
                        {mat.term && (
                          <div className="text-[11px] text-slate-500 font-medium">{mat.term}</div>
                        )}
                      </div>
                      <div className="text-right text-[11px] text-slate-500 shrink-0">
                        <div><strong>{selectedStudent?.name}</strong></div>
                        <div>{selectedSubject?.name} ({selectedSubject?.code})</div>
                        <div className="text-emerald-700 font-bold mt-0.5">Side {wsIdx + 2} i timepakken</div>
                      </div>
                    </div>

                    {/* Oppgavetekst */}
                    <div className="bg-stone-50 border border-stone-200 rounded-lg p-4 space-y-1.5">
                      <div className="text-[10px] font-bold text-emerald-800 uppercase tracking-wide">
                        Oppgavetekst & Problemstilling:
                      </div>
                      <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">
                        {mat.description || 'Ingen oppgavetekst registrert for dette elementet.'}
                      </p>
                    </div>

                    {/* Sensorveiledning / Lærerfokus */}
                    {mat.attachedNotes && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-[11px] text-amber-900 leading-relaxed">
                        <strong className="block mb-0.5 text-amber-950 font-bold">Sensorveiledning & Lærerfokus:</strong>
                        {mat.attachedNotes}
                      </div>
                    )}

                    {/* Lærerens instruks til eleven */}
                    {customItemNotes[mat.id] && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-[11px] text-emerald-950 leading-relaxed">
                        <strong className="block mb-0.5 text-emerald-900 font-bold">Veilederens instruks til deg:</strong>
                        {customItemNotes[mat.id]}
                      </div>
                    )}

                    {/* Elevens arbeidsfelt med linjer */}
                    <div className="border border-stone-200 rounded-lg p-4 space-y-2">
                      <div className="text-[10px] font-bold text-slate-700 uppercase tracking-wide">
                        Arbeidsområde & Utregninger (kladd, formler, svar):
                      </div>
                      <div className="space-y-4 pt-2">
                        <div className="border-b border-dashed border-stone-300 h-6" />
                        <div className="border-b border-dashed border-stone-300 h-6" />
                        <div className="border-b border-dashed border-stone-300 h-6" />
                        <div className="border-b border-dashed border-stone-300 h-6" />
                        <div className="border-b border-dashed border-stone-300 h-6" />
                        <div className="border-b border-dashed border-stone-300 h-6" />
                      </div>
                    </div>

                    {/* Egenvurdering og vurderingsfelt nederst */}
                    <div className="bg-stone-50 border border-stone-200 rounded-lg p-3 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-700">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="font-bold text-slate-800">Egenvurdering:</span>
                        <label className="flex items-center gap-1"><Square className="w-3.5 h-3.5 text-slate-400" /> Selvstendig</label>
                        <label className="flex items-center gap-1"><Square className="w-3.5 h-3.5 text-slate-400" /> Veiledet</label>
                        <label className="flex items-center gap-1"><Square className="w-3.5 h-3.5 text-slate-400" /> Må repeteres</label>
                        <label className="flex items-center gap-1 text-emerald-700 font-semibold"><Square className="w-3.5 h-3.5 text-emerald-600" /> Godkjent ✓</label>
                      </div>
                      <div className="text-slate-500 font-mono text-[10px]">
                        Lærerens signatur: ____________
                      </div>
                    </div>
                  </div>
                ))}
          </div>
        )}

        {/* Footer */}
        <div className="bg-stone-50 border-t border-stone-200 p-3.5 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg border border-stone-300 text-slate-700 hover:bg-stone-100 text-xs cursor-pointer"
          >
            Lukk
          </button>

          {activeTab === 'select' ? (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => handleSaveSessionInternal(false)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-emerald-600 bg-white text-emerald-800 font-bold hover:bg-emerald-50 text-xs transition-colors cursor-pointer shadow-2xs"
                title="Lagrer timen i systemet under 'Veiledningstimer' og på elevprofilen, uten å markere som ferdig ennå"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                <span>Lagre time i appen</span>
              </button>

              <button
                type="button"
                onClick={() => handleSaveSessionInternal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-800 text-white font-bold hover:bg-emerald-900 text-xs transition-colors cursor-pointer shadow-2xs"
                title="Lagrer timen og markerer automatisk alle oppgaver som gjennomgått på elevkortet"
              >
                <CheckSquare className="w-3.5 h-3.5" />
                <span>Marker som gjennomført nå</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                disabled={selectedMaterialIds.length === 0}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-700 text-white font-medium hover:bg-emerald-800 disabled:opacity-40 text-xs shadow-2xs cursor-pointer"
              >
                <span>Se utskriftshefte ({selectedMaterialIds.length})</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setActiveTab('select')}
                className="px-3 py-1.5 rounded-lg border border-stone-300 text-slate-700 hover:bg-stone-100 text-xs cursor-pointer"
              >
                Tilbake til innholdsvalg
              </button>
              <button
                type="button"
                onClick={() => handleSaveSessionInternal(false)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-emerald-600 bg-white text-emerald-800 font-bold hover:bg-emerald-50 text-xs transition-colors cursor-pointer shadow-2xs"
                title="Lagre timen i appen slik at du kan finne den igjen på elevkortet og under veiledningstimer"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                <span>Lagre time i appen</span>
              </button>
              <button
                type="button"
                onClick={() => handleSaveSessionInternal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-800 text-white font-bold hover:bg-emerald-900 text-xs transition-colors cursor-pointer shadow-2xs"
                title="Marker som gjennomført og oppdater elevens oppgaver automatisk"
              >
                <CheckSquare className="w-3.5 h-3.5" />
                <span>Marker som gjennomført</span>
              </button>
              <button
                type="button"
                onClick={handlePreviewPdf}
                disabled={isGeneratingPdf}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-100 text-slate-800 border border-stone-300 hover:bg-stone-200 text-xs font-medium transition-colors cursor-pointer"
                title="Forhåndsvis PDF direkte i appen"
              >
                <Eye className="w-3.5 h-3.5 text-slate-600" />
                <span>Forhåndsvis PDF</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={isGeneratingPdf}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-emerald-700 text-white font-bold hover:bg-emerald-800 text-xs shadow-2xs transition-colors cursor-pointer"
                title="Last ned timeplan som PDF-fil"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{isGeneratingPdf ? 'Genererer PDF...' : 'Last ned PDF (.pdf)'}</span>
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-300 text-slate-700 hover:bg-stone-100 text-xs transition-colors cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print</span>
              </button>
            </div>
          )}
        </div>

        {/* PDF Document Preview Modal */}
        {showPdfViewer && pdfResult && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 z-60">
            <div className="bg-white rounded-2xl max-w-5xl w-full h-[92vh] border border-stone-200 shadow-2xl flex flex-col overflow-hidden">
              <div className="bg-stone-50 border-b border-stone-200 p-3 sm:p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-700 text-white flex items-center justify-center shadow-2xs">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                      <span>{pdfResult.filename}</span>
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded">
                        PDF Klar
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Ferdig formatert A4-utskrift med Metis-topptekst, elevmål, oppgavesett og avkryssing
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => window.open(pdfResult.blobUrl, '_blank')}
                    className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-stone-300 text-slate-700 hover:bg-stone-100 transition-colors"
                    title="Åpne i egen fane"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Åpne i full fane</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadPdf}
                    className="inline-flex items-center gap-1.5 text-xs px-3.5 py-1.5 rounded-lg bg-emerald-700 text-white font-bold hover:bg-emerald-800 transition-colors shadow-2xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Last ned PDF</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowPdfViewer(false)}
                    className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-stone-200 transition-colors ml-1"
                    title="Lukk PDF-visning"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="flex-1 bg-stone-200 p-2 overflow-hidden flex flex-col">
                <iframe
                  src={pdfResult.blobUrl}
                  className="w-full h-full border-0 rounded-lg bg-white shadow-inner"
                  title="PDF Forhåndsvisning"
                />
              </div>
            </div>
          </div>
        )}

        {/* File preview modal */}
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
