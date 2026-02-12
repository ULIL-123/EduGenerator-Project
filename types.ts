
export type QuestionType = 'Pilihan Ganda' | 'Pilihan Ganda Kompleks (MCMA)' | 'Pilihan Ganda Kompleks (Kategori)';

export interface Question {
  id: string;
  subject: 'Matematika' | 'Bahasa Indonesia';
  topic: string;
  type: QuestionType;
  text: string;
  passage?: string; // For Indonesian texts or Math word problems
  options?: string[]; // For MC and MCMA
  correctAnswer: any; // string for MC, array for MCMA, object for Category
  categories?: { statement: string, category: string }[]; // For Category type
  explanation?: string;
  cognitiveLevel: 'L1 (Pemahaman)' | 'L2 (Penerapan)' | 'L3 (Penalaran)'; // Mandatory for accountability
}

export interface TopicSelection {
  math: string[];
  indonesian: string[];
}

export interface User {
  username: string;
  phone: string; // WhatsApp Active Number
  password?: string;
}

export interface UserResult {
  username: string;
  score: number;
  totalQuestions: number;
  correctCount: number;
  date: string;
  topics: string[];
}

export interface ExamData {
  title: string;
  questions: Question[];
  generatedAt: string;
}
