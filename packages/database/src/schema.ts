import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

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

  // Authentication
  passwordHash: text('password_hash').notNull(),

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
  gender: text('gender', { enum: ['male', 'female', 'other'] }), // For personalized health ranges
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
  username: text('username').unique(), // Human-readable login ID (e.g., "happy-panda-42")
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

  // Progressive Section Submission
  // Tracks which sections have been "shared" with family for progressive visibility
  // Sections can be re-submitted to update data; final "Submit All" locks the form
  completedSections: text('completed_sections', { mode: 'json' })
    .$type<{
      morning?: { submittedAt: string; submittedBy: string };
      afternoon?: { submittedAt: string; submittedBy: string };
      evening?: { submittedAt: string; submittedBy: string };
      dailySummary?: { submittedAt: string; submittedBy: string };
    }>(),

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
      breakfast?: { time: string; appetite: number; amountEaten: number; swallowingIssues: string[]; assistance?: 'none' | 'some' | 'full' };
      lunch?: { time: string; appetite: number; amountEaten: number; swallowingIssues: string[]; assistance?: 'none' | 'some' | 'full' };
      teaBreak?: { time: string; appetite: number; amountEaten: number; swallowingIssues: string[] };
      dinner?: { time: string; appetite: number; amountEaten: number; swallowingIssues: string[]; assistance?: 'none' | 'some' | 'full' };
      foodPreferences?: string;
      foodRefusals?: string;
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

  // Sprint 2 Day 5: Complete Toileting & Hygiene Tracking
  bowelMovements: text('bowel_movements', { mode: 'json' })
    .$type<{
      frequency: number;
      timesUsedToilet?: number;
      diaperChanges?: number;
      diaperStatus?: 'dry' | 'wet' | 'soiled';
      accidents?: 'none' | 'minor' | 'major';
      assistance?: 'none' | 'partial' | 'full';
      pain?: 'no_pain' | 'some_pain' | 'very_painful';
      consistency?: 'normal' | 'hard' | 'soft' | 'loose' | 'diarrhea';
      concerns?: string;
    }>(),

  urination: text('urination', { mode: 'json' })
    .$type<{
      frequency: number;
      timesUsedToilet?: number;
      diaperChanges?: number;
      diaperStatus?: 'dry' | 'wet' | 'soiled';
      accidents?: 'none' | 'minor' | 'major';
      assistance?: 'none' | 'partial' | 'full';
      pain?: 'no_pain' | 'some_pain' | 'very_painful';
      urineColor?: 'light_clear' | 'yellow' | 'dark_yellow' | 'brown' | 'dark';
      concerns?: string;
    }>(),

  // PSP-Specific Tracking
  balanceScale: integer('balance_scale'), // 1-5 (legacy)
  balanceIssues: integer('balance_issues'), // Sprint 1: 1-5 scale
  walkingPattern: text('walking_pattern', { mode: 'json' })
    .$type<string[]>(), // shuffling, uneven, slow, etc.
  freezingEpisodes: text('freezing_episodes', { enum: ['none', 'mild', 'severe'] }),
  eyeMovementProblems: integer('eye_movement_problems', { mode: 'boolean' }),
  speechCommunicationScale: integer('speech_communication_scale'), // 1-5

  // Sprint 1: Fall Risk Assessment
  nearFalls: text('near_falls', { enum: ['none', 'once_or_twice', 'multiple'] }),
  actualFalls: text('actual_falls', { enum: ['none', 'minor', 'major'] }),

  // Safety & Incidents (Legacy)
  falls: text('falls', { mode: 'json' })
    .$type<{
      occurred: boolean;
      type: 'none' | 'near_fall' | 'actual_fall';
      details?: string;
      injuries?: string;
    }>(),
  emergencyFlag: integer('emergency_flag', { mode: 'boolean' }).default(false).notNull(),
  emergencyNote: text('emergency_note'),

  // Sprint 2: Sleep Tracking
  afternoonRest: text('afternoon_rest', { mode: 'json' })
    .$type<{
      startTime: string;
      endTime: string;
      quality: 'deep' | 'light' | 'restless' | 'no_sleep';
      notes?: string;
    }>(),
  nightSleep: text('night_sleep', { mode: 'json' })
    .$type<{
      bedtime: string;
      quality: 'deep' | 'light' | 'restless' | 'no_sleep';
      wakings: number;
      wakingReasons: string[]; // toilet, pain, confusion, dreams, unknown
      behaviors: string[]; // quiet, snoring, talking, mumbling, restless, dreaming, nightmares
      notes?: string;
    }>(),

  // Sprint 1: Unaccompanied Time Tracking
  unaccompaniedPeriods: text('unaccompanied_periods', { mode: 'json' })
    .$type<Array<{
      from: string;
      to: string;
      reason: string;
      replacementPerson?: string;
      duration: number;
    }>>(),
  unaccompaniedTime: text('unaccompanied_time', { mode: 'json' })
    .$type<Array<{
      startTime: string;
      endTime: string;
      reason: string;
      replacementPerson: string;
      duration: number;
      incidents?: string;
    }>>(),
  totalUnaccompaniedMinutes: integer('total_unaccompanied_minutes').default(0),
  unaccompaniedIncidents: text('unaccompanied_incidents'),

  // Sprint 1: Safety Checks & Emergency Prep
  safetyChecks: text('safety_checks', { mode: 'json' })
    .$type<{
      tripHazards?: { checked: boolean; action: string };
      cables?: { checked: boolean; action: string };
      sandals?: { checked: boolean; action: string };
      slipHazards?: { checked: boolean; action: string };
      mobilityAids?: { checked: boolean; action: string };
      emergencyEquipment?: { checked: boolean; action: string };
    }>(),
  emergencyPrep: text('emergency_prep', { mode: 'json' })
    .$type<{
      icePack?: boolean;
      wheelchair?: boolean;
      commode?: boolean;
      walkingStick?: boolean;
      walker?: boolean;
      bruiseOintment?: boolean;
      antiseptic?: boolean;
    }>(),

  // Environment & Safety - Room Maintenance (Template page 13)
  roomMaintenance: text('room_maintenance', { mode: 'json' })
    .$type<{
      cleaningStatus?: 'completed_by_maid' | 'caregiver_assisted' | 'not_done';
      roomComfort?: 'good_temperature' | 'too_hot' | 'too_cold';
    }>(),

  // Environment & Safety - Personal Items Check (Template page 14)
  personalItemsCheck: text('personal_items_check', { mode: 'json' })
    .$type<{
      spectaclesCleaned?: { checked: boolean; status: 'clean' | 'need_cleaning' };
      jewelryAccountedFor?: { checked: boolean; status: 'all_present' | 'missing_item'; notes?: string };
      handbagOrganized?: { checked: boolean; status: 'organized' | 'need_organizing' };
    }>(),

  // Environment & Safety - Hospital Bag Status (Template page 14)
  hospitalBagStatus: text('hospital_bag_status', { mode: 'json' })
    .$type<{
      bagReady?: boolean;
      location?: string;
      lastChecked?: boolean;
      notes?: string;
    }>(),

  // Sprint 3 Day 1: Spiritual & Emotional Well-Being (Template page 12)
  spiritualEmotional: text('spiritual_emotional', { mode: 'json' })
    .$type<{
      prayerTime?: { start: string; end: string }; // Time range (HH:MM format)
      prayerExpression?: 'speaking_out_loud' | 'whispering' | 'mumbling' | 'silent_worship';
      overallMood?: number; // 1-5 scale
      communicationScale?: number; // 1-5 scale
      socialInteraction?: 'engaged' | 'responsive' | 'withdrawn' | 'aggressive_hostile';
    }>(),

  // Sprint 3 Day 2: Physical Activity & Exercise
  physicalActivity: text('physical_activity', { mode: 'json' })
    .$type<{
      exerciseDuration?: number;
      exerciseType?: string[];
      walkingDistance?: string;
      assistanceLevel?: 'none' | 'minimal' | 'moderate' | 'full';
      painDuringActivity?: 'none' | 'mild' | 'moderate' | 'severe';
      energyAfterActivity?: 'energized' | 'tired' | 'exhausted' | 'same';
      participationWillingness?: 'enthusiastic' | 'willing' | 'reluctant' | 'refused';
      equipmentUsed?: string[];
      mobilityNotes?: string;
    }>(),

  // Sprint 3 Day 3: Oral Care & Hygiene
  oralCare: text('oral_care', { mode: 'json' })
    .$type<{
      teethBrushed?: boolean;
      timesBrushed?: number;
      denturesCleaned?: boolean;
      mouthRinsed?: boolean;
      assistanceLevel?: 'none' | 'minimal' | 'moderate' | 'full';
      oralHealthIssues?: string[];
      painOrBleeding?: boolean;
      notes?: string;
    }>(),

  // Sprint 3 Day 4: Detailed Exercise Sessions
  morningExerciseSession: text('morning_exercise_session', { mode: 'json' })
    .$type<{
      startTime: string;
      endTime: string;
      exercises?: Array<{
        type: string;
        done: boolean;
        duration: number;
        participation: number;
      }>;
      notes?: string;
    }>(),
  afternoonExerciseSession: text('afternoon_exercise_session', { mode: 'json' })
    .$type<{
      startTime: string;
      endTime: string;
      exercises?: Array<{
        type: string;
        done: boolean;
        duration: number;
        participation: number;
      }>;
      notes?: string;
    }>(),
  movementDifficulties: text('movement_difficulties', { mode: 'json' })
    .$type<{
      gettingOutOfBed?: { level: string; notes?: string };
      gettingIntoBed?: { level: string; notes?: string };
      sittingInChair?: { level: string; notes?: string };
      gettingUpFromChair?: { level: string; notes?: string };
      gettingInCar?: { level: string; notes?: string };
      gettingOutOfCar?: { level: string; notes?: string };
    }>(),

  // Sprint 3 Day 5: Special Concerns & Incidents
  specialConcerns: text('special_concerns', { mode: 'json' })
    .$type<{
      priorityLevel?: 'emergency' | 'urgent' | 'routine';
      behaviouralChanges?: string[];
      physicalChanges?: string;
      incidentDescription?: string;
      actionsTaken?: string;
      notes?: string;
    }>(),

  // Sprint 3 Day 3: Caregiver Notes (structured daily summary)
  caregiverNotes: text('caregiver_notes', { mode: 'json' })
    .$type<{
      whatWentWell?: string;
      challengesFaced?: string;
      recommendationsForTomorrow?: string;
      importantInfoForFamily?: string;
      caregiverSignature?: string;
    }>(),

  // Sprint 3 Day 4: Activities & Social Interaction
  activities: text('activities', { mode: 'json' })
    .$type<{
      phoneActivities?: ('youtube' | 'texting' | 'calls' | 'none')[];
      engagementLevel?: number; // 1-5 scale
      otherActivities?: ('phone' | 'conversation' | 'prayer' | 'reading' | 'watching_tv' | 'listening_music' | 'games' | 'none')[];
      relaxationPeriods?: Array<{
        startTime: string;
        endTime: string;
        activity: 'resting' | 'sleeping' | 'watching_tv' | 'listening_music' | 'quiet_time';
        mood: 'happy' | 'calm' | 'restless' | 'bored' | 'engaged';
      }>;
    }>(),

  // Notes (legacy - simple text notes)
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
 * Pack Lists Table (Hospital Bag / Emergency Bag)
 * One-time setup list that tracks items needed for emergency hospital visits
 * - Created once per care recipient
 * - Can be updated by family admin or caregivers as needed
 * - Separate from daily tracking
 */
