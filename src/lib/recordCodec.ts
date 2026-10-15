import type { Subject, Student, Material, Assignment, PlannedSession } from '../types';
export type TableName = 'subjects' | 'students' | 'materials' | 'assignments' | 'sessions';
type RecordValue = Subject | Student | Material | Assignment | PlannedSession;
type Row = { id: string; owner_email: string; data?: Record<string, unknown>; [key: string]: any };

// Preserve every domain field, including nested notes, session items and file metadata.
// Relational columns enforce parent ownership and remain usable in the table editor.
export function encodeRecord(table: TableName, item: RecordValue, ownerId: string, email: string) {
  const data = { ...item, ownerEmail: email.toLowerCase() };
  const row: Record<string, unknown> = { id: item.id, owner_id: ownerId, owner_email: email.toLowerCase(), data };
  if (table === 'subjects') Object.assign(row, { name: (item as Subject).name, code: (item as Subject).code });
  if (table === 'students') Object.assign(row, { name: (item as Student).name, email: (item as Student).email });
  if (table === 'materials') Object.assign(row, { title: (item as Material).title, subject_id: (item as Material).subjectId || null });
  if (table === 'assignments') Object.assign(row, { student_id: (item as Assignment).studentId, material_id: (item as Assignment).materialId });
  if (table === 'sessions') Object.assign(row, { date: (item as PlannedSession).date, student_id: (item as PlannedSession).studentId || null, subject_id: (item as PlannedSession).subjectId || null });
  return row;
}

export function decodeRecord(table: TableName, row: Row): any {
  let defaults: Record<string, unknown> = {};
  if (table === 'subjects') defaults = { name: row.name, code: row.code, color: row.color || '#0f172a', gradeLevel: row.grade_level || '', description: row.description || '' };
  if (table === 'students') defaults = { name: row.name, email: row.email || '', phone: row.phone || '', classGroup: '', enrolledSubjectIds: row.active_subject_ids || [], targetGrade: 0, currentMastery: 'middels', strengths: '', areasToImprove: '', personalGoals: '', notes: [], avatarBg: 'bg-emerald-100', createdAt: row.created_at };
  if (table === 'materials') defaults = { subjectId: row.subject_id || '', title: row.title, category: 'pensum', description: row.description || '', importance: 'anbefalt', files: row.files || [], createdAt: row.created_at };
  if (table === 'assignments') defaults = { studentId: row.student_id, materialId: row.material_id, status: row.status || 'ikke_tildelt', assignedDate: row.assigned_date || '', teacherNote: row.notes || '', studentScore: row.score || '' };
  if (table === 'sessions') defaults = { studentId: row.student_id || '', subjectId: row.subject_id || '', title: '', date: row.date, time: row.time || '', status: 'planlagt', items: [], teacherNotes: row.teacher_notes || '', createdAt: row.created_at };
  return { ...defaults, ...row.data, id: row.id, ownerEmail: row.owner_email };
}
