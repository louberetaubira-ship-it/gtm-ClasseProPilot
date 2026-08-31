

export type SequenceType = 
  | 'Cours magistral'
  | 'Travaux pratiques (TP)'
  | 'Travaux dirigés (TD)'
  | 'Devoir maison (DM)'
  | 'QCM'
  | 'Synthèses'
  | 'Remédiation'
  | 'Devoir sur table (DST)';

export interface Diploma {
  id: string;
  name: string;
  repository: RepositoryData;
}

export enum LevelCode {
  TA = 'TA',
  PA = 'PA',
  IA = 'IA',
  NA = 'NA',
  NE = 'NE',
}

export interface LevelDetails {
  label: string;
  score: number;
  color: string;
  bgColor: string;
}

export enum CompetencyCode {
  C1 = 'C1',
  C2 = 'C2',
  C3 = 'C3',
  C4 = 'C4',
  C5 = 'C5',
  C6 = 'C6',
  C7 = 'C7',
  C8 = 'C8',
  C9 = 'C9',
  C10 = 'C10',
  C11 = 'C11',
  C12 = 'C12',
  C13 = 'C13',
  C14 = 'C14',
  C15 = 'C15',
  C16 = 'C16',
  C17 = 'C17',
  C18 = 'C18',
  C19 = 'C19',
  C20 = 'C20',
}

export enum ActivityCode {
  A1 = 'A1',
  A2 = 'A2',
  A3 = 'A3',
  A4 = 'A4',
  A5 = 'A5',
}

export interface SavoirDef {
  code: string;
  label: string;
}

export interface TacheDef {
  code: string;
  label: string;
}

export interface ActivityDefWithTasks {
  code: ActivityCode;
  label: string;
  tasks: TacheDef[];
}

export interface CompetencyDef {
  code: CompetencyCode;
  label: string;
  activities: ActivityCode[];
  criteria?: string[]; // Ajout des critères d'évaluation de base
}

export interface EvaluationItem {
  competencyCode: CompetencyCode;
  level: LevelCode;
  comment: string; // Critère d'évaluation specifics
}

export interface SessionActivityDetail {
  title: string;
  duration: string;
  description: string; // Mise en situation / Contexte
  studentConsignes: string; // Document Élève
  teacherCorrection: string; // Document Professeur
  diagramPrompt?: string; // Prompt IA pour image
  diagramImage?: string; // Image générée en base64
}

export interface TechnicalDoc {
  name: string;
  type: string; // MIME type
  data: string; // base64 data URL
}

export interface TpSession {
  id: string;
  title: string; // Thème de la séance
  sequenceType?: SequenceType;
  date: string;
  studentName: string; // Can be "Modèle" or Teacher Name
  studentClass: string;
  
  // Heavy fields, only for templates
  description?: string; 
  targetAudience?: string;
  duration?: string;
  objectives?: string[];
  materials?: string[];
  sessionActivities?: SessionActivityDetail[];
  supportImage?: string; 
  technicalDocs?: TechnicalDoc[];
  pedagogicalInspiration?: TechnicalDoc[]; // New field for inspiration documents
  content?: string; // For simpler, text-based sessions (Course, QCM, etc.)

  activities: ActivityCode[];
  evaluations: EvaluationItem[];
  globalNote: number;
  aiSummary?: string;

  isTemplate?: boolean; 
  templateId?: string; 
  diplomaId: string;
}

export interface ExamCompetency {
  code: CompetencyCode;
  weight: number; // Percentage, e.g., 25 for 25%
}

export interface ExamDef {
  code: string;
  label: string;
  coef: number;
  competencies: ExamCompetency[];
  isProfessional?: boolean;
}

export interface Student {
  id: string;
  firstName: string;
  lastName: string;
  studentPassword?: string;
  parentPassword?: string;
  birthDate?: string;
  email?: string;
  address?: string;
  phone?: string;
  photo?: string; // base64 data URL
  manualCompetencyOverrides?: Record<string, LevelCode>; // key is competencyCode
}

