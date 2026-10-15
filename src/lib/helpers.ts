import { AssignmentStatus, MaterialCategory, MasteryLevel } from '../types';

export function getCategoryLabel(cat: MaterialCategory): string {
  switch (cat) {
    case 'eksamen':
      return 'Eksamen';
    case 'pensum':
      return 'Pensum';
    case 'lekse':
      return 'Lekse';
    case 'teori':
      return 'Teori & Notater';
    case 'prove':
      return 'Prøve';
    default:
      return cat;
  }
}

export function getCategoryBadgeClass(cat: MaterialCategory): string {
  switch (cat) {
    case 'eksamen':
      return 'bg-purple-50 text-purple-700 border border-purple-200';
    case 'pensum':
      return 'bg-blue-50 text-blue-700 border border-blue-200';
    case 'lekse':
      return 'bg-amber-50 text-amber-700 border border-amber-200';
    case 'teori':
      return 'bg-teal-50 text-teal-700 border border-teal-200';
    case 'prove':
      return 'bg-rose-50 text-rose-700 border border-rose-200';
    default:
      return 'bg-zinc-100 text-zinc-700 border border-zinc-200';
  }
}

export function getStatusLabel(status: AssignmentStatus): string {
  switch (status) {
    case 'ikke_tildelt':
      return 'Ikke tildelt';
    case 'tildelt':
      return 'Tildelt / Lekse gitt';
    case 'under_arbeid':
      return 'Under arbeid';
    case 'gjennomgatt':
      return 'Gjennomgått i time';
    case 'levert':
      return 'Fullført / Levert';
    default:
      return status;
  }
}

export function getStatusBadgeClass(status: AssignmentStatus): string {
  switch (status) {
    case 'gjennomgatt':
      return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
    case 'levert':
      return 'bg-teal-50 text-teal-700 border border-teal-200';
    case 'under_arbeid':
      return 'bg-amber-50 text-amber-700 border border-amber-200';
    case 'tildelt':
      return 'bg-blue-50 text-blue-700 border border-blue-200';
    case 'ikke_tildelt':
      return 'bg-zinc-50 text-zinc-500 border border-zinc-200';
    default:
      return 'bg-zinc-100 text-zinc-600 border border-zinc-200';
  }
}

export function getMasteryLabel(level: MasteryLevel): string {
  switch (level) {
    case 'lav':
      return 'Trenger grunnleggende støtte';
    case 'middels':
      return 'Middels mestring';
    case 'god':
      return 'God mestring';
    case 'svart_god':
      return 'Svært høy måloppnåelse';
    default:
      return level;
  }
}

export function getMasteryBadgeClass(level: MasteryLevel): string {
  switch (level) {
    case 'lav':
      return 'bg-rose-50 text-rose-700 border border-rose-200';
    case 'middels':
      return 'bg-amber-50 text-amber-700 border border-amber-200';
    case 'god':
      return 'bg-blue-50 text-blue-700 border border-blue-200';
    case 'svart_god':
      return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
    default:
      return 'bg-zinc-100 text-zinc-600 border border-zinc-200';
  }
}

export function getSubjectColorClasses(color: string): { bg: string; text: string; border: string } {
  switch (color) {
    case 'emerald':
      return { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200' };
    case 'indigo':
      return { bg: 'bg-indigo-50', text: 'text-indigo-800', border: 'border-indigo-200' };
    case 'amber':
      return { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' };
    case 'rose':
      return { bg: 'bg-rose-50', text: 'text-rose-800', border: 'border-rose-200' };
    case 'teal':
      return { bg: 'bg-teal-50', text: 'text-teal-800', border: 'border-teal-200' };
    default:
      return { bg: 'bg-slate-50', text: 'text-slate-800', border: 'border-slate-200' };
  }
}
