import { jsPDF } from 'jspdf';
import { Student, Subject, Material, Assignment } from '../types';
import { getCategoryLabel, getStatusLabel, getMasteryLabel } from './helpers';

export interface GenerateStudentReportOptions {
  student: Student;
  subjects: Subject[];
  materials: Material[];
  assignments: Assignment[];
}

export function generateStudentReportPDF(options: GenerateStudentReportOptions): {
  doc: jsPDF;
  filename: string;
  save: () => void;
  getBlobUrl: () => string;
} {
  const { student, subjects, materials, assignments } = options;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let currentY = margin;

  // Colors
  const primaryEmerald: [number, number, number] = [4, 120, 87];
  const darkSlate: [number, number, number] = [15, 23, 42];
  const textMuted: [number, number, number] = [100, 116, 139];
  const cardBorder: [number, number, number] = [203, 213, 225];
  const bgLight: [number, number, number] = [248, 250, 252];

  const checkPageBreak = (needed: number) => {
    if (currentY + needed > pageHeight - 16) {
      doc.addPage();
      currentY = margin;
      drawHeaderContinuation();
    }
  };

  const drawHeaderContinuation = () => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...textMuted);
    doc.text(`METIS UTDANNING - ELEVRAPPORT: ${student.name}`, margin, currentY);
    doc.text(`Dato: ${new Date().toLocaleDateString('no-NO')}`, pageWidth - margin, currentY, { align: 'right' });
    currentY += 4;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(margin, currentY, pageWidth - margin, currentY);
    currentY += 6;
  };

  // Top emerald stripe
  doc.setFillColor(...primaryEmerald);
  doc.rect(margin, currentY, contentWidth, 3, 'F');
  currentY += 7;

  // Subtitle / Brand
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...primaryEmerald);
  doc.text('METIS UTDANNING  |  INDIVIDUELL ELEVRAPPORT & FREMDRIFTSOVERSIKT', margin, currentY);

  const todayStr = new Date().toLocaleDateString('no-NO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...textMuted);
  doc.text(`Generert: ${todayStr}`, pageWidth - margin, currentY, { align: 'right' });
  currentY += 6;

  // Student Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...darkSlate);
  doc.text(student.name, margin, currentY);
  currentY += 7;

  // Subtitle
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...textMuted);
  doc.text(`Klasse/Gruppe: ${student.classGroup}   |   E-post: ${student.email}   |   Telefon: ${student.phone || 'Ikke oppgitt'}`, margin, currentY);
  currentY += 6;

  doc.setDrawColor(...cardBorder);
  doc.setLineWidth(0.4);
  doc.line(margin, currentY, pageWidth - margin, currentY);
  currentY += 6;

  // Key stats overview card
  const studentAssignments = assignments.filter((a) => a.studentId === student.id);
  const completedAssignments = studentAssignments.filter((a) => a.status === 'gjennomgatt' || a.status === 'levert');
  const inProgressAssignments = studentAssignments.filter((a) => a.status === 'under_arbeid');
  const assignedOnly = studentAssignments.filter((a) => a.status === 'tildelt');
  const pct = studentAssignments.length > 0 ? Math.round((completedAssignments.length / studentAssignments.length) * 100) : 0;

  // Draw 4 mini stat boxes
  const boxWidth = (contentWidth - 6) / 4;
  const statBoxHeight = 16;
  const stats = [
    { label: 'Målkarakter', val: `Karakter ${student.targetGrade}` },
    { label: 'Mestringsstatus', val: getMasteryLabel(student.currentMastery) },
    { label: 'Gjennomføring', val: `${pct}% (${completedAssignments.length}/${studentAssignments.length})` },
    { label: 'Under arbeid', val: `${inProgressAssignments.length} oppgaver` },
  ];

  stats.forEach((s, idx) => {
    const x = margin + idx * (boxWidth + 2);
    doc.setFillColor(...bgLight);
    doc.setDrawColor(...cardBorder);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, currentY, boxWidth, statBoxHeight, 2, 2, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...textMuted);
    doc.text(s.label, x + 3, currentY + 4.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...darkSlate);
    doc.text(s.val, x + 3, currentY + 11);
  });
  currentY += statBoxHeight + 6;

  // Profile details box (Styrker, Fokusområder, Særskilte behov)
  checkPageBreak(30);
  const detailsTop = currentY;
  let dY = detailsTop + 5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...darkSlate);
  doc.text('Faglige styrker:', margin + 4, dY);
  doc.setFont('helvetica', 'normal');
  const strengthsLines = doc.splitTextToSize(student.strengths || 'Ikke spesifisert', contentWidth - 45);
  doc.text(strengthsLines, margin + 42, dY);
  dY += strengthsLines.length * 4.5 + 2;

  doc.setFont('helvetica', 'bold');
  doc.text('Fokus / Utvikling:', margin + 4, dY);
  doc.setFont('helvetica', 'normal');
  const improveLines = doc.splitTextToSize(student.areasToImprove || 'Ikke spesifisert', contentWidth - 45);
  doc.text(improveLines, margin + 42, dY);
  dY += improveLines.length * 4.5 + 2;

  if (student.specialConsiderations) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(180, 83, 9);
    doc.text('Tilrettelegging:', margin + 4, dY);
    doc.setFont('helvetica', 'normal');
    const specLines = doc.splitTextToSize(student.specialConsiderations, contentWidth - 45);
    doc.text(specLines, margin + 42, dY);
    dY += specLines.length * 4.5 + 2;
  }

  const detailsHeight = dY - detailsTop + 2;
  doc.setFillColor(...bgLight);
  doc.setDrawColor(...cardBorder);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, detailsTop, contentWidth, detailsHeight, 2, 2, 'D');
  currentY = detailsTop + detailsHeight + 6;

  // Subjects & Assignments list
  checkPageBreak(15);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...darkSlate);
  doc.text('Oppgaveliste og fremdrift per fag', margin, currentY);
  currentY += 4;
  doc.setDrawColor(...cardBorder);
  doc.setLineWidth(0.3);
  doc.line(margin, currentY, pageWidth - margin, currentY);
  currentY += 6;

  // Group by enrolled subjects
  const studentSubjects = subjects.filter((s) => student.enrolledSubjectIds.includes(s.id));

  studentSubjects.forEach((sub) => {
    checkPageBreak(25);

    // Subject header banner
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(margin, currentY, contentWidth, 7, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...darkSlate);
    doc.text(`${sub.name} (${sub.code})`, margin + 3, currentY + 4.8);
    currentY += 10;

    // Find materials and assignments for this subject
    const subjectMaterials = materials.filter((m) => m.subjectId === sub.id);

    if (subjectMaterials.length === 0) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(...textMuted);
      doc.text('Ingen registrerte pensumdeler i dette faget ennå.', margin + 4, currentY);
      currentY += 6;
      return;
    }

    subjectMaterials.forEach((mat) => {
      const asgn = studentAssignments.find((a) => a.materialId === mat.id);
      const statusLabel = asgn ? getStatusLabel(asgn.status) : 'Ikke påbegynt';
      const catLabel = getCategoryLabel(mat.category).toUpperCase();

      const titleText = `• [${catLabel}] ${mat.title}`;
      const descLines = mat.attachedNotes
        ? doc.splitTextToSize(`Merknad: ${mat.attachedNotes}`, contentWidth - 20)
        : [];
      const noteLines = asgn?.teacherNote
        ? doc.splitTextToSize(`Lærernotat: ${asgn.teacherNote}`, contentWidth - 20)
        : [];

      let itemHeight = 6 + (descLines.length * 3.5) + (noteLines.length * 3.5);
      checkPageBreak(itemHeight + 2);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(...darkSlate);
      doc.text(titleText, margin + 4, currentY);

      // Status right aligned
      let statusColor: [number, number, number] = [100, 116, 139];
      if (asgn?.status === 'gjennomgatt' || asgn?.status === 'levert') statusColor = [4, 120, 87];
      if (asgn?.status === 'under_arbeid') statusColor = [217, 119, 6];
      if (asgn?.status === 'tildelt') statusColor = [37, 99, 235];

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...statusColor);
      doc.text(statusLabel, pageWidth - margin - 3, currentY, { align: 'right' });
      currentY += 4.5;

      if (descLines.length > 0) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(...textMuted);
        doc.text(descLines, margin + 8, currentY);
        currentY += descLines.length * 3.5;
      }

      if (noteLines.length > 0) {
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(7.5);
        doc.setTextColor(15, 23, 42);
        doc.text(noteLines, margin + 8, currentY);
        currentY += noteLines.length * 3.5;
      }

      currentY += 2;
    });

    currentY += 4;
  });

  // Notes and meeting logs section
  if (student.notes && student.notes.length > 0) {
    checkPageBreak(25);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...darkSlate);
    doc.text(`Veiledningslogg & Notater (${student.notes.length})`, margin, currentY);
    currentY += 4;
    doc.setDrawColor(...cardBorder);
    doc.setLineWidth(0.3);
    doc.line(margin, currentY, pageWidth - margin, currentY);
    currentY += 5;

    student.notes.forEach((n) => {
      const noteLines = doc.splitTextToSize(n.content, contentWidth - 30);
      const needed = noteLines.length * 4 + 6;
      checkPageBreak(needed);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...textMuted);
      doc.text(`${n.date} [${n.type.toUpperCase()}]:`, margin + 4, currentY);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...darkSlate);
      doc.text(noteLines, margin + 30, currentY);
      currentY += needed;
    });
  }

  // Footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const footerY = pageHeight - 10;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...textMuted);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(margin, footerY - 3, pageWidth - margin, footerY - 3);

    doc.text('Metis Utdanning  |  Individuell Elevrapport  -  Konfidensielt skoledokument', margin, footerY);
    doc.text(`Side ${i} av ${totalPages}`, pageWidth - margin, footerY, { align: 'right' });
  }

  const cleanName = student.name.replace(/[^a-zA-Z0-9æøåÆØÅ_-]/g, '_');
  const filename = `Elevrapport_${cleanName}_${new Date().toISOString().slice(0, 10)}.pdf`;

  const getBlobUrl = () => {
    const blob = doc.output('blob');
    return URL.createObjectURL(blob);
  };

  const save = () => {
    try {
      doc.save(filename);
    } catch {
      const url = getBlobUrl();
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        a.remove();
        URL.revokeObjectURL(url);
      }, 1000);
    }
  };

  return {
    doc,
    filename,
    save,
    getBlobUrl,
  };
}
