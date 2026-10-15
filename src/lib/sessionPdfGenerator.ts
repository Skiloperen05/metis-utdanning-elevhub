import { jsPDF } from 'jspdf';
import { Student, Subject, Material } from '../types';
import { getCategoryLabel } from './helpers';

export interface GenerateSessionPdfOptions {
  sessionTitle: string;
  sessionDate: string;
  sessionTime: string;
  sessionGoals: string;
  teacherNotes: string;
  student: Student;
  subject: Subject;
  materials: Material[];
  customItemNotes?: Record<string, string>;
  includeTaskWorksheets?: boolean;
  worksheetsToInclude?: string[];
}

export function generateSessionPacketPDF(options: GenerateSessionPdfOptions): {
  doc: jsPDF;
  filename: string;
  save: () => void;
  getBlob: () => Blob;
  getBlobUrl: () => string;
} {
  const {
    sessionTitle,
    sessionDate,
    sessionTime,
    sessionGoals,
    teacherNotes,
    student,
    subject,
    materials,
    customItemNotes = {},
    includeTaskWorksheets = true,
    worksheetsToInclude,
  } = options;

  // Initialize jsPDF A4 in portrait mode (210mm x 297mm)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 14;
  const contentWidth = pageWidth - margin * 2; // 182 mm
  let currentY = margin;

  // Color constants (RGB)
  const primaryEmerald: [number, number, number] = [4, 120, 87];     // #047857
  const darkSlate: [number, number, number] = [15, 23, 42];          // #0f172a
  const textMuted: [number, number, number] = [100, 116, 139];       // #64748b
  const cardBorder: [number, number, number] = [203, 213, 225];      // #cbd5e1
  const bgLight: [number, number, number] = [248, 250, 252];         // #f8fafc
  const amberBorder: [number, number, number] = [217, 119, 6];       // #d97706
  const amberBg: [number, number, number] = [254, 252, 232];         // #fefce8

  // Helper for adding a new page with header
  const checkPageBreak = (neededHeight: number) => {
    if (currentY + neededHeight > pageHeight - 16) {
      doc.addPage();
      currentY = margin;
      drawContinuationHeader();
    }
  };

  const drawContinuationHeader = () => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...textMuted);
    doc.text(
      `METIS UTDANNING - VEILEDNINGSTIME (${student.name} - ${subject.name})`,
      margin,
      currentY
    );
    doc.text(`Dato: ${sessionDate}`, pageWidth - margin, currentY, { align: 'right' });
    currentY += 4;
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(margin, currentY, pageWidth - margin, currentY);
    currentY += 6;
  };

  // --- PAGE 1: HEADER ---
  // Top green branding accent strip
  doc.setFillColor(...primaryEmerald);
  doc.rect(margin, currentY, contentWidth, 3, 'F');
  currentY += 7;

  // Subtitle / Brand name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...primaryEmerald);
  doc.text('METIS UTDANNING  |  VEILEDNINGSTIME & OPPGAVEHEFTE', margin, currentY);

  // Date and timestamp right aligned
  const todayStr = new Date().toLocaleDateString('no-NO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...textMuted);
  doc.text(`Utskrevet: ${todayStr}`, pageWidth - margin, currentY, { align: 'right' });
  currentY += 6;

  // Main session title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...darkSlate);
  const titleLines = doc.splitTextToSize(sessionTitle || 'Veiledningstime', contentWidth);
  doc.text(titleLines, margin, currentY);
  currentY += titleLines.length * 7 + 2;

  // Divider line
  doc.setDrawColor(...cardBorder);
  doc.setLineWidth(0.4);
  doc.line(margin, currentY, pageWidth - margin, currentY);
  currentY += 6;

  // --- INFO CARD (Elev & Fag info) ---
  const infoCardTop = currentY;
  const col1X = margin + 5;
  const col2X = margin + (contentWidth / 2) + 2;

  const goalsLines = sessionGoals ? doc.splitTextToSize(sessionGoals, contentWidth - 30) : [];
  const notesLines = teacherNotes ? doc.splitTextToSize(teacherNotes, contentWidth - 30) : [];
  const specLines = student.specialConsiderations
    ? doc.splitTextToSize(student.specialConsiderations, contentWidth - 30)
    : [];

  let infoCardHeight = 16;
  if (specLines.length > 0) infoCardHeight += specLines.length * 4.5 + 2;
  if (goalsLines.length > 0) infoCardHeight += goalsLines.length * 4.5 + 2;
  if (notesLines.length > 0) infoCardHeight += notesLines.length * 4.5 + 2;

  // Draw background box for Info
  doc.setFillColor(...bgLight);
  doc.setDrawColor(...cardBorder);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, infoCardTop, contentWidth, infoCardHeight, 2, 2, 'FD');

  let infoInnerY = infoCardTop + 5;

  // Row 1
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...darkSlate);
  doc.text('Elev:', col1X, infoInnerY);
  doc.setFont('helvetica', 'normal');
  doc.text(`${student.name} (${student.classGroup})`, col1X + 18, infoInnerY);

  doc.setFont('helvetica', 'bold');
  doc.text('Fag:', col2X, infoInnerY);
  doc.setFont('helvetica', 'normal');
  doc.text(`${subject.name} (${subject.code})`, col2X + 18, infoInnerY);
  infoInnerY += 5.5;

  // Row 2
  doc.setFont('helvetica', 'bold');
  doc.text('Mål:', col1X, infoInnerY);
  doc.setFont('helvetica', 'normal');
  doc.text(`Karakter ${student.targetGrade}  (Mestringsstatus: ${student.currentMastery})`, col1X + 18, infoInnerY);

  doc.setFont('helvetica', 'bold');
  doc.text('Tid:', col2X, infoInnerY);
  doc.setFont('helvetica', 'normal');
  doc.text(`${sessionDate} kl. ${sessionTime}`, col2X + 18, infoInnerY);
  infoInnerY += 5.5;

  // Row 3: Special considerations if any
  if (specLines.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.text('Tilpassing:', col1X, infoInnerY);
    doc.setFont('helvetica', 'normal');
    doc.text(specLines, col1X + 18, infoInnerY);
    infoInnerY += specLines.length * 4.5 + 1;
  }

  // Session Goals (if any)
  if (goalsLines.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.text('Fokusmål:', col1X, infoInnerY);
    doc.setFont('helvetica', 'normal');
    doc.text(goalsLines, col1X + 18, infoInnerY);
    infoInnerY += goalsLines.length * 4.5 + 1;
  }

  // Teacher notes (if any)
  if (notesLines.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.text('Lærernotat:', col1X, infoInnerY);
    doc.setFont('helvetica', 'normal');
    doc.text(notesLines, col1X + 18, infoInnerY);
    infoInnerY += notesLines.length * 4.5 + 1;
  }

  currentY = infoCardTop + infoCardHeight + 8;

  // --- SECTION TITLE: GJENNOMGANGSPLAN ---
  checkPageBreak(15);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...darkSlate);
  doc.text(`Gjennomgangsplan & Oppgavesett (${materials.length} deler)`, margin, currentY);
  currentY += 5;
  doc.setDrawColor(...cardBorder);
  doc.setLineWidth(0.3);
  doc.line(margin, currentY, pageWidth - margin, currentY);
  currentY += 6;

  // --- MATERIALS CARDS ---
  materials.forEach((mat, index) => {
    // Calculate required height for this material item
    const itemNum = index + 1;
    const catLabel = getCategoryLabel(mat.category).toUpperCase();
    const itemTitle = `${itemNum}. [${catLabel}] ${mat.title}${mat.term ? ` (${mat.term})` : ''}`;

    const descLines = mat.description
      ? doc.splitTextToSize(mat.description, contentWidth - 10)
      : [];
    const sensorLines = mat.attachedNotes
      ? doc.splitTextToSize(`Sensorveiledning / Lærerfokus: ${mat.attachedNotes}`, contentWidth - 16)
      : [];
    const customNotes = customItemNotes[mat.id];
    const customLines = customNotes
      ? doc.splitTextToSize(`Instruks til elev: ${customNotes}`, contentWidth - 12)
      : [];

    let estimatedHeight = 18 + (descLines.length * 4);
    if (sensorLines.length > 0) estimatedHeight += sensorLines.length * 4 + 7;
    if (customLines.length > 0) estimatedHeight += customLines.length * 4 + 5;
    if (mat.files && mat.files.length > 0) estimatedHeight += 5;
    // Checkboxes + notes line
    estimatedHeight += 18;

    checkPageBreak(estimatedHeight + 4);

    const cardTop = currentY;

    // Draw card outline
    doc.setDrawColor(...cardBorder);
    doc.setLineWidth(0.3);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(margin, cardTop, contentWidth, estimatedHeight, 2, 2, 'FD');

    let innerY = cardTop + 5;
    const innerX = margin + 5;

    // Item Header (Title & Category)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...darkSlate);
    doc.text(itemTitle, innerX, innerY);
    innerY += 5.5;

    // Description
    if (descLines.length > 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      doc.text(descLines, innerX, innerY);
      innerY += descLines.length * 4 + 2;
    }

    // Sensor guidance / Attached notes box
    if (sensorLines.length > 0) {
      const sensorBoxHeight = sensorLines.length * 4 + 4;
      doc.setFillColor(...amberBg);
      doc.setDrawColor(...amberBorder);
      doc.setLineWidth(0.2);
      doc.roundedRect(innerX, innerY, contentWidth - 10, sensorBoxHeight, 1.5, 1.5, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(146, 64, 14); // amber 800
      doc.text(sensorLines, innerX + 3, innerY + 3.5);
      innerY += sensorBoxHeight + 3;
    }

    // Custom student instructions
    if (customLines.length > 0) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text(customLines, innerX, innerY);
      innerY += customLines.length * 4 + 2;
    }

    // Attached files indication
    if (mat.files && mat.files.length > 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...textMuted);
      const fileNames = mat.files.map((f) => `${f.name} (${f.type})`).join(', ');
      doc.text(`Vedlagt dokument: ${fileNames}`, innerX, innerY);
      innerY += 4.5;
    }

    // Divider before checkboxes
    doc.setDrawColor(241, 245, 249);
    doc.setLineWidth(0.2);
    doc.line(innerX, innerY, margin + contentWidth - 5, innerY);
    innerY += 4;

    // Checkboxes for during/after session
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...darkSlate);

    // Box 1
    doc.setDrawColor(...cardBorder);
    doc.setLineWidth(0.3);
    doc.rect(innerX, innerY - 2.8, 3.2, 3.2);
    doc.text('Gjennomgått i time', innerX + 5, innerY);

    // Box 2
    const box2X = innerX + 46;
    doc.rect(box2X, innerY - 2.8, 3.2, 3.2);
    doc.text('Mestring god (mål nådd)', box2X + 5, innerY);

    // Box 3
    const box3X = innerX + 96;
    doc.rect(box3X, innerY - 2.8, 3.2, 3.2);
    doc.text('Lekse / repeteres', box3X + 5, innerY);
    innerY += 5;

    // Notes line for handwriting
    doc.setFontSize(7.5);
    doc.setTextColor(...textMuted);
    doc.text('Notater fra veiledningen:', innerX, innerY);
    doc.setDrawColor(203, 213, 225);
    doc.setLineDashPattern([1, 1], 0);
    doc.line(innerX + 33, innerY, margin + contentWidth - 5, innerY);
    doc.setLineDashPattern([], 0); // reset dash

    currentY = cardTop + estimatedHeight + 4;
  });

  // --- SECTION: OPPSUMMERING OG AVTALER FOR NESTE GANG ---
  checkPageBreak(35);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...darkSlate);
  doc.text('Oppsummering & Avtaler for neste veiledningstime', margin, currentY);
  currentY += 4;
  doc.setDrawColor(...cardBorder);
  doc.setLineWidth(0.3);
  doc.line(margin, currentY, pageWidth - margin, currentY);
  currentY += 5;

  // Box for teacher's handwritten notes at the end of the session
  const summaryBoxTop = currentY;
  const summaryBoxHeight = 24;
  doc.setFillColor(...bgLight);
  doc.setDrawColor(...cardBorder);
  doc.setLineWidth(0.3);
  doc.roundedRect(margin, summaryBoxTop, contentWidth, summaryBoxHeight, 2, 2, 'FD');

  let sY = summaryBoxTop + 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...darkSlate);
  doc.text('Avtalt lekse / egeninnsats til neste gang:', margin + 4, sY);
  doc.setDrawColor(203, 213, 225);
  doc.setLineDashPattern([1, 1], 0);
  doc.line(margin + 58, sY, margin + contentWidth - 4, sY);

  sY += 6;
  doc.line(margin + 4, sY, margin + contentWidth - 4, sY);

  sY += 6;
  doc.setFont('helvetica', 'bold');
  doc.text('Neste veiledningstime:', margin + 4, sY);
  doc.line(margin + 36, sY, margin + contentWidth - 4, sY);
  doc.setLineDashPattern([], 0);

  currentY = summaryBoxTop + summaryBoxHeight + 8;

  // --- DEDICATED TASK WORKSHEET PAGES (ONE PAGE PER SELECTED TASK) ---
  const materialsForWorksheets = includeTaskWorksheets
    ? materials.filter((m) => !worksheetsToInclude || worksheetsToInclude.includes(m.id))
    : [];

  materialsForWorksheets.forEach((mat, wsIdx) => {
    // Start on a fresh page for each task worksheet
    doc.addPage();
    let wsY = margin;

    // Top green brand bar
    doc.setFillColor(...primaryEmerald);
    doc.rect(margin, wsY, contentWidth, 3, 'F');
    wsY += 7;

    // Subtitle & task counter
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...primaryEmerald);
    doc.text('METIS UTDANNING  |  OPPGAVEARK & ARBEIDSARK', margin, wsY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...textMuted);
    doc.text(
      `Oppgave ${wsIdx + 1} av ${materialsForWorksheets.length}  •  ${sessionDate}`,
      pageWidth - margin,
      wsY,
      { align: 'right' }
    );
    wsY += 4;

    // Top divider
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(margin, wsY, pageWidth - margin, wsY);
    wsY += 5;

    // Student & Subject Mini-Bar
    const metaBarHeight = 12;
    doc.setFillColor(...bgLight);
    doc.setDrawColor(...cardBorder);
    doc.setLineWidth(0.25);
    doc.roundedRect(margin, wsY, contentWidth, metaBarHeight, 1.5, 1.5, 'FD');

    const metaY = wsY + 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...darkSlate);
    doc.text('Elev:', margin + 4, metaY);
    doc.setFont('helvetica', 'normal');
    doc.text(`${student.name} (${student.classGroup})`, margin + 14, metaY);

    const midColX = margin + (contentWidth / 2) - 10;
    doc.setFont('helvetica', 'bold');
    doc.text('Fag:', midColX, metaY);
    doc.setFont('helvetica', 'normal');
    doc.text(`${subject.name} (${subject.code})`, midColX + 10, metaY);

    const rightColX = pageWidth - margin - 42;
    doc.setFont('helvetica', 'bold');
    doc.text('Mål:', rightColX, metaY);
    doc.setFont('helvetica', 'normal');
    doc.text(`Karakter ${student.targetGrade}`, rightColX + 8, metaY);

    // Meta Row 2
    const metaY2 = wsY + 9;
    doc.setFont('helvetica', 'bold');
    doc.text('Kategori:', margin + 4, metaY2);
    doc.setFont('helvetica', 'normal');
    const catText = `${getCategoryLabel(mat.category).toUpperCase()}${mat.term ? ` • ${mat.term}` : ''}${mat.estimatedMinutes ? ` • ca. ${mat.estimatedMinutes} min` : ''}`;
    doc.text(catText, margin + 20, metaY2);

    wsY += metaBarHeight + 6;

    // Task Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...darkSlate);
    const titleLines = doc.splitTextToSize(mat.title, contentWidth);
    doc.text(titleLines, margin, wsY);
    wsY += titleLines.length * 5.5 + 3;

    // Task description / exercise text box
    const descText = mat.description || 'Ingen utfyllende oppgavetekst registrert.';
    const descLines = doc.splitTextToSize(descText, contentWidth - 8);
    const descBoxHeight = Math.max(16, descLines.length * 4.2 + 8);

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...cardBorder);
    doc.setLineWidth(0.3);
    doc.roundedRect(margin, wsY, contentWidth, descBoxHeight, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...primaryEmerald);
    doc.text('OPPGAVETEKST & INSTRUKSJON:', margin + 4, wsY + 4.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    doc.text(descLines, margin + 4, wsY + 9);
    wsY += descBoxHeight + 4;

    // Sensor guidance / Teacher focus (if present)
    if (mat.attachedNotes) {
      const sensorLines = doc.splitTextToSize(`Sensorveiledning / Fokus: ${mat.attachedNotes}`, contentWidth - 8);
      const sensorHeight = sensorLines.length * 3.8 + 6;

      doc.setFillColor(...amberBg);
      doc.setDrawColor(...amberBorder);
      doc.setLineWidth(0.25);
      doc.roundedRect(margin, wsY, contentWidth, sensorHeight, 1.5, 1.5, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(146, 64, 14); // amber-800
      doc.text(sensorLines, margin + 4, wsY + 4.5);
      wsY += sensorHeight + 3.5;
    }

    // Individual teacher note for student (if present)
    const customNote = customItemNotes[mat.id];
    if (customNote) {
      const customLines = doc.splitTextToSize(`Lærerens personlige beskjed til deg: "${customNote}"`, contentWidth - 8);
      const customHeight = customLines.length * 3.8 + 6;

      doc.setFillColor(240, 253, 244); // emerald-50
      doc.setDrawColor(134, 239, 172); // emerald-300
      doc.setLineWidth(0.25);
      doc.roundedRect(margin, wsY, contentWidth, customHeight, 1.5, 1.5, 'FD');

      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(6, 95, 70); // emerald-800
      doc.text(customLines, margin + 4, wsY + 4.5);
      wsY += customHeight + 3.5;
    }

    // Attached files indication
    if (mat.files && mat.files.length > 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(...textMuted);
      const fileNames = mat.files.map((f) => `${f.name} (${f.type})`).join(', ');
      doc.text(`Vedlagt dokument: ${fileNames}`, margin, wsY);
      wsY += 4.5;
    }

    // STUDENT WORKING AREA (Workspace with lined writing guides)
    // Calculate remaining height on this page down to bottom assessment strip
    const bottomStripHeight = 16;
    const bottomMargin = 14;
    const availableWorkHeight = pageHeight - bottomMargin - bottomStripHeight - wsY - 4;

    if (availableWorkHeight > 30) {
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(...cardBorder);
      doc.setLineWidth(0.3);
      doc.roundedRect(margin, wsY, contentWidth, availableWorkHeight, 1.5, 1.5, 'FD');

      // Header of workspace
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...darkSlate);
      doc.text('ARBEIDSOMRÅDE & UTREGNING (kladd, formler, svar):', margin + 4, wsY + 5);

      // Draw faint ruled writing lines
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.2);
      doc.setLineDashPattern([1, 1], 0);

      const lineSpacing = 7;
      let lineY = wsY + 11;
      while (lineY < wsY + availableWorkHeight - 3) {
        doc.line(margin + 4, lineY, margin + contentWidth - 4, lineY);
        lineY += lineSpacing;
      }
      doc.setLineDashPattern([], 0); // reset dash

      wsY += availableWorkHeight + 4;
    }

    // BOTTOM ASSESSMENT & MASTERY STRIP
    const stripY = pageHeight - bottomMargin - bottomStripHeight;
    doc.setFillColor(...bgLight);
    doc.setDrawColor(...cardBorder);
    doc.setLineWidth(0.25);
    doc.roundedRect(margin, stripY, contentWidth, bottomStripHeight, 1.5, 1.5, 'FD');

    let evalY = stripY + 5.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...darkSlate);
    doc.text('Egenvurdering:', margin + 4, evalY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);

    // Checkbox 1: Løst selvstendig
    const cb1X = margin + 30;
    doc.rect(cb1X, evalY - 2.8, 3, 3);
    doc.text('Selvstendig', cb1X + 4.5, evalY);

    // Checkbox 2: Fikk veiledning
    const cb2X = cb1X + 32;
    doc.rect(cb2X, evalY - 2.8, 3, 3);
    doc.text('Med veiledning', cb2X + 4.5, evalY);

    // Checkbox 3: Trenger repetisjon
    const cb3X = cb2X + 34;
    doc.rect(cb3X, evalY - 2.8, 3, 3);
    doc.text('Må repeteres', cb3X + 4.5, evalY);

    // Checkbox 4: Godkjent
    const cb4X = cb3X + 32;
    doc.rect(cb4X, evalY - 2.8, 3, 3);
    doc.text('Godkjent ✓', cb4X + 4.5, evalY);

    // Teacher feedback/score line
    evalY += 5.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...textMuted);
    doc.text('Lærers tilbakemelding:', margin + 4, evalY);
    doc.setDrawColor(203, 213, 225);
    doc.setLineDashPattern([1, 1], 0);
    doc.line(margin + 40, evalY, pageWidth - margin - 4, evalY);
    doc.setLineDashPattern([], 0);
  });

  // --- FOOTER ON ALL PAGES ---
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

    doc.text('Metis Utdanning  |  Elevhub  -  Konfidensielt veiledningsdokument', margin, footerY);
    doc.text(`Side ${i} av ${totalPages}`, pageWidth - margin, footerY, { align: 'right' });
  }

  // Safe filename
  const cleanName = student.name.replace(/[^a-zA-Z0-9æøåÆØÅ_-]/g, '_');
  const cleanSubject = subject.code.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `Timeplan_${cleanName}_${cleanSubject}_${sessionDate}.pdf`;

  const getBlob = () => {
    return doc.output('blob');
  };

  const getBlobUrl = () => {
    const blob = getBlob();
    return URL.createObjectURL(blob);
  };

  const save = () => {
    try {
      doc.save(filename);
    } catch (e) {
      console.warn('doc.save triggered error, falling back to Blob download:', e);
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
    getBlob,
    getBlobUrl,
  };
}