export interface StudentClass {
  id: string;
  name: string;
  students: Student[];
  diplomaId: string;
}

// FIX: Removed geminiApiKey from UserSettingsData as per guideline to not handle API keys in the UI.
// The key should only come from process.env.API_KEY.
export interface UserSettingsData {
  teacherName: string;
  establishmentLogo?: string;
  examThresholds?: {
    TA: number;
    PA: number;
    IA: number;
  };
  customScores?: {
    [key in LevelCode]: number;
  };
}

// Nouvelle interface pour le référentiel
export interface RepositoryData {
  competencies: CompetencyDef[];
  exams: ExamDef[];
  savoirs?: SavoirDef[];
  activities?: ActivityDefWithTasks[];
}

// --- SaaS Types ---
export type SubscriptionPlan = 'Essentiel' | 'Premium' | 'Pro';

export interface Subscriber {
  id: string;
  name: string;
  email: string; // Used as the login identifier
  subscriptionPlan: SubscriptionPlan;
  status: 'active' | 'inactive';
  createdAt: string; // ISO string
}

// --- Auth Types ---
export type UserRole = 'admin' | 'student' | 'parent' | 'tutor' | 'super-admin';

export interface AuthUser {
  role: UserRole;
  name: string;
  id?: string; // Student ID if role is student/parent, Tutor Email if tutor
  classId?: string; // Class ID if role is student/parent
  subscriberId?: string; // For 'admin' role
  isImpersonating?: boolean;
}

// --- Schedule Types ---
export interface ScheduleEvent {
  id: string;
  dayIndex: number; // 0 = Lundi, 1 = Mardi...
  startTime: string; // format "HHhMM" ex: "08h30"
  endTime: string;   // format "HHhMM" ex: "10h30"
  title: string;
  subtitle?: string;
  details?: string; // Salle, etc.
  color: string; // CSS classes string for bg, border, text
}

export interface Holiday {
  id: string;
  name: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

// --- Internship (PFMP) Types ---

export interface InternshipPeriod {
  id: string;
  classId: string;
  title: string; // ex: "PFMP 1 - Juin 2025"
  startDate: string;
  endDate: string;
}

export interface PortfolioItem {
  id: string;
  date: string;
  type: 'journal' | 'photo';
  content: string; // Text description or Base64 image
  comment?: string; // Teacher feedback
}

export interface InternshipCompetencyEvaluation {
  competencyCode: string;
  level: LevelCode;
}

export interface InternshipPreEvaluation {
  competencies: InternshipCompetencyEvaluation[];
}

export interface InternshipTutorEvaluation {
  competencies: InternshipCompetencyEvaluation[];
  globalGrade: number; // Calculated from competencies
  tutorComment: string;
  tutorSignature?: string;
}

export type VisitObservation = Record<string, string>;

export interface InternshipVisitReport {
  studentActivities: string;
  generalAppreciation: string;
  eventualAbsences: string;
  tutorObservations: VisitObservation;
  teacherSignature?: string;
}

export interface StudentInternship {
  id: string;
  studentId: string;
  periodId: string;
  
  // Company Info
  companyName: string;
  companyAddress: string;
  tutorName: string;
  tutorEmail: string;
  tutorPhone: string;
  tutorPassword?: string;
  
  // Teacher Info
  referentTeacherGen: string;
  referentTeacherPro: string;
  
  // Content
  portfolio: PortfolioItem[];
  preEvaluation?: InternshipPreEvaluation;
  tutorEvaluation?: InternshipTutorEvaluation;
  visitReport?: InternshipVisitReport;
  absentDays?: string[]; // YYYY-MM-DD date strings

  // Grades
  visitReportGrade?: number;
  portfolioGrade?: number;
}

export interface InternshipDataStore {
  periods: InternshipPeriod[];
  internships: StudentInternship[];
}