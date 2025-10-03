import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

/**
 * Users Table (Family Members)
 * Primary caregivers who manage the care of their loved ones
 */
export const users = sqliteTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  phone: text('phone'),
  role: text('role', { enum: ['family', 'admin'] }).default('family').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date())
    .notNull(),
});

/**
 * Care Recipients Table (Elderly Individuals)
 * The loved ones receiving care
 */
export const careRecipients = sqliteTable('care_recipients', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  familyId: text('family_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  dateOfBirth: integer('date_of_birth', { mode: 'timestamp' }),
  condition: text('condition'), // e.g., "Progressive Supranuclear Palsy"
  location: text('location'),
  emergencyContact: text('emergency_contact'),
  photoUrl: text('photo_url'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date())
    .notNull(),
});

/**
 * Caregivers Table (FDW/Helpers)
 * Foreign domestic workers providing hands-on care
 */
export const caregivers = sqliteTable('caregivers', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  careRecipientId: text('care_recipient_id')
    .references(() => careRecipients.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  phone: text('phone'),
  language: text('language').default('en').notNull(),
  pinCode: text('pin_code').notNull(), // 6-digit PIN (hashed)
  active: integer('active', { mode: 'boolean' }).default(true).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date())
    .notNull(),
});

/**
 * Care Logs Table (Daily Care Records)
 * Comprehensive daily care data logged by caregivers
 */
export const careLogs = sqliteTable('care_logs', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  careRecipientId: text('care_recipient_id')
    .references(() => careRecipients.id, { onDelete: 'cascade' })
    .notNull(),
  caregiverId: text('caregiver_id')
    .references(() => caregivers.id, { onDelete: 'set null' }),
  logDate: integer('log_date', { mode: 'timestamp' }).notNull(),
  timePeriod: text('time_period', { enum: ['morning', 'afternoon', 'evening', 'night'] }),

  // Morning Routine
  wakeTime: text('wake_time'), // HH:MM format
  mood: text('mood', { enum: ['alert', 'confused', 'sleepy', 'agitated', 'calm'] }),
  showerTime: text('shower_time'),
  hairWash: integer('hair_wash', { mode: 'boolean' }),

  // Medications (JSON array)
  medications: text('medications', { mode: 'json' })
    .$type<Array<{
      name: string;
      given: boolean;
      time: string | null;
      timeSlot: 'before_breakfast' | 'after_breakfast' | 'afternoon' | 'after_dinner' | 'before_bedtime';
    }>>(),

  // Meals & Nutrition (JSON object)
  meals: text('meals', { mode: 'json' })
    .$type<{
      breakfast?: { time: string; appetite: number; amountEaten: number; swallowingIssues: string[] };
      lunch?: { time: string; appetite: number; amountEaten: number; swallowingIssues: string[] };
      dinner?: { time: string; appetite: number; amountEaten: number; swallowingIssues: string[] };
    }>(),

  // Fluids (JSON array)
  fluids: text('fluids', { mode: 'json' })
    .$type<Array<{
      name: string;
      time: string;
      amountMl: number;
      swallowingIssues: string[];
    }>>(),
  totalFluidIntake: integer('total_fluid_intake'), // ml

  // Vital Signs
  bloodPressure: text('blood_pressure'), // e.g., "120/80"
  pulseRate: integer('pulse_rate'),
  oxygenLevel: integer('oxygen_level'), // SpO2 percentage
  bloodSugar: real('blood_sugar'),
  vitalsTime: text('vitals_time'),

  // Mobility & Exercise
  mobility: text('mobility', { mode: 'json' })
    .$type<{
      steps?: number;
      distance?: number;
      walkingAssistance?: string;
      exercises?: Array<{ type: string; duration: number; participation: number }>;
    }>(),

  // Toileting
  toileting: text('toileting', { mode: 'json' })
    .$type<{
      bowelFrequency: number;
      urineFrequency: number;
      diaperChanges: number;
      accidents: string;
      assistance: string;
      pain: string;
      urineColor?: string;
      bowelConsistency?: string;
    }>(),

  // PSP-Specific Tracking
  balanceScale: integer('balance_scale'), // 1-5
  walkingPattern: text('walking_pattern', { mode: 'json' })
    .$type<string[]>(), // shuffling, uneven, slow, etc.
  freezingEpisodes: text('freezing_episodes', { enum: ['none', 'mild', 'severe'] }),
  eyeMovementProblems: integer('eye_movement_problems', { mode: 'boolean' }),
  speechCommunicationScale: integer('speech_communication_scale'), // 1-5

  // Safety & Incidents
  falls: text('falls', { mode: 'json' })
    .$type<{
      occurred: boolean;
      type: 'none' | 'near_fall' | 'actual_fall';
      details?: string;
      injuries?: string;
    }>(),
  emergencyFlag: integer('emergency_flag', { mode: 'boolean' }).default(false).notNull(),
  emergencyNote: text('emergency_note'),

  // Unaccompanied Time Tracking
  unaccompaniedPeriods: text('unaccompanied_periods', { mode: 'json' })
    .$type<Array<{
      from: string;
      to: string;
      reason: string;
      replacementPerson?: string;
      duration: number;
    }>>(),
  totalUnaccompaniedMinutes: integer('total_unaccompanied_minutes').default(0),

  // Notes
  notes: text('notes'),

  createdAt: integer('created_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date())
    .notNull(),
});

/**
 * Medication Schedules Table
 * Pre-defined medication schedules for each care recipient
 */
export const medicationSchedules = sqliteTable('medication_schedules', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  careRecipientId: text('care_recipient_id')
    .references(() => careRecipients.id, { onDelete: 'cascade' })
    .notNull(),
  medicationName: text('medication_name').notNull(),
  dosage: text('dosage').notNull(),
  purpose: text('purpose'),
  frequency: text('frequency').notNull(), // daily, MWF, etc.
  timeSlot: text('time_slot', {
    enum: ['before_breakfast', 'after_breakfast', 'afternoon', 'after_dinner', 'before_bedtime'],
  }).notNull(),
  timeSlots: text('time_slots', { mode: 'json' }).$type<string[]>(), // ["08:00", "20:00"]
  dayRestriction: text('day_restriction'), // e.g., "MWF" for Mon/Wed/Fri only
  active: integer('active', { mode: 'boolean' }).default(true).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date())
    .notNull(),
});

/**
 * Alerts Table
 * System-generated and manual alerts for family members
 */
export const alerts = sqliteTable('alerts', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  careRecipientId: text('care_recipient_id')
    .references(() => careRecipients.id, { onDelete: 'cascade' })
    .notNull(),
  alertType: text('alert_type', {
    enum: ['emergency', 'fall', 'missed_medication', 'vitals_anomaly', 'trend_warning'],
  }).notNull(),
  severity: text('severity', { enum: ['low', 'medium', 'high', 'critical'] }).notNull(),
  message: text('message').notNull(),
  acknowledged: integer('acknowledged', { mode: 'boolean' }).default(false).notNull(),
  acknowledgedAt: integer('acknowledged_at', { mode: 'timestamp' }),
  acknowledgedBy: text('acknowledged_by').references(() => users.id),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date())
    .notNull(),
});

/**
 * Export all tables for Drizzle ORM
 */
export const schema = {
  users,
  careRecipients,
  caregivers,
  careLogs,
  medicationSchedules,
  alerts,
};