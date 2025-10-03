import type { TIME_PERIODS, MOODS, MEDICATION_TIME_SLOTS, ALERT_TYPES, ALERT_SEVERITIES, USER_ROLES } from '../constants';

/**
 * User Types
 */
export type UserRole = (typeof USER_ROLES)[number];

export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Care Recipient Types
 */
export interface CareRecipient {
  id: string;
  familyId: string;
  name: string;
  dateOfBirth?: Date;
  condition?: string;
  location?: string;
  emergencyContact?: string;
  photoUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Caregiver Types
 */
export interface Caregiver {
  id: string;
  careRecipientId: string;
  name: string;
  phone?: string;
  language: string;
  pinCode: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Care Log Types
 */
export type TimePeriod = (typeof TIME_PERIODS)[number];
export type Mood = (typeof MOODS)[number];
export type MedicationTimeSlot = (typeof MEDICATION_TIME_SLOTS)[number];

export interface MedicationLog {
  name: string;
  given: boolean;
  time: string | null;
  timeSlot: MedicationTimeSlot;
}

export interface MealLog {
  time: string;
  appetite: number; // 1-5
  amountEaten: number; // percentage
  swallowingIssues: string[];
}

export interface FluidLog {
  name: string;
  time: string;
  amountMl: number;
  swallowingIssues: string[];
}

export interface ExerciseLog {
  type: string;
  duration: number; // minutes
  participation: number; // 1-5
}

export interface MobilityLog {
  steps?: number;
  distance?: number; // km
  walkingAssistance?: string;
  exercises?: ExerciseLog[];
}

export interface ToiletingLog {
  bowelFrequency: number;
  urineFrequency: number;
  diaperChanges: number;
  accidents: string;
  assistance: string;
  pain: string;
  urineColor?: string;
  bowelConsistency?: string;
}

export interface FallLog {
  occurred: boolean;
  type: 'none' | 'near_fall' | 'actual_fall';
  details?: string;
  injuries?: string;
}

export interface UnaccompaniedPeriod {
  from: string;
  to: string;
  reason: string;
  replacementPerson?: string;
  duration: number; // minutes
}

export interface CareLog {
  id: string;
  careRecipientId: string;
  caregiverId?: string;
  logDate: Date;
  timePeriod?: TimePeriod;

  // Morning Routine
  wakeTime?: string;
  mood?: Mood;
  showerTime?: string;
  hairWash?: boolean;

  // Medications
  medications?: MedicationLog[];

  // Meals
  meals?: {
    breakfast?: MealLog;
    lunch?: MealLog;
    dinner?: MealLog;
  };

  // Fluids
  fluids?: FluidLog[];
  totalFluidIntake?: number;

  // Vitals
  bloodPressure?: string;
  pulseRate?: number;
  oxygenLevel?: number;
  bloodSugar?: number;
  vitalsTime?: string;

  // Mobility
  mobility?: MobilityLog;

  // Toileting
  toileting?: ToiletingLog;

  // PSP-Specific
  balanceScale?: number;
  walkingPattern?: string[];
  freezingEpisodes?: 'none' | 'mild' | 'severe';
  eyeMovementProblems?: boolean;
  speechCommunicationScale?: number;

  // Safety
  falls?: FallLog;
  emergencyFlag: boolean;
  emergencyNote?: string;

  // Unaccompanied Time
  unaccompaniedPeriods?: UnaccompaniedPeriod[];
  totalUnaccompaniedMinutes?: number;

  // Notes
  notes?: string;

  createdAt: Date;
  updatedAt: Date;
}

/**
 * Medication Schedule Types
 */
export interface MedicationSchedule {
  id: string;
  careRecipientId: string;
  medicationName: string;
  dosage: string;
  purpose?: string;
  frequency: string;
  timeSlot: MedicationTimeSlot;
  timeSlots?: string[];
  dayRestriction?: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Alert Types
 */
export type AlertType = (typeof ALERT_TYPES)[number];
export type AlertSeverity = (typeof ALERT_SEVERITIES)[number];

export interface Alert {
  id: string;
  careRecipientId: string;
  alertType: AlertType;
  severity: AlertSeverity;
  message: string;
  acknowledged: boolean;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  createdAt: Date;
}

/**
 * Dashboard Types
 */
export interface DashboardData {
  careRecipient: CareRecipient;
  todayLog: CareLog | null;
  completionPercentage: number;
  medicationCompliance: {
    today: number;
    week: number[];
  };
  vitalsTrend: {
    date: string;
    bloodPressure?: string;
    pulseRate?: number;
    oxygenLevel?: number;
    bloodSugar?: number;
  }[];
  activeAlerts: Alert[];
  lastUpdated: Date;
}