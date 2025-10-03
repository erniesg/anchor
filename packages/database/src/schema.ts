import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

/**
 * Users Table (Family Members)
 * All users who have access to view/manage care recipient data
 *
 * Role Hierarchy:
 * - family_admin: Account owner, full permissions
 * - family_member: Co-viewer, read-only access
 */
export const users = sqliteTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  phone: text('phone'),
  role: text('role', { enum: ['family_admin', 'family_member'] }).default('family_admin').notNull(),

  // Account status
  active: integer('active', { mode: 'boolean' }).default(true).notNull(),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }), // Soft delete

  // Notification preferences
  emailNotifications: integer('email_notifications', { mode: 'boolean' }).default(true).notNull(),
  smsNotifications: integer('sms_notifications', { mode: 'boolean' }).default(false).notNull(),

  // Timezone (IANA timezone string, e.g., "Asia/Singapore", "America/New_York")
  timezone: text('timezone').default('Asia/Singapore').notNull(),

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
  familyAdminId: text('family_admin_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(), // The family_admin who owns this care recipient
  name: text('name').notNull(),
  dateOfBirth: integer('date_of_birth', { mode: 'timestamp' }),
  condition: text('condition'), // e.g., "Progressive Supranuclear Palsy"
  location: text('location'),
  emergencyContact: text('emergency_contact'),
  photoUrl: text('photo_url'),

  // Timezone (defaults to family admin's timezone, but can be different if care recipient is in different location)
  timezone: text('timezone').default('Asia/Singapore').notNull(),

  createdAt: integer('created_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date())
    .notNull(),
});

/**
 * Care Recipient Access Table (Junction Table)
 * Tracks which family members have access to which care recipients
 * - family_admin has implicit access (owner)
 * - family_member needs explicit grant via this table
 */
export const careRecipientAccess = sqliteTable('care_recipient_access', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  careRecipientId: text('care_recipient_id')
    .references(() => careRecipients.id, { onDelete: 'cascade' })
    .notNull(),
  userId: text('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  grantedBy: text('granted_by')
    .references(() => users.id, { onDelete: 'set null' }), // Which family_admin granted access
  grantedAt: integer('granted_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date())
    .notNull(),
  revokedAt: integer('revoked_at', { mode: 'timestamp' }), // Soft revoke
});

/**
 * Caregivers Table (FDW/Helpers)
 * Foreign domestic workers providing hands-on care
 *
 * Management:
 * - family_admin can create/edit/deactivate caregivers
 * - family_member can only view caregiver names (read-only)
 */
export const caregivers = sqliteTable('caregivers', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  careRecipientId: text('care_recipient_id')
    .references(() => careRecipients.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  phone: text('phone'),
  email: text('email'), // Optional email for caregiver
  language: text('language').default('en').notNull(),
  pinCode: text('pin_code').notNull(), // 6-digit PIN (hashed)

  // Status tracking
  active: integer('active', { mode: 'boolean' }).default(true).notNull(),
  deactivatedAt: integer('deactivated_at', { mode: 'timestamp' }),
  deactivatedBy: text('deactivated_by').references(() => users.id),
  deactivationReason: text('deactivation_reason'),

  // Audit trail for admin actions
  lastPinResetAt: integer('last_pin_reset_at', { mode: 'timestamp' }),
  lastPinResetBy: text('last_pin_reset_by').references(() => users.id),

  createdAt: integer('created_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date())
    .notNull(),
  createdBy: text('created_by').references(() => users.id), // Which family_admin created this caregiver
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date())
    .notNull(),
});

/**
 * Care Logs Table (Daily Care Records)
 * Comprehensive daily care data logged by caregivers
 *
 * Status Workflow:
 * - draft: Auto-saved progress, editable by caregiver
 * - submitted: Final version, locked (immutable)
 * - invalidated: Flagged by family_admin for correction
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

  // Draft/Submit Status
  status: text('status', { enum: ['draft', 'submitted', 'invalidated'] }).default('draft').notNull(),
  submittedAt: integer('submitted_at', { mode: 'timestamp' }),
  invalidatedAt: integer('invalidated_at', { mode: 'timestamp' }),
  invalidatedBy: text('invalidated_by').references(() => users.id), // family_admin who invalidated
  invalidationReason: text('invalidation_reason'),

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
  careRecipientAccess,
  caregivers,
  careLogs,
  medicationSchedules,
  alerts,
};