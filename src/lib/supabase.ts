import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AppDatabase, Assignment, Material, PlannedSession, Student, Subject } from '../types';

const STORAGE_URL_KEY = 'metis_supabase_url';
const STORAGE_ANON_KEY = 'metis_supabase_anon_key';

export function getStoredSupabaseConfig(): { url: string; key: string } | null {
  const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
  const envKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

  const localUrl = localStorage.getItem(STORAGE_URL_KEY) || '';
  const localKey = localStorage.getItem(STORAGE_ANON_KEY) || '';

  const url = (localUrl || envUrl).trim();
  const key = (localKey || envKey).trim();

  if (url && key && url.startsWith('http')) {
    return { url, key };
  }
  return null;
}

export function saveStoredSupabaseConfig(url: string, key: string): void {
  localStorage.setItem(STORAGE_URL_KEY, url.trim());
  localStorage.setItem(STORAGE_ANON_KEY, key.trim());
}

export function clearStoredSupabaseConfig(): void {
  localStorage.removeItem(STORAGE_URL_KEY);
  localStorage.removeItem(STORAGE_ANON_KEY);
}

let activeClient: SupabaseClient | null = null;
let lastUsedUrl = '';
let lastUsedKey = '';

export function getSupabaseClient(): SupabaseClient | null {
  const config = getStoredSupabaseConfig();
  if (!config) return null;

  if (activeClient && lastUsedUrl === config.url && lastUsedKey === config.key) {
    return activeClient;
  }

  try {
    activeClient = createClient(config.url, config.key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
    lastUsedUrl = config.url;
    lastUsedKey = config.key;
    return activeClient;
  } catch (err) {
    console.error('Failed to create Supabase client:', err);
    return null;
  }
}

export class SupabaseSyncService {
  private static instance: SupabaseSyncService;

  public static getInstance(): SupabaseSyncService {
    if (!SupabaseSyncService.instance) {
      SupabaseSyncService.instance = new SupabaseSyncService();
    }
    return SupabaseSyncService.instance;
  }

  public isConfigured(): boolean {
    return getStoredSupabaseConfig() !== null;
  }

  public async testConnection(): Promise<{ ok: boolean; error?: string }> {
    const client = getSupabaseClient();
    if (!client) {
      return { ok: false, error: 'Ingen Supabase-nøkler er konfigurert.' };
    }
    try {
      const { data, error } = await client.from('subjects').select('id').limit(1);
      if (error) {
        return { ok: false, error: error.message };
      }
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err?.message || String(err) };
    }
  }

  public async loadAllData(): Promise<Partial<AppDatabase>> {
    const client = getSupabaseClient();
    if (!client) return {};

    const [subRes, studRes, matRes, asgnRes, sessRes] = await Promise.all([
      client.from('subjects').select('*'),
      client.from('students').select('*'),
      client.from('materials').select('*'),
      client.from('assignments').select('*'),
      client.from('sessions').select('*'),
    ]);

    const subjects: Subject[] = (subRes.data || []).map((s: any) => ({
      id: s.id,
      name: s.name,
      code: s.code,
      color: s.color,
      gradeLevel: s.grade_level,
      description: s.description,
      ownerEmail: s.owner_email,
    }));

    const students: Student[] = (studRes.data || []).map((s: any) => ({
      id: s.id,
      name: s.name,
      email: s.email,
      phone: s.phone,
      activeSubjectIds: s.active_subject_ids || [],
      notes: s.notes,
      status: s.status,
      createdAt: s.created_at,
      ownerEmail: s.owner_email,
    }));

    const materials: Material[] = (matRes.data || []).map((m: any) => ({
      id: m.id,
      subjectId: m.subject_id,
      title: m.title,
      type: m.type,
      description: m.description,
      topic: m.topic,
      curriculumGoals: m.curriculum_goals || [],
      files: m.files || [],
      externalLinks: m.external_links || [],
      isExamRelevant: m.is_exam_relevant,
      gradeLevel: m.grade_level,
      createdAt: m.created_at,
      ownerEmail: m.owner_email,
    }));

    const assignments: Assignment[] = (asgnRes.data || []).map((a: any) => ({
      id: a.id,
      studentId: a.student_id,
      materialId: a.material_id,
      assignedDate: a.assigned_date,
      dueDate: a.due_date,
      completedDate: a.completed_date,
      status: a.status,
      score: a.score,
      notes: a.notes,
      feedback: a.feedback,
      ownerEmail: a.owner_email,
    }));

    const sessions: PlannedSession[] = (sessRes.data || []).map((ss: any) => ({
      id: ss.id,
      studentId: ss.student_id,
      studentName: ss.student_name,
      subjectId: ss.subject_id,
      subjectName: ss.subject_name,
      date: ss.date,
      time: ss.time,
      durationMinutes: ss.duration_minutes,
      plannedTopics: ss.planned_topics,
      completedTopics: ss.completed_topics,
      nextSteps: ss.next_steps,
      teacherNotes: ss.teacher_notes,
      ownerEmail: ss.owner_email,
      createdAt: ss.created_at,
    }));

    return { subjects, students, materials, assignments, sessions };
  }

  public subscribeToDatabase(
    onUpdate: (db: Partial<AppDatabase>) => void,
    onError: (err: Error) => void
  ): () => void {
    const client = getSupabaseClient();
    if (!client) {
      return () => {};
    }

    // Load initial data first
    this.loadAllData()
      .then((data) => onUpdate(data))
      .catch((e) => onError(e));

    // Listen to realtime channels on Supabase
    const channel = client
      .channel('metis_db_changes')
      .on('postgres_changes', { event: '*', schema: 'public' }, () => {
        this.loadAllData().then((data) => onUpdate(data));
      })
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }

  public async saveStudent(student: Student): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;

    await client.from('students').upsert({
      id: student.id,
      name: student.name,
      email: student.email || null,
      phone: student.phone || null,
      active_subject_ids: student.activeSubjectIds || [],
      notes: student.notes || null,
      status: student.status || 'aktiv',
      created_at: student.createdAt || new Date().toISOString(),
      owner_email: student.ownerEmail || 'birkhaugnes@gmail.com',
    });
  }

  public async deleteStudent(studentId: string): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;
    await client.from('students').delete().eq('id', studentId);
  }

  public async saveSubject(subject: Subject): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;

    await client.from('subjects').upsert({
      id: subject.id,
      name: subject.name,
      code: subject.code,
      color: subject.color || '#0f172a',
      grade_level: subject.gradeLevel || null,
      description: subject.description || null,
      owner_email: subject.ownerEmail || 'birkhaugnes@gmail.com',
    });
  }

  public async deleteSubject(subjectId: string): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;
    await client.from('subjects').delete().eq('id', subjectId);
  }

  public async saveMaterial(material: Material): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;

    // Clean bulky file strings for database safety
    const cleanFiles = (material.files || []).map((f) => ({
      id: f.id,
      name: f.name,
      size: f.size,
      type: f.type,
      uploadedAt: f.uploadedAt,
      // DataUrls are stored in IndexedDB on the device
      dataUrl: f.dataUrl && f.dataUrl.length < 50000 ? f.dataUrl : '',
    }));

    await client.from('materials').upsert({
      id: material.id,
      subject_id: material.subjectId,
      title: material.title,
      type: material.type,
      description: material.description || null,
      topic: material.topic || null,
      curriculum_goals: material.curriculumGoals || [],
      files: cleanFiles,
      external_links: material.externalLinks || [],
      is_exam_relevant: Boolean(material.isExamRelevant),
      grade_level: material.gradeLevel || null,
      created_at: material.createdAt || new Date().toISOString(),
      owner_email: material.ownerEmail || 'birkhaugnes@gmail.com',
    });
  }

  public async deleteMaterial(materialId: string): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;
    await client.from('materials').delete().eq('id', materialId);
  }

  public async saveAssignment(assignment: Assignment): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;

    await client.from('assignments').upsert({
      id: assignment.id,
      student_id: assignment.studentId,
      material_id: assignment.materialId,
      assigned_date: assignment.assignedDate || null,
      due_date: assignment.dueDate || null,
      completed_date: assignment.completedDate || null,
      status: assignment.status || 'ikke_tildelt',
      score: assignment.score || null,
      notes: assignment.notes || null,
      feedback: assignment.feedback || null,
      owner_email: assignment.ownerEmail || 'birkhaugnes@gmail.com',
    });
  }

  public async deleteAssignment(assignmentId: string): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;
    await client.from('assignments').delete().eq('id', assignmentId);
  }

  public async saveAssignmentsBulk(assignments: Assignment[]): Promise<void> {
    const client = getSupabaseClient();
    if (!client || assignments.length === 0) return;

    const payload = assignments.map((a) => ({
      id: a.id,
      student_id: a.studentId,
      material_id: a.materialId,
      assigned_date: a.assignedDate || null,
      due_date: a.dueDate || null,
      completed_date: a.completedDate || null,
      status: a.status || 'ikke_tildelt',
      score: a.score || null,
      notes: a.notes || null,
      feedback: a.feedback || null,
      owner_email: a.ownerEmail || 'birkhaugnes@gmail.com',
    }));

    await client.from('assignments').upsert(payload);
  }

  public async saveSession(session: PlannedSession): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;

    await client.from('sessions').upsert({
      id: session.id,
      student_id: session.studentId || null,
      student_name: session.studentName || null,
      subject_id: session.subjectId || null,
      subject_name: session.subjectName || null,
      date: session.date,
      time: session.time || null,
      duration_minutes: session.durationMinutes || 60,
      planned_topics: session.plannedTopics || null,
      completed_topics: session.completedTopics || null,
      next_steps: session.nextSteps || null,
      teacher_notes: session.teacherNotes || null,
      owner_email: session.ownerEmail || 'birkhaugnes@gmail.com',
      created_at: session.createdAt || new Date().toISOString(),
    });
  }

  public async deleteSession(sessionId: string): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;
    await client.from('sessions').delete().eq('id', sessionId);
  }

  public async importFullDatabase(data: AppDatabase): Promise<void> {
    for (const sub of data.subjects) {
      await this.saveSubject(sub);
    }
    for (const stud of data.students) {
      await this.saveStudent(stud);
    }
    for (const mat of data.materials) {
      await this.saveMaterial(mat);
    }
    for (const asgn of data.assignments) {
      await this.saveAssignment(asgn);
    }
    if (data.sessions) {
      for (const sess of data.sessions) {
        await this.saveSession(sess);
      }
    }
  }

  public async seedIfEmpty(localDb?: AppDatabase): Promise<void> {
    const client = getSupabaseClient();
    if (!client || !localDb) return;

    try {
      const { data } = await client.from('subjects').select('id').limit(1);
      if (!data || data.length === 0) {
        console.log('Seeding Supabase with local database...');
        await this.importFullDatabase(localDb);
      }
    } catch (e) {
      console.warn('Supabase seed check skipped:', e);
    }
  }
}
