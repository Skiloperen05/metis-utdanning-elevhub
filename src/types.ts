export type MaterialCategory = 'eksamen' | 'pensum' | 'lekse' | 'teori' | 'prove';

export type AssignmentStatus = 'ikke_tildelt' | 'tildelt' | 'under_arbeid' | 'gjennomgatt' | 'levert';

export type MasteryLevel = 'lav' | 'middels' | 'god' | 'svart_god';

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  role?: 'primary_owner' | 'teacher';
}

export interface Subject {
  id: string;
  code: string; // e.g. "MAT1001"
  name: string; // e.g. "Matematikk 1T"
  gradeLevel: string; // e.g. "VG1", "VG2", "VG3", "Privatist"
  description: string;
  color: string; // Tailwind accent badge color
  ownerEmail?: string;
}

export interface MaterialFile {
  id: string;
  storagePath?: string;
  name: string;
  size: number;
  type: string; // e.g. "application/pdf", "image/png"
  dataUrl: string; // Base64 data URL for preview and download
  uploadedAt: string;
}

export interface Material {
  id: string;
  subjectId: string;
  title: string;
  category: MaterialCategory;
  description: string;
  term?: string; // e.g. "Vår 2024", "Høst 2023", "Hele året"
  externalUrl?: string;
  attachedNotes?: string;
  estimatedMinutes?: number;
  importance: 'kjerne' | 'anbefalt' | 'fordypning';
  files?: MaterialFile[];
  createdAt: string;
  ownerEmail?: string;
}

export interface StudentNote {
  id: string;
  date: string;
  author: string;
  content: string;
  type: 'oppfølging' | 'time' | 'varsel' | 'mestring';
  durationMinutes?: number;
  topicsCovered?: string;
  coveredMaterialIds?: string[];
  homeworkOrNextSteps?: string;
}

export interface Student {
  id: string;
  name: string;
  email: string;
  phone?: string;
  classGroup: string; // e.g. "Privatist V25 - Gruppe A", "VG3 Påbygg"
  enrolledSubjectIds: string[];
  targetGrade: number; // e.g. 5
  currentMastery: MasteryLevel;
  strengths: string;
  areasToImprove: string;
  personalGoals: string;
  specialConsiderations?: string; // f.eks. utvidet tid på eksamen, dysleksi, nettundervisning
  notes: StudentNote[];
  avatarBg: string;
  createdAt: string;
  ownerEmail?: string;
}

export interface Assignment {
  id: string; // composite or uuid
  studentId: string;
  materialId: string;
  status: AssignmentStatus;
  assignedDate: string;
  completedDate?: string;
  teacherNote?: string;
  studentScore?: string; // e.g. "5/6" eller "God forståelse av brøk"
  ownerEmail?: string;
}

export type SessionStatus = 'planlagt' | 'gjennomfort' | 'avlyst';

export interface PlannedSessionItem {
  materialId: string;
  customNote?: string;
  completed?: boolean;
}

export interface PlannedSession {
  id: string;
  studentId: string;
  subjectId: string;
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // e.g. "14:00 - 15:30"
  goals?: string;
  teacherNotes?: string;
  summaryAfterSession?: string;
  status: SessionStatus;
  items: PlannedSessionItem[];
  includeWorksheets?: boolean;
  createdAt: string;
  completedAt?: string;
  ownerEmail?: string;
}

export interface AppDatabase {
  subjects: Subject[];
  materials: Material[];
  students: Student[];
  assignments: Assignment[];
  sessions: PlannedSession[];
  lastUpdated: string;
}