export const packLists = sqliteTable('pack_lists', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  careRecipientId: text('care_recipient_id')
    .references(() => careRecipients.id, { onDelete: 'cascade' })
    .notNull()
    .unique(), // One pack list per care recipient

  // Pack list items stored as JSON array
  items: text('items', { mode: 'json' }).$type<Array<{
    id: string;
    name: string;
    packed: boolean;
    category: 'documents' | 'medications' | 'clothing' | 'toiletries' | 'medical_equipment' | 'other';
    priority: 'essential' | 'important' | 'optional';
    notes?: string;
    quantity?: string; // e.g., "2", "1 week supply"
  }>>().default([]).notNull(),

  // Tracking
  lastVerifiedAt: integer('last_verified_at', { mode: 'timestamp' }),
  lastVerifiedBy: text('last_verified_by').references(() => users.id),

  createdAt: integer('created_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date())
    .notNull(),
  createdBy: text('created_by').references(() => users.id),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date())
    .notNull(),
  updatedBy: text('updated_by').references(() => users.id),
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
 * Care Log Audit Table
 * Tracks all changes made to care logs for audit trail and family visibility
 */
export const careLogAudit = sqliteTable('care_log_audit', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  careLogId: text('care_log_id')
    .references(() => careLogs.id, { onDelete: 'cascade' })
    .notNull(),

  // Who made the change
  changedBy: text('changed_by').notNull(), // caregiver_id
  changedByName: text('changed_by_name'), // Denormalized for history

  // What changed
  action: text('action', {
    enum: ['create', 'update', 'submit', 'submit_section'],
  }).notNull(),
  sectionSubmitted: text('section_submitted'), // For submit_section: 'morning', 'afternoon', 'evening', 'dailySummary'

  // Change details (JSON)
  changes: text('changes', { mode: 'json' }).$type<Record<string, { old: unknown; new: unknown }>>(),

  // Full snapshot of the care log at this point
  snapshot: text('snapshot', { mode: 'json' }).$type<Record<string, unknown>>(),

  createdAt: integer('created_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date())
    .notNull(),
});

/**
 * Care Log Views Table
 * Tracks when family members last viewed each care log
 * Used to show "new changes" badges
 */
export const careLogViews = sqliteTable('care_log_views', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  careLogId: text('care_log_id')
    .references(() => careLogs.id, { onDelete: 'cascade' })
    .notNull(),
  userId: text('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),

  viewedAt: integer('viewed_at', { mode: 'timestamp' })
    .$defaultFn(() => new Date())
    .notNull(),
});

/**
 * Password Reset Tokens Table
 * Time-limited tokens for family members to reset their password
 */
export const passwordResetTokens = sqliteTable('password_reset_tokens', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  token: text('token').notNull().unique(), // Secure random token
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  usedAt: integer('used_at', { mode: 'timestamp' }), // Null until used

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
  packLists,
  alerts,
  careLogAudit,
  careLogViews,
  passwordResetTokens,
};