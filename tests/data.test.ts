import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeRecord, decodeRecord } from '../src/lib/recordCodec';
import { emptyDatabase, loadDatabase, saveDatabase, validateDatabase } from '../src/lib/storage';
import type { Student, Material, PlannedSession } from '../src/types';

const cache = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', { value: {
  getItem: (key: string) => cache.get(key) ?? null,
  setItem: (key: string, value: string) => cache.set(key, value),
  removeItem: (key: string) => cache.delete(key),
} });
const student: Student = {
  id: 'student-1', name: 'Test Elev', email: '', classGroup: 'VG3', enrolledSubjectIds: ['subject-1'],
  targetGrade: 5, currentMastery: 'god', strengths: 'Algebra', areasToImprove: 'Geometri',
  personalGoals: 'Mestre faget', specialConsiderations: 'Test', notes: [{ id: 'note-1', date: '2026-10-15', author: 'Lærer', content: 'Testnotat', type: 'time', coveredMaterialIds: ['material-1'] }],
  avatarBg: 'bg-emerald-100', createdAt: '2026-10-15T10:00:00Z', ownerEmail: 'old@example.test',
};
test('student details and nested notes survive a database round trip', () => {
  const row = encodeRecord('students', student, 'user-a', 'Teacher@Example.test');
  const result = decodeRecord('students', row as any);
  assert.deepEqual(result, { ...student, ownerEmail: 'teacher@example.test', phone: '' });
  assert.equal(row.owner_id, 'user-a');
});

test('session plans retain goals, items, completion and worksheet settings', () => {
  const session: PlannedSession = { id: 'session-1', studentId: student.id, subjectId: 'subject-1', title: 'Veiledning',
    date: '2026-10-15', time: '14:00', goals: 'Algebra', teacherNotes: 'Test', summaryAfterSession: 'Fullført',
    status: 'gjennomfort', items: [{ materialId: 'material-1', completed: true, customNote: 'Del 2' }],
    includeWorksheets: true, completedAt: '2026-10-15', createdAt: '2026-10-15' };
  const result = decodeRecord('sessions', encodeRecord('sessions', session, 'a', 'a@example.test') as any);
  assert.deepEqual(result, { ...session, ownerEmail: 'a@example.test' });
});

test('material categories and private file metadata survive a round trip', () => {
  const material: Material = { id: 'material-1', subjectId: 'subject-1', title: 'Test', category: 'eksamen', description: 'Test',
    importance: 'kjerne', externalUrl: 'https://example.test', term: 'Høst', estimatedMinutes: 30, createdAt: '2026-10-15',
    files: [{ id: 'file-1', name: 'test.pdf', type: 'application/pdf', size: 100, dataUrl: '', uploadedAt: '2026-10-15', storagePath: 'a/material-1/file-1' }] };
  assert.deepEqual(decodeRecord('materials', encodeRecord('materials', material, 'a', 'a@example.test') as any),
    { ...material, ownerEmail: 'a@example.test' });
});

test('cache is isolated by verified user ID and never reads the old shared workspace', () => {
  const db = emptyDatabase(); db.students = [student];
  localStorage.setItem('metis_utdanning_hub_data_v2', JSON.stringify(db));
  assert.equal(loadDatabase().students.length, 0);
  saveDatabase(db, 'user-a');
  assert.equal(loadDatabase('user-a').students[0].id, student.id);
  assert.equal(loadDatabase('user-b').students.length, 0);
});

test('backup validation rejects missing parents and duplicates before any upload', () => {
  const db = emptyDatabase();
  db.assignments = [{ id: 'assignment-1', studentId: 'missing', materialId: 'missing', status: 'tildelt', assignedDate: '2026-10-15' }];
  assert.throws(() => validateDatabase(db), /mangler et fag/);
  db.assignments = []; db.students = [student, student];
  assert.throws(() => validateDatabase(db), /dupliserte/);
});
