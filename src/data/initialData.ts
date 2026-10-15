import { AppDatabase, Subject, Material, Student, Assignment, PlannedSession } from '../types';

export const INITIAL_SUBJECTS: Subject[] = [];
export const INITIAL_MATERIALS: Material[] = [];
export const INITIAL_STUDENTS: Student[] = [];
export const INITIAL_ASSIGNMENTS: Assignment[] = [];
export const INITIAL_SESSIONS: PlannedSession[] = [];

export const INITIAL_DATABASE: AppDatabase = {
  subjects: INITIAL_SUBJECTS,
  materials: INITIAL_MATERIALS,
  students: INITIAL_STUDENTS,
  assignments: INITIAL_ASSIGNMENTS,
  sessions: INITIAL_SESSIONS,
  lastUpdated: new Date().toISOString(),
};
