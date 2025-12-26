import { Hono } from 'hono';
import { z } from 'zod';
import type { AppContext } from '../index';
import { careLogs, caregivers, careLogAudit, careLogViews } from '@anchor/database/schema';
import { createDbClient } from '@anchor/database';
import { eq, desc, and, or, isNotNull, gt, sql } from 'drizzle-orm';
import { caregiverOnly, familyAdminOnly, familyMemberAccess } from '../middleware/rbac';
import { requireCareLogOwnership, requireLogInvalidation, requireCareRecipientAccess } from '../middleware/permissions';
import { caregiverHasAccess, canAccessCareRecipient } from '../lib/access-control';

const careLogsRoute = new Hono<AppContext>();

// Validation schemas
// Sprint 2 Day 4: Enhanced medication schema with purpose and notes
const medicationLogSchema = z.object({
  name: z.string(),
  given: z.boolean(),
  time: z.string().nullable(),
  timeSlot: z.enum(['before_breakfast', 'after_breakfast', 'afternoon', 'after_dinner', 'before_bedtime']),
  purpose: z.string().optional(), // NEW: Why the medication is prescribed
  notes: z.string().optional(),   // NEW: Per-medication notes
});

const mealLogSchema = z.object({
  time: z.string(),
  appetite: z.number().min(1).max(5),
  amountEaten: z.number().min(0).max(100),
  swallowingIssues: z.array(z.string()).optional(),
});

// Sprint 2 Day 1: Fluid Intake schema
const fluidEntrySchema = z.object({
  name: z.string().min(1, 'Fluid name is required'),
  time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:MM)'),
  amountMl: z.number().int().positive('Amount must be positive'),
  swallowingIssues: z.array(z.string()).optional().default([]),
});

// Sprint 2 Day 3: Sleep Tracking schemas
const afternoonRestSchema = z.object({
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:MM)'),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:MM)'),
  quality: z.enum(['deep', 'light', 'restless', 'no_sleep'], {
    errorMap: () => ({ message: 'Quality must be one of: deep, light, restless, no_sleep' }),
  }),
  notes: z.string().optional(),
}).refine((data) => {
  // Validate start < end
  const [startHour = 0, startMin = 0] = data.startTime.split(':').map(Number);
  const [endHour = 0, endMin = 0] = data.endTime.split(':').map(Number);
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  return startMinutes < endMinutes;
}, {
  message: 'Start time must be before end time',
  path: ['startTime'],
});

const nightSleepSchema = z.object({
  bedtime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:MM)'),
  quality: z.enum(['deep', 'light', 'restless', 'no_sleep'], {
    errorMap: () => ({ message: 'Quality must be one of: deep, light, restless, no_sleep' }),
  }),
  wakings: z.number().int().nonnegative({ message: 'Wakings must be non-negative' }),
  wakingReasons: z.array(z.string()).default([]), // toilet, pain, confusion, dreams, unknown
  behaviors: z.array(z.string()).default([]), // quiet, snoring, talking, mumbling, restless, dreaming, nightmares
  notes: z.string().optional(),
});

// Sprint 1 Day 2: Unaccompanied Time schema
const unaccompaniedTimePeriodSchema = z.object({
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:MM)'),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:MM)'),
  reason: z.string().min(1, 'Reason is required'),
  replacementPerson: z.string().optional(),
  durationMinutes: z.number().int().positive('Duration must be positive'),
  notes: z.string().optional(),
}).refine((data) => {
  // Validate start < end
  const [startHour = 0, startMin = 0] = data.startTime.split(':').map(Number);
  const [endHour = 0, endMin = 0] = data.endTime.split(':').map(Number);
  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  return startMinutes < endMinutes;
}, {
  message: 'Start time must be before end time',
  path: ['startTime'],
});

// Sprint 1: Safety Checks schema
const safetyChecksSchema = z.object({
  tripHazards: z.object({ checked: z.boolean(), action: z.string() }).optional(),
  cables: z.object({ checked: z.boolean(), action: z.string() }).optional(),
  sandals: z.object({ checked: z.boolean(), action: z.string() }).optional(),
  slipHazards: z.object({ checked: z.boolean(), action: z.string() }).optional(),
  mobilityAids: z.object({ checked: z.boolean(), action: z.string() }).optional(),
  emergencyEquipment: z.object({ checked: z.boolean(), action: z.string() }).optional(),
});

// Sprint 1: Emergency Prep schema
const emergencyPrepSchema = z.object({
  icePack: z.boolean().optional(),
  wheelchair: z.boolean().optional(),
  commode: z.boolean().optional(),
  walkingStick: z.boolean().optional(),
  walker: z.boolean().optional(),
  bruiseOintment: z.boolean().optional(),
  antiseptic: z.boolean().optional(),
});

const createCareLogSchema = z.object({
  careRecipientId: z.string().uuid(),
  caregiverId: z.string().uuid().optional(), // Optional, will use auth context if not provided
  logDate: z.string(), // ISO date string

  // Morning Routine
  wakeTime: z.string().optional(),
  mood: z.enum(['alert', 'confused', 'sleepy', 'agitated', 'calm']).optional(),
  showerTime: z.string().optional(),
  hairWash: z.boolean().optional(),

  // Medications
  medications: z.array(medicationLogSchema).optional(),

  // Meals (breakfast, lunch, tea break, dinner + food notes)
  meals: z.object({
    breakfast: mealLogSchema.optional(),
    lunch: mealLogSchema.optional(),
    teaBreak: mealLogSchema.optional(),
    dinner: mealLogSchema.optional(),
    foodPreferences: z.string().optional(),
    foodRefusals: z.string().optional(),
  }).optional(),

  // Sprint 2 Day 1: Fluid Intake
  fluids: z.array(fluidEntrySchema).optional().default([]),
  totalFluidIntake: z.number().int().nonnegative().optional(),

  // Sprint 2 Day 3: Sleep Tracking
  afternoonRest: afternoonRestSchema.nullish(),
  nightSleep: nightSleepSchema.nullish(),

  // Vitals
  bloodPressure: z.string().optional(),
  pulseRate: z.number().optional(),
  oxygenLevel: z.number().min(0).max(100).optional(),
  bloodSugar: z.number().optional(),
  vitalsTime: z.string().optional(),

  // Toileting
  // Sprint 2 Day 5: Complete Toileting & Hygiene Tracking
  bowelMovements: z.object({
    frequency: z.number().int().min(0),
    timesUsedToilet: z.number().int().min(0).optional(),
    diaperChanges: z.number().int().min(0).optional(),
    diaperStatus: z.enum(['dry', 'wet', 'soiled']).optional(),
    accidents: z.enum(['none', 'minor', 'major']).optional(),
    assistance: z.enum(['none', 'partial', 'full']).optional(),
    pain: z.enum(['no_pain', 'some_pain', 'very_painful']).optional(),
    consistency: z.enum(['normal', 'hard', 'soft', 'loose', 'diarrhea']).optional(),
    concerns: z.string().optional(),
  }).optional(),

  urination: z.object({
    frequency: z.number().int().min(0),
    timesUsedToilet: z.number().int().min(0).optional(),
    diaperChanges: z.number().int().min(0).optional(),
    diaperStatus: z.enum(['dry', 'wet', 'soiled']).optional(),
    accidents: z.enum(['none', 'minor', 'major']).optional(),
    assistance: z.enum(['none', 'partial', 'full']).optional(),
    pain: z.enum(['no_pain', 'some_pain', 'very_painful']).optional(),
    urineColor: z.enum(['light_clear', 'yellow', 'dark_yellow', 'brown', 'dark']).optional(),
    concerns: z.string().optional(),
  }).optional(),

  // Sprint 1: Fall Risk Assessment
  balanceIssues: z.number().min(1).max(5).optional(),
  nearFalls: z.enum(['none', 'once_or_twice', 'multiple']).optional(),
  actualFalls: z.enum(['none', 'minor', 'major']).optional(),
  walkingPattern: z.array(z.string()).optional(), // ['shuffling', 'uneven', 'slow', 'stumbling', 'cannot_lift_feet']
  freezingEpisodes: z.enum(['none', 'mild', 'severe']).optional(),

  // Sprint 1 Day 2: Unaccompanied Time
  unaccompaniedTime: z.array(unaccompaniedTimePeriodSchema).optional(),
  unaccompaniedIncidents: z.string().optional(),

  // Sprint 1: Safety & Emergency Prep
  safetyChecks: safetyChecksSchema.optional(),
  emergencyPrep: emergencyPrepSchema.optional(),

  // Safety
  emergencyFlag: z.boolean().default(false),
  emergencyNote: z.string().optional(),

  // Sprint 3 Day 1: Spiritual & Emotional Well-Being (Template page 12)
  spiritualEmotional: z.object({
    prayerTime: z.object({
      start: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:MM)'),
      end: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:MM)'),
    }).optional(),
    prayerExpression: z.enum(['speaking_out_loud', 'whispering', 'mumbling', 'silent_worship']).optional(),
    overallMood: z.number().int().min(1).max(5).optional(),
    communicationScale: z.number().int().min(1).max(5).optional(),
    socialInteraction: z.enum(['engaged', 'responsive', 'withdrawn', 'aggressive_hostile']).optional(),
  }).optional(),

  // Sprint 3 Day 4: Detailed Exercise Sessions (Template pages 5-6)
  // Exercise type schema for individual exercises
  exerciseSchema: z.object({
    type: z.enum([
      'Eye Exercises',
      'Arm/Shoulder Strengthening',
      'Leg Strengthening',
      'Balance Training',
      'Stretching',
      'Arm Pedalling',
      'Leg Pedalling',
      'Physiotherapist Exercises'
    ]),
    done: z.boolean(),
    duration: z.number().int().min(0).max(120), // Minutes, max 2 hours per exercise
    participation: z.number().int().min(0).max(5), // 0 = not done, 1-5 scale
  }).optional(),

  // Morning exercise session
  morningExerciseSession: z.object({
    startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:MM)'),
    endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:MM)'),
    exercises: z.array(z.object({
      type: z.enum([
        'Eye Exercises',
        'Arm/Shoulder Strengthening',
        'Leg Strengthening',
        'Balance Training',
        'Stretching',
        'Arm Pedalling',
        'Leg Pedalling',
        'Physiotherapist Exercises'
      ]),
      done: z.boolean(),
      duration: z.number().int().min(0).max(120),
      participation: z.number().int().min(0).max(5),
    })).optional(),
    notes: z.string().optional(),
  }).optional(),

  // Afternoon exercise session
  afternoonExerciseSession: z.object({
    startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:MM)'),
    endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:MM)'),
    exercises: z.array(z.object({
      type: z.enum([
        'Eye Exercises',
        'Arm/Shoulder Strengthening',
        'Leg Strengthening',
        'Balance Training',
        'Stretching',
        'Arm Pedalling',
        'Leg Pedalling',
        'Physiotherapist Exercises'
      ]),
      done: z.boolean(),
      duration: z.number().int().min(0).max(120),
      participation: z.number().int().min(0).max(5),
    })).optional(),
    notes: z.string().optional(),
  }).optional(),

  // Movement difficulties assessment (Template page 5)
  movementDifficulties: z.object({
    gettingOutOfBed: z.object({
      level: z.enum(['canDoAlone', 'needsSomeHelp', 'needsFullHelp', 'fallsDropsHard']),
      notes: z.string().optional(),
    }).optional(),
    gettingIntoBed: z.object({
      level: z.enum(['canDoAlone', 'needsSomeHelp', 'needsFullHelp', 'fallsDropsHard']),
      notes: z.string().optional(),
    }).optional(),
    sittingInChair: z.object({
      level: z.enum(['canDoAlone', 'needsSomeHelp', 'needsFullHelp', 'fallsDropsHard']),
      notes: z.string().optional(),
    }).optional(),
    gettingUpFromChair: z.object({
      level: z.enum(['canDoAlone', 'needsSomeHelp', 'needsFullHelp', 'fallsDropsHard']),
      notes: z.string().optional(),
    }).optional(),
    gettingInCar: z.object({
      level: z.enum(['canDoAlone', 'needsSomeHelp', 'needsFullHelp', 'fallsDropsHard']),
      notes: z.string().optional(),
    }).optional(),
    gettingOutOfCar: z.object({
      level: z.enum(['canDoAlone', 'needsSomeHelp', 'needsFullHelp', 'fallsDropsHard']),
      notes: z.string().optional(),
    }).optional(),
  }).optional(),

  // Keep simplified physical activity for backward compatibility
  physicalActivity: z.object({
    exerciseDuration: z.number().int().nonnegative().optional(), // Total minutes
    exerciseType: z.array(z.enum(['walking', 'stretching', 'chair_exercises', 'outdoor_activity', 'physical_therapy'])).optional(),
    walkingDistance: z.string().optional(), // e.g., "around house", "to mailbox", "2 blocks"
    assistanceLevel: z.enum(['none', 'minimal', 'moderate', 'full']).optional(),
    painDuringActivity: z.enum(['none', 'mild', 'moderate', 'severe']).optional(),
    energyAfterActivity: z.enum(['energized', 'tired', 'exhausted', 'same']).optional(),
    participationWillingness: z.enum(['enthusiastic', 'willing', 'reluctant', 'refused']).optional(),
    equipmentUsed: z.array(z.enum(['walker', 'cane', 'wheelchair', 'none'])).optional(),
    mobilityNotes: z.string().optional(),
  }).optional(),

  // Sprint 3 Day 3: Oral Care & Hygiene (Template page 10)
  oralCare: z.object({
    teethBrushed: z.boolean().optional(),
    timesBrushed: z.number().int().nonnegative().optional(),
    denturesCleaned: z.boolean().optional(),
    mouthRinsed: z.boolean().optional(),
    assistanceLevel: z.enum(['none', 'minimal', 'moderate', 'full']).optional(),
    oralHealthIssues: z.array(z.enum(['bleeding_gums', 'dry_mouth', 'sores', 'pain', 'bad_breath', 'none'])).optional(),
    painOrBleeding: z.boolean().optional(),
    notes: z.string().optional(),
  }).optional(),

  // Sprint 3 Day 5: Special Concerns & Incidents (Template page 13)
  specialConcerns: z.object({
    priorityLevel: z.enum(['emergency', 'urgent', 'routine']).optional(),
    behaviouralChanges: z.array(z.enum([
      'increased_agitation',
      'increased_confusion',
      'increased_anxiety',
      'withdrawal',
      'aggression',
      'sleep_disturbance',
      'appetite_change',
      'hallucinations',
      'delusions',
      'repetitive_behaviors',
      'wandering',
      'sundowning',
      'mood_swings'
    ])).optional(),
    physicalChanges: z.string().optional(), // Free text for physical symptoms
    incidentDescription: z.string().optional(), // Detailed incident description
    actionsTaken: z.string().optional(), // What was done in response
    notes: z.string().optional(), // Additional notes
  }).optional(),

  // Sprint 3 Day 3: Caregiver Notes (structured daily summary)
  caregiverNotes: z.object({
    whatWentWell: z.string().max(1000).optional(),
    challengesFaced: z.string().max(1000).optional(),
    recommendationsForTomorrow: z.string().max(1000).optional(),
    importantInfoForFamily: z.string().max(1000).optional(),
    caregiverSignature: z.string().max(200).optional(),
  }).optional(),

  // Sprint 3 Day 4: Activities & Social Interaction
  activities: z.object({
    phoneActivities: z.array(z.enum(['youtube', 'texting', 'calls', 'none'])).optional(),
    engagementLevel: z.number().int().min(1).max(5).optional(),
    otherActivities: z.array(z.enum(['phone', 'conversation', 'prayer', 'reading', 'watching_tv', 'listening_music', 'games', 'none'])).optional(),
    relaxationPeriods: z.array(z.object({
      startTime: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
      endTime: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
      activity: z.enum(['resting', 'sleeping', 'watching_tv', 'listening_music', 'quiet_time']).optional(),
      mood: z.enum(['happy', 'calm', 'restless', 'bored', 'engaged']).optional(),
    })).optional(),
  }).optional(),

  // Environment & Safety - Room Maintenance (Template page 13)
  roomMaintenance: z.object({
    cleaningStatus: z.enum(['completed_by_maid', 'caregiver_assisted', 'not_done']).optional(),
    roomComfort: z.enum(['good_temperature', 'too_hot', 'too_cold']).optional(),
  }).optional(),

  // Environment & Safety - Personal Items Check (Template page 14)
  personalItemsCheck: z.object({
    spectaclesCleaned: z.object({
      checked: z.boolean(),
      status: z.enum(['clean', 'need_cleaning']).optional(),
    }).optional(),
    jewelryAccountedFor: z.object({
      checked: z.boolean(),
      status: z.enum(['all_present', 'missing_item']).optional(),
      notes: z.string().optional(),
    }).optional(),
    handbagOrganized: z.object({
      checked: z.boolean(),
      status: z.enum(['organized', 'need_organizing']).optional(),
    }).optional(),
  }).optional(),

  // Environment & Safety - Hospital Bag Status (Template page 14)
  hospitalBagStatus: z.object({
    bagReady: z.boolean().optional(),
    location: z.string().optional(),
    lastChecked: z.boolean().optional(),
    notes: z.string().optional(),
  }).optional(),

  // Notes
  notes: z.string().optional(),
});

// Sprint 2 Day 1: Helper function to calculate total fluid intake
function calculateTotalFluidIntake(fluids: unknown): number {
  if (!fluids || !Array.isArray(fluids) || fluids.length === 0) return 0;
  return fluids.reduce((total: number, fluid: Record<string, unknown>) => {
    const amount = typeof fluid.amountMl === 'number' ? fluid.amountMl : 0;
    return total + amount;
  }, 0);
}

// Helper function to calculate total unaccompanied time
function calculateTotalUnaccompaniedTime(periods: unknown): number {
  if (!periods || !Array.isArray(periods) || periods.length === 0) return 0;
  return periods.reduce((total: number, period: Record<string, unknown>) => {
    const duration = typeof period.durationMinutes === 'number' ? period.durationMinutes :
                    typeof period.duration === 'number' ? period.duration : 0;
    return total + duration;
  }, 0);
}

// Sprint 2 Day 4: Helper function to calculate medication adherence
function calculateMedicationAdherence(medications: unknown): {
  total: number;
  given: number;
  missed: number;
  percentage: number;
} {
  if (!medications || !Array.isArray(medications) || medications.length === 0) {
    return { total: 0, given: 0, missed: 0, percentage: 0 };
  }

  const total = medications.length;
  const given = medications.filter((med: Record<string, unknown>) => med.given === true).length;
  const missed = total - given;
  const percentage = total > 0 ? Math.round((given / total) * 100) : 0;

  return { total, given, missed, percentage };
}

// Sprint 3 Day 5: Helper function to check for high-priority concerns
function checkHighPriorityConcerns(specialConcerns: { priorityLevel?: string } | null | undefined): boolean {
  if (!specialConcerns) return false;
  return specialConcerns.priorityLevel === 'emergency';
}

// Helper function to safely parse JSON (handles double-stringified data)
function safeJsonParse(value: unknown): unknown {
  if (!value) return null;
  // If already an object (drizzle with mode: 'json' auto-parses), return as-is
  if (typeof value === 'object' && value !== null) return value;
  // If string, try to parse
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      // If the result is still a string, try parsing again (double-stringified)
      if (typeof parsed === 'string') {
        return JSON.parse(parsed);
      }
      return parsed;
    } catch (error) {
      console.error('JSON parse error:', error, 'value:', value);
      return null;
    }
  }
  return value;
}

// Progressive Section Submission Types (defined here for use in helper functions)
type SectionName = 'morning' | 'afternoon' | 'evening' | 'dailySummary';
type SectionSubmission = { submittedAt: string; submittedBy: string };
type CompletedSections = Partial<Record<SectionName, SectionSubmission>>;

// Section to field mapping for progressive section submission
// Defines which fields belong to which section for visibility filtering
const SECTION_FIELDS: Record<string, string[]> = {
  morning: [
    'wakeTime', 'mood', 'showerTime', 'hairWash',
    'morningExerciseSession', 'vitalsTime', 'bloodPressure', 'pulseRate', 'oxygenLevel', 'bloodSugar',
  ],
  afternoon: [
    'afternoonRest', 'afternoonExerciseSession', 'physicalActivity',
  ],
  evening: [
    'nightSleep',
  ],
  dailySummary: [
    'bowelMovements', 'urination', 'balanceIssues', 'nearFalls', 'actualFalls',
    'walkingPattern', 'freezingEpisodes', 'unaccompaniedTime', 'unaccompaniedIncidents',
    'safetyChecks', 'emergencyPrep', 'emergencyFlag', 'emergencyNote',
    'spiritualEmotional', 'specialConcerns', 'caregiverNotes', 'activities', 'notes',
    'oralCare', 'movementDifficulties', 'roomMaintenance', 'personalItemsCheck', 'hospitalBagStatus',
  ],
};

// Fields shared across sections (always visible if ANY section is submitted)
const SHARED_FIELDS = ['medications', 'meals', 'fluids', 'totalFluidIntake'];

// Helper function to filter log data based on completed sections
// Only returns data from sections that have been submitted for family visibility
function filterLogByCompletedSections(
  log: Record<string, unknown>,
  completedSections: CompletedSections | null | undefined
): Record<string, unknown> {
  // If no completed sections, only return metadata (no care data)
  if (!completedSections || Object.keys(completedSections).length === 0) {
    return {
      id: log.id,
      careRecipientId: log.careRecipientId,
      caregiverId: log.caregiverId,
      logDate: log.logDate,
      status: log.status,
      createdAt: log.createdAt,
      updatedAt: log.updatedAt,
      completedSections: null,
      // Empty arrays/objects for expected fields
      medications: [],
      meals: null,
      fluids: [],
    };
  }

  const filteredLog: Record<string, unknown> = {
    id: log.id,
    careRecipientId: log.careRecipientId,
    caregiverId: log.caregiverId,
    logDate: log.logDate,
    status: log.status,
    createdAt: log.createdAt,
    updatedAt: log.updatedAt,
    submittedAt: log.submittedAt,
    completedSections,
  };

  // Always include shared fields if any section is submitted
  for (const field of SHARED_FIELDS) {
    filteredLog[field] = log[field];
  }

  // Include fields from completed sections only
  for (const [section, fields] of Object.entries(SECTION_FIELDS)) {
    if (completedSections[section as SectionName]) {
      for (const field of fields) {
        if (log[field] !== undefined) {
          filteredLog[field] = log[field];
        }
      }
    }
  }

  return filteredLog;
}

// Helper function to parse JSON fields in care log responses
function parseJsonFields(log: Record<string, unknown>): Record<string, unknown> {
  if (!log) return log;
  return {
    ...log,
    medications: safeJsonParse(log.medications),
    meals: safeJsonParse(log.meals), // Parse meals (breakfast, lunch, teaBreak, dinner)
    fluids: safeJsonParse(log.fluids) || [], // Sprint 2 Day 1: Parse fluids
    // Sprint 2 Day 3: Parse sleep (handle both snake_case from DB and camelCase from client)
    afternoonRest: safeJsonParse(log.afternoonRest || log.afternoon_rest),
    nightSleep: safeJsonParse(log.nightSleep || log.night_sleep),
    // Sprint 2 Day 5: Parse toileting (handle both snake_case from DB and camelCase from client)
    bowelMovements: safeJsonParse(log.bowelMovements || log.bowel_movements),
    urination: safeJsonParse(log.urination),
    walkingPattern: safeJsonParse(log.walkingPattern),
    unaccompaniedTime: safeJsonParse(log.unaccompaniedTime),
    safetyChecks: safeJsonParse(log.safetyChecks),
    emergencyPrep: safeJsonParse(log.emergencyPrep),
    // Sprint 3 Day 1: Parse spiritual & emotional (handle both snake_case from DB and camelCase from client)
    spiritualEmotional: safeJsonParse(log.spiritualEmotional || log.spiritual_emotional),
    // Sprint 3 Day 4: Parse exercise sessions
    morningExerciseSession: safeJsonParse(log.morningExerciseSession || log.morning_exercise_session),
    afternoonExerciseSession: safeJsonParse(log.afternoonExerciseSession || log.afternoon_exercise_session),
    movementDifficulties: safeJsonParse(log.movementDifficulties || log.movement_difficulties),
    physicalActivity: safeJsonParse(log.physicalActivity || log.physical_activity),
    // Sprint 3 Day 3: Parse oral care
    oralCare: safeJsonParse(log.oralCare || log.oral_care),
    // Sprint 3 Day 5: Parse special concerns
    specialConcerns: safeJsonParse(log.specialConcerns || log.special_concerns),
    // Sprint 3 Day 3: Parse caregiver notes
    caregiverNotes: safeJsonParse(log.caregiverNotes || log.caregiver_notes),
    // Sprint 3 Day 4: Parse activities
    activities: safeJsonParse(log.activities),
    // Environment & Safety fields
    roomMaintenance: safeJsonParse(log.roomMaintenance || log.room_maintenance),
    personalItemsCheck: safeJsonParse(log.personalItemsCheck || log.personal_items_check),
    hospitalBagStatus: safeJsonParse(log.hospitalBagStatus || log.hospital_bag_status),
  };
}

// Audit Logging Types
type AuditAction = 'create' | 'update' | 'submit' | 'submit_section';

interface AuditLogParams {
  db: ReturnType<typeof createDbClient>;
  careLogId: string;
  changedBy: string;
  changedByName?: string;
  action: AuditAction;
  sectionSubmitted?: string;
  changes?: Record<string, { old: unknown; new: unknown }>;
  snapshot?: Record<string, unknown>;
}

// Helper function to create audit log entries
async function createAuditLog({
  db,
  careLogId,
  changedBy,
  changedByName,
  action,
  sectionSubmitted,
  changes,
  snapshot,
}: AuditLogParams): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any).insert(careLogAudit).values({
      careLogId,
      changedBy,
      changedByName: changedByName || null,
      action,
      sectionSubmitted: sectionSubmitted || null,
      changes: changes ? JSON.stringify(changes) : null,
      snapshot: snapshot ? JSON.stringify(snapshot) : null,
    });
  } catch (error) {
    console.error('Failed to create audit log:', error);
    // Don't throw - audit logging should not break the main operation
  }
}

// Helper function to compute field changes between old and new values
function computeChanges(
  oldData: Record<string, unknown>,
  newData: Record<string, unknown>,
  fieldsToTrack: string[]
): Record<string, { old: unknown; new: unknown }> {
  const changes: Record<string, { old: unknown; new: unknown }> = {};

  for (const field of fieldsToTrack) {
    const oldValue = oldData[field];
    const newValue = newData[field];

    // Compare as JSON strings to handle objects/arrays
    const oldJson = JSON.stringify(oldValue);
    const newJson = JSON.stringify(newValue);

    if (oldJson !== newJson && newValue !== undefined) {
      changes[field] = { old: oldValue, new: newValue };
    }
  }

  return changes;
}

// Create care log (caregivers only) - creates as draft
careLogsRoute.post('/', ...caregiverOnly, async (c) => {
  try {
    const body = await c.req.json();
    const data = createCareLogSchema.parse(body);

    const db = c.get('db');
    const caregiverId = c.get('caregiverId')!; // From caregiverOnly middleware

    // Verify caregiver has access to this care recipient
    const hasAccess = await caregiverHasAccess(db, caregiverId, data.careRecipientId);

    if (!hasAccess) {
      return c.json({
        error: 'Forbidden',
        message: 'You are not assigned to this care recipient'
      }, 403);
    }

    // Sprint 2 Day 1: Auto-calculate total fluid intake if not provided
    const fluids = data.fluids || [];
    const totalFluidIntake = data.totalFluidIntake !== undefined
      ? data.totalFluidIntake
      : calculateTotalFluidIntake(fluids);

    const now = new Date();
    const newLog = await db
      .insert(careLogs)
      .values({
        careRecipientId: data.careRecipientId,
        caregiverId: data.caregiverId || caregiverId,
        logDate: new Date(data.logDate),
        status: 'draft' as const,
        wakeTime: data.wakeTime,
        mood: data.mood,
        showerTime: data.showerTime,
        hairWash: data.hairWash,
        medications: data.medications ? JSON.stringify(data.medications) as string : null,
        meals: data.meals ? JSON.stringify(data.meals) as string : null,
        // Sprint 2 Day 1: Fluid Intake
        fluids: fluids.length > 0 ? JSON.stringify(fluids) as string : null,
        totalFluidIntake,
        // Sprint 2 Day 3: Sleep Tracking
        afternoonRest: data.afternoonRest ? JSON.stringify(data.afternoonRest) as string : null,
        nightSleep: data.nightSleep ? JSON.stringify(data.nightSleep) as string : null,
        bloodPressure: data.bloodPressure,
        pulseRate: data.pulseRate,
        oxygenLevel: data.oxygenLevel,
        bloodSugar: data.bloodSugar,
        vitalsTime: data.vitalsTime,
        // Sprint 2 Day 5: Toileting & Hygiene
        bowelMovements: data.bowelMovements ? JSON.stringify(data.bowelMovements) as string : null,
        urination: data.urination ? JSON.stringify(data.urination) as string : null,
        // Sprint 1: Fall Risk & Safety fields
        balanceIssues: data.balanceIssues,
        nearFalls: data.nearFalls,
        actualFalls: data.actualFalls,
        walkingPattern: data.walkingPattern ? JSON.stringify(data.walkingPattern) as string : null,
        freezingEpisodes: data.freezingEpisodes,
        unaccompaniedTime: data.unaccompaniedTime ? JSON.stringify(data.unaccompaniedTime) as string : null,
        unaccompaniedIncidents: data.unaccompaniedIncidents,
        safetyChecks: data.safetyChecks ? JSON.stringify(data.safetyChecks) as string : null,
        emergencyPrep: data.emergencyPrep ? JSON.stringify(data.emergencyPrep) as string : null,
        emergencyFlag: data.emergencyFlag,
        emergencyNote: data.emergencyNote,
        // Sprint 3 Day 1: Spiritual & Emotional Well-Being
        spiritualEmotional: data.spiritualEmotional ? JSON.stringify(data.spiritualEmotional) as string : null,
        // Sprint 3 Day 2: Physical Activity & Exercise (simplified)
        physicalActivity: data.physicalActivity ? JSON.stringify(data.physicalActivity) as string : null,
        // Sprint 3 Day 4: Detailed Exercise Sessions
        morningExerciseSession: data.morningExerciseSession ? JSON.stringify(data.morningExerciseSession) as string : null,
        afternoonExerciseSession: data.afternoonExerciseSession ? JSON.stringify(data.afternoonExerciseSession) as string : null,
        movementDifficulties: data.movementDifficulties ? JSON.stringify(data.movementDifficulties) as string : null,
        // Sprint 3 Day 3: Oral Care & Hygiene
        oralCare: data.oralCare ? JSON.stringify(data.oralCare) as string : null,
        // Sprint 3 Day 5: Special Concerns & Incidents
        specialConcerns: data.specialConcerns ? JSON.stringify(data.specialConcerns) as string : null,
        // Sprint 3 Day 3: Caregiver Notes
        caregiverNotes: data.caregiverNotes ? JSON.stringify(data.caregiverNotes) as string : null,
        // Sprint 3 Day 4: Activities
        activities: data.activities ? JSON.stringify(data.activities) as string : null,
        // Environment & Safety fields
        roomMaintenance: data.roomMaintenance ? JSON.stringify(data.roomMaintenance) as string : null,
        personalItemsCheck: data.personalItemsCheck ? JSON.stringify(data.personalItemsCheck) as string : null,
        hospitalBagStatus: data.hospitalBagStatus ? JSON.stringify(data.hospitalBagStatus) as string : null,
        notes: data.notes,
        createdAt: now,
        updatedAt: now,
      } as typeof careLogs.$inferInsert)
      .returning()
      .get();

    // Check for major fall alert
    if (data.actualFalls === 'major') {
      // TODO: Create alert/notification for family
      console.log('🚨 MAJOR FALL ALERT for care recipient:', data.careRecipientId);
    }

    // Sprint 3 Day 5: Check for emergency special concerns
    if (checkHighPriorityConcerns(data.specialConcerns)) {
      // TODO: Create alert/notification for family
      console.log('🚨 EMERGENCY CONCERN ALERT for care recipient:', data.careRecipientId);
    }

    // Calculate total unaccompanied time
    const totalUnaccompaniedMinutes = calculateTotalUnaccompaniedTime(data.unaccompaniedTime || []);

    // Sprint 2 Day 1: Add low fluid warning flag
    const lowFluidWarning = totalFluidIntake < 1000;

    // Sprint 2 Day 4: Calculate medication adherence
    const medicationAdherence = calculateMedicationAdherence(data.medications || []);

    // Parse JSON fields for response
    const response = {
      ...parseJsonFields(newLog),
      totalUnaccompaniedMinutes,
      lowFluidWarning,
      medicationAdherence,
    };

    // Create audit log entry for the creation
    const caregiver = await db
      .select({ name: caregivers.name })
      .from(caregivers)
      .where(eq(caregivers.id, caregiverId))
      .get();

    await createAuditLog({
      db,
      careLogId: newLog.id,
      changedBy: caregiverId,
      changedByName: caregiver?.name,
      action: 'create',
      snapshot: response as Record<string, unknown>,
    });

    return c.json(response, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Zod validation error:', JSON.stringify(error.errors));
      return c.json({ error: 'Validation failed', details: error.errors }, 400);
    }
    console.error('Create care log error:', error);
    console.error('Error details:', error instanceof Error ? error.message : String(error));
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
    return c.json({
      error: 'Internal server error',
      message: c.env.ENVIRONMENT === 'dev' ? (error instanceof Error ? error.message : String(error)) : undefined
    }, 500);
  }
});

// Update care log (caregivers only) - can only update drafts they own
careLogsRoute.patch('/:id', ...caregiverOnly, requireCareLogOwnership, async (c) => {
  try {
    const logId = c.req.param('id');
    const body = await c.req.json();
    const data = createCareLogSchema.partial().parse(body);

    const db = c.get('db');

    // Get existing log to verify status
    const existingLog = await db
      .select()
      .from(careLogs)
      .where(eq(careLogs.id, logId))
      .get();

    if (!existingLog) {
      return c.json({ error: 'Care log not found' }, 404);
    }

    if (existingLog.status !== 'draft') {
      return c.json({ error: 'Can only update draft logs' }, 400);
    }

    // If careRecipientId is being changed, verify access
    if (data.careRecipientId && data.careRecipientId !== existingLog.careRecipientId) {
      const caregiverId = c.get('caregiverId')!;
      const { caregiverHasAccess } = await import('../lib/access-control');
      const hasAccess = await caregiverHasAccess(db, caregiverId, data.careRecipientId);

      if (!hasAccess) {
        return c.json({
          error: 'Forbidden',
          message: 'You are not assigned to this care recipient'
        }, 403);
      }
    }

    const updatedLog = await db
      .update(careLogs)
      .set({
        careRecipientId: data.careRecipientId,
        logDate: data.logDate ? new Date(data.logDate) : undefined,
        wakeTime: data.wakeTime,
        mood: data.mood,
        showerTime: data.showerTime,
        hairWash: data.hairWash,
        // JSON fields must be stringified (consistent with POST handler)
        medications: data.medications ? JSON.stringify(data.medications) : undefined,
        meals: data.meals ? JSON.stringify(data.meals) : undefined,
        // Sprint 2 Day 1: Fluid Intake (added to PATCH handler)
        fluids: data.fluids ? JSON.stringify(data.fluids) : undefined,
        totalFluidIntake: data.fluids ? data.fluids.reduce((sum: number, f: { amountMl: number }) => sum + f.amountMl, 0) : undefined,
        // Sprint 2 Day 3: Sleep Tracking
        afternoonRest: data.afternoonRest ? JSON.stringify(data.afternoonRest) : undefined,
        nightSleep: data.nightSleep ? JSON.stringify(data.nightSleep) : undefined,
        bloodPressure: data.bloodPressure,
        pulseRate: data.pulseRate,
        oxygenLevel: data.oxygenLevel,
        bloodSugar: data.bloodSugar,
        vitalsTime: data.vitalsTime,
        // Sprint 2 Day 5: Toileting & Hygiene
        bowelMovements: data.bowelMovements ? JSON.stringify(data.bowelMovements) : undefined,
        urination: data.urination ? JSON.stringify(data.urination) : undefined,
        // Sprint 1: Fall Risk & Safety fields
        balanceIssues: data.balanceIssues,
        nearFalls: data.nearFalls,
        actualFalls: data.actualFalls,
        walkingPattern: data.walkingPattern ? JSON.stringify(data.walkingPattern) : undefined,
        freezingEpisodes: data.freezingEpisodes,
        unaccompaniedTime: data.unaccompaniedTime ? JSON.stringify(data.unaccompaniedTime) : undefined,
        unaccompaniedIncidents: data.unaccompaniedIncidents,
        safetyChecks: data.safetyChecks ? JSON.stringify(data.safetyChecks) : undefined,
        emergencyPrep: data.emergencyPrep ? JSON.stringify(data.emergencyPrep) : undefined,
        emergencyFlag: data.emergencyFlag,
        emergencyNote: data.emergencyNote,
        // Sprint 3 Day 1: Spiritual & Emotional Well-Being
        spiritualEmotional: data.spiritualEmotional ? JSON.stringify(data.spiritualEmotional) : undefined,
        // Sprint 3 Day 2: Physical Activity & Exercise
        physicalActivity: data.physicalActivity ? JSON.stringify(data.physicalActivity) : undefined,
        // Sprint 3 Day 4: Detailed Exercise Sessions
        morningExerciseSession: data.morningExerciseSession ? JSON.stringify(data.morningExerciseSession) : undefined,
        afternoonExerciseSession: data.afternoonExerciseSession ? JSON.stringify(data.afternoonExerciseSession) : undefined,
        movementDifficulties: data.movementDifficulties ? JSON.stringify(data.movementDifficulties) : undefined,
        // Sprint 3 Day 3: Oral Care & Hygiene
        oralCare: data.oralCare ? JSON.stringify(data.oralCare) : undefined,
        // Sprint 3 Day 5: Special Concerns & Incidents
        specialConcerns: data.specialConcerns ? JSON.stringify(data.specialConcerns) : undefined,
        // Sprint 3 Day 3: Caregiver Notes
        caregiverNotes: data.caregiverNotes ? JSON.stringify(data.caregiverNotes) : undefined,
        // Sprint 3 Day 4: Activities
        activities: data.activities ? JSON.stringify(data.activities) : undefined,
        // Environment & Safety fields
        roomMaintenance: data.roomMaintenance ? JSON.stringify(data.roomMaintenance) : undefined,
        personalItemsCheck: data.personalItemsCheck ? JSON.stringify(data.personalItemsCheck) : undefined,
        hospitalBagStatus: data.hospitalBagStatus ? JSON.stringify(data.hospitalBagStatus) : undefined,
        notes: data.notes,
        updatedAt: new Date(),
      } as Partial<typeof careLogs.$inferInsert>)
      .where(eq(careLogs.id, logId))
      .returning()
      .get();

    // Check for major fall alert
    if (data.actualFalls === 'major') {
      // TODO: Create alert/notification for family
      console.log('🚨 MAJOR FALL ALERT for care recipient:', data.careRecipientId);
    }

    // Sprint 3 Day 5: Check for emergency special concerns
    if (checkHighPriorityConcerns(data.specialConcerns)) {
      // TODO: Create alert/notification for family
      console.log('🚨 EMERGENCY CONCERN ALERT for care recipient:', data.careRecipientId);
    }

    // Create audit log entry for the update
    const caregiverId = c.get('caregiverId')!;
    const caregiver = await db
      .select({ name: caregivers.name })
      .from(caregivers)
      .where(eq(caregivers.id, caregiverId))
      .get();

    // Track all trackable fields for change detection
    const trackableFields = [
      'wakeTime', 'mood', 'showerTime', 'hairWash', 'medications', 'meals',
      'bloodPressure', 'pulseRate', 'oxygenLevel', 'bloodSugar', 'vitalsTime',
      'bowelMovements', 'urination', 'balanceIssues', 'nearFalls', 'actualFalls',
      'walkingPattern', 'freezingEpisodes', 'unaccompaniedTime', 'unaccompaniedIncidents',
      'safetyChecks', 'emergencyPrep', 'emergencyFlag', 'emergencyNote',
      'spiritualEmotional', 'physicalActivity', 'morningExerciseSession',
      'afternoonExerciseSession', 'movementDifficulties', 'oralCare', 'specialConcerns',
      'caregiverNotes', 'activities', 'roomMaintenance', 'personalItemsCheck', 'hospitalBagStatus', 'notes',
    ];

    const parsedOld = parseJsonFields(existingLog as Record<string, unknown>);
    const parsedNew = parseJsonFields(updatedLog as Record<string, unknown>);
    const changes = computeChanges(parsedOld, parsedNew, trackableFields);

    // Only create audit log if there are actual changes
    if (Object.keys(changes).length > 0) {
      await createAuditLog({
        db,
        careLogId: logId,
        changedBy: caregiverId,
        changedByName: caregiver?.name,
        action: 'update',
        changes,
        snapshot: parsedNew as Record<string, unknown>,
      });
    }

    return c.json(parseJsonFields(updatedLog));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Validation failed', details: error.errors }, 400);
    }
    console.error('Update care log error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get today's care log for the caregiver (draft or submitted)
// This allows caregivers to reload their work after page refresh
careLogsRoute.get('/caregiver/today', ...caregiverOnly, async (c) => {
  try {
    const db = c.get('db');
    const caregiverId = c.get('caregiverId')!;

    // Get caregiver's assigned care recipient
    const caregiver = await db
      .select({ careRecipientId: caregivers.careRecipientId })
      .from(caregivers)
      .where(eq(caregivers.id, caregiverId))
      .get();

    if (!caregiver?.careRecipientId) {
      return c.json({ error: 'Caregiver not assigned to a care recipient' }, 400);
    }

    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];

    // Find logs for this caregiver's care recipient
    const logs = await db
      .select()
      .from(careLogs)
      .where(
        and(
          eq(careLogs.careRecipientId, caregiver.careRecipientId),
          eq(careLogs.caregiverId, caregiverId)
        )
      )
      .orderBy(desc(careLogs.updatedAt))
      .all();

    // Filter by today's date (compare YYYY-MM-DD portion)
    const todayLog = logs.find(log => {
      // log.logDate might be a Date object or Unix timestamp
      const logDateMs = typeof log.logDate === 'number' ? log.logDate * 1000 : new Date(log.logDate).getTime();
      const logDate = new Date(logDateMs).toISOString().split('T')[0];
      return logDate === today;
    });

    if (!todayLog) {
      return c.json(null);
    }

    // Return full log data (no filtering for caregiver's own data)
    return c.json(parseJsonFields(todayLog));
  } catch (error) {
    console.error('Get caregiver today log error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get care logs for a care recipient (family members see submitted logs OR logs with completed sections)
careLogsRoute.get('/recipient/:recipientId', ...familyMemberAccess, requireCareRecipientAccess, async (c) => {
  try {
    const recipientId = c.req.param('recipientId');
    const db = c.get('db');

    // Get logs that are either:
    // 1. Fully submitted (status = 'submitted'), OR
    // 2. Have at least one completed section (for progressive visibility)
    const logs = await db
      .select()
      .from(careLogs)
      .where(
        and(
          eq(careLogs.careRecipientId, recipientId),
          or(
            eq(careLogs.status, 'submitted'),
            isNotNull(careLogs.completedSections) // Has progressive sections
          )
        )
      )
      .orderBy(desc(careLogs.logDate))
      .all();

    // Filter logs: only include if submitted OR has completed sections with content
    const visibleLogs = logs.filter(log => {
      if (log.status === 'submitted') return true;
      // For draft logs, only show if they have completed sections
      if (log.completedSections) {
        try {
          const sections = typeof log.completedSections === 'string'
            ? JSON.parse(log.completedSections)
            : log.completedSections;
          return Object.keys(sections).length > 0;
        } catch {
          return false;
        }
      }
      return false;
    });

    // Parse JSON fields and filter data by completed sections
    const parsedLogs = visibleLogs.map(log => {
      const parsedLog = parseJsonFields(log);

      // For submitted logs, show everything
      if (log.status === 'submitted') {
        return {
          ...parsedLog,
          totalUnaccompaniedMinutes: log.unaccompaniedTime
            ? calculateTotalUnaccompaniedTime(log.unaccompaniedTime)
            : 0,
        };
      }

      // For draft logs with completed sections, filter data by completed sections
      let completedSections: CompletedSections | null = null;
      if (log.completedSections) {
        try {
          completedSections = typeof log.completedSections === 'string'
            ? JSON.parse(log.completedSections)
            : log.completedSections as CompletedSections;
        } catch {
          completedSections = null;
        }
      }

      const filteredLog = filterLogByCompletedSections(parsedLog, completedSections);
      return {
        ...filteredLog,
        totalUnaccompaniedMinutes: filteredLog.unaccompaniedTime
          ? calculateTotalUnaccompaniedTime(filteredLog.unaccompaniedTime)
          : 0,
      };
    });

    return c.json(parsedLogs);
  } catch (error) {
    console.error('Get care logs error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get today's care log for a recipient (family members only)
// Helper to normalize meals data format
const normalizeMealsData = (mealsData: unknown): unknown => {
  if (!mealsData) return null;
  try {
    // Handle both string (from DB) and already parsed object
    let meals: unknown = mealsData;
    if (typeof mealsData === 'string') {
      meals = JSON.parse(mealsData);
    }

    // If it's already an object with breakfast key, return as is
    if (typeof meals === 'object' && meals !== null && 'breakfast' in meals) return meals;

    // If it's an array, convert to object format
    if (Array.isArray(meals)) {
      const normalized: Record<string, unknown> = {};
      meals.forEach((meal: Record<string, unknown>) => {
        const mealType = meal.meal as string;
        normalized[mealType] = {
          time: meal.time,
          appetite: meal.appetite,
          amountEaten: meal.amount || meal.amountEaten,
        };
      });
      return normalized;
    }
    return meals;
  } catch (e) {
    console.error('Error normalizing meals data:', e, mealsData);
    return null;
  }
};

careLogsRoute.get('/recipient/:recipientId/today', ...familyMemberAccess, requireCareRecipientAccess, async (c) => {
  try {
    const recipientId = c.req.param('recipientId');
    const db = c.get('db');
    const userId = c.get('userId');

    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];

    // First try to get TODAY's log with completed sections or submitted status
    let log = await db
      .select()
      .from(careLogs)
      .where(
        and(
          eq(careLogs.careRecipientId, recipientId),
          sql`date(${careLogs.logDate}) = ${today}`,
          or(
            eq(careLogs.status, 'submitted'),
            isNotNull(careLogs.completedSections)
          )
        )
      )
      .orderBy(desc(careLogs.updatedAt))
      .limit(1)
      .get();

    // If no today's log, fall back to most recent submitted log
    if (!log) {
      log = await db
        .select()
        .from(careLogs)
        .where(
          and(
            eq(careLogs.careRecipientId, recipientId),
            eq(careLogs.status, 'submitted')
          )
        )
        .orderBy(desc(careLogs.logDate), desc(careLogs.updatedAt))
        .limit(1)
        .get();
    }

    if (!log) {
      return c.json(null);
    }

    // Check if log should be visible (submitted or has completed sections)
    let completedSections: CompletedSections | null = null;
    if (log.completedSections) {
      try {
        completedSections = typeof log.completedSections === 'string'
          ? JSON.parse(log.completedSections)
          : log.completedSections as CompletedSections;
      } catch {
        completedSections = null;
      }
    }

    // If draft without completed sections, don't show
    if (log.status !== 'submitted' && (!completedSections || Object.keys(completedSections).length === 0)) {
      return c.json(null);
    }

    // Parse JSON fields
    const parsedLog = parseJsonFields(log);

    // Check for unviewed changes and collect changed fields
    let hasUnviewedChanges = false;
    let changedFields: string[] = [];
    if (userId) {
      // Get user's last view time for this log
      const lastView = await db
        .select()
        .from(careLogViews)
        .where(
          and(
            eq(careLogViews.careLogId, log.id),
            eq(careLogViews.userId, userId)
          )
        )
        .get();

      if (lastView) {
        // Get all audit entries after the last view to extract changed fields
        const unviewedAuditEntries = await db
          .select()
          .from(careLogAudit)
          .where(
            and(
              eq(careLogAudit.careLogId, log.id),
              gt(careLogAudit.createdAt, lastView.viewedAt)
            )
          )
          .all();

        hasUnviewedChanges = unviewedAuditEntries.length > 0;

        // Extract changed field names from all audit entries
        const changedFieldSet = new Set<string>();
        for (const entry of unviewedAuditEntries) {
          if (entry.changes) {
            try {
              const changes = typeof entry.changes === 'string'
                ? JSON.parse(entry.changes)
                : entry.changes;
              Object.keys(changes).forEach(field => changedFieldSet.add(field));
            } catch {
              // Ignore parse errors
            }
          }
          // For section submissions, mark the section's fields as changed
          if (entry.action === 'submit_section' && entry.sectionSubmitted) {
            changedFieldSet.add(entry.sectionSubmitted);
          }
        }
        changedFields = Array.from(changedFieldSet);
      } else {
        // User has never viewed this log - check if there are any audit entries
        const anyChanges = await db
          .select()
          .from(careLogAudit)
          .where(eq(careLogAudit.careLogId, log.id))
          .limit(1)
          .get();

        hasUnviewedChanges = !!anyChanges;
        // For never-viewed logs, don't highlight specific fields - whole log is new
      }
    }

    // For submitted logs, show everything
    if (log.status === 'submitted') {
      const medications = parsedLog.medications || [];
      return c.json({
        ...parsedLog,
        meals: normalizeMealsData(log.meals),
        totalUnaccompaniedMinutes: log.unaccompaniedTime
          ? calculateTotalUnaccompaniedTime(log.unaccompaniedTime)
          : 0,
        medicationAdherence: calculateMedicationAdherence(medications),
        hasUnviewedChanges,
        changedFields,
      });
    }

    // For draft logs with completed sections, filter data
    const filteredLog = filterLogByCompletedSections(parsedLog, completedSections);
    const medications = filteredLog.medications || [];

    return c.json({
      ...filteredLog,
      meals: normalizeMealsData(filteredLog.meals),
      totalUnaccompaniedMinutes: filteredLog.unaccompaniedTime
        ? calculateTotalUnaccompaniedTime(filteredLog.unaccompaniedTime)
        : 0,
      medicationAdherence: calculateMedicationAdherence(medications),
      hasUnviewedChanges,
      changedFields,
    });
  } catch (error) {
    console.error('Get today log error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get care log for a specific date (family members only)
careLogsRoute.get('/recipient/:recipientId/date/:date', ...familyMemberAccess, requireCareRecipientAccess, async (c) => {
  try {
    const recipientId = c.req.param('recipientId');
    const date = c.req.param('date'); // Expected format: YYYY-MM-DD
    const db = c.get('db');

    // Get logs that are either submitted OR have completed sections
    const logs = await db
      .select()
      .from(careLogs)
      .where(
        and(
          eq(careLogs.careRecipientId, recipientId),
          or(
            eq(careLogs.status, 'submitted'),
            isNotNull(careLogs.completedSections)
          )
        )
      )
      .orderBy(desc(careLogs.logDate))
      .all();

    // Filter by date (compare YYYY-MM-DD portion)
    const targetDate = new Date(date).toISOString().split('T')[0];
    console.log(`[GET /date/:date] Searching for date ${targetDate}, found ${logs.length} logs`);

    const matchingLog = logs.find(log => {
      // log.logDate might be a Date object or Unix timestamp
      const logDateMs = typeof log.logDate === 'number' ? log.logDate * 1000 : new Date(log.logDate).getTime();
      const logDate = new Date(logDateMs).toISOString().split('T')[0];
      console.log(`  Comparing: ${logDate} === ${targetDate} ? ${logDate === targetDate} (logDate type: ${typeof log.logDate}, value: ${log.logDate})`);
      return logDate === targetDate;
    });

    if (!matchingLog) {
      console.log(`[GET /date/:date] No log found for ${targetDate}`);
      return c.json(null);
    }

    // Check if log should be visible
    let completedSections: CompletedSections | null = null;
    if (matchingLog.completedSections) {
      try {
        completedSections = typeof matchingLog.completedSections === 'string'
          ? JSON.parse(matchingLog.completedSections)
          : matchingLog.completedSections as CompletedSections;
      } catch {
        completedSections = null;
      }
    }

    // If draft without completed sections, don't show
    if (matchingLog.status !== 'submitted' && (!completedSections || Object.keys(completedSections).length === 0)) {
      return c.json(null);
    }

    console.log(`[GET /date/:date] Found log ${matchingLog.id} for ${targetDate}`);

    // Parse JSON fields
    const parsedLog = parseJsonFields(matchingLog);

    // For submitted logs, show everything
    if (matchingLog.status === 'submitted') {
      const medications = parsedLog.medications || [];
      return c.json({
        ...parsedLog,
        meals: normalizeMealsData(matchingLog.meals),
        totalUnaccompaniedMinutes: matchingLog.unaccompaniedTime
          ? calculateTotalUnaccompaniedTime(matchingLog.unaccompaniedTime)
          : 0,
        medicationAdherence: calculateMedicationAdherence(medications),
      });
    }

    // For draft logs with completed sections, filter data
    const filteredLog = filterLogByCompletedSections(parsedLog, completedSections);
    const medications = filteredLog.medications || [];

    return c.json({
      ...filteredLog,
      meals: normalizeMealsData(filteredLog.meals),
      totalUnaccompaniedMinutes: filteredLog.unaccompaniedTime
        ? calculateTotalUnaccompaniedTime(filteredLog.unaccompaniedTime)
        : 0,
      medicationAdherence: calculateMedicationAdherence(medications),
    });
  } catch (error) {
    console.error('Get date log error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

const submitSectionSchema = z.object({
  section: z.enum(['morning', 'afternoon', 'evening', 'dailySummary']),
});

// Submit a single section (caregiver only) - Progressive Section Submission
// Sections can be submitted in any order and re-submitted to update visibility
// This does NOT lock the form - use POST /:id/submit for final submission
careLogsRoute.post('/:id/submit-section', ...caregiverOnly, requireCareLogOwnership, async (c) => {
  try {
    const logId = c.req.param('id');
    const body = await c.req.json();
    const { section } = submitSectionSchema.parse(body);

    const db = c.get('db');
    const caregiverId = c.get('caregiverId')!;

    // Get the log to verify status
    const log = await db
      .select()
      .from(careLogs)
      .where(eq(careLogs.id, logId))
      .get();

    if (!log) {
      return c.json({ error: 'Care log not found' }, 404);
    }

    // Can only submit sections on draft logs
    if (log.status !== 'draft') {
      return c.json({ error: 'Cannot submit sections on a finalized log' }, 400);
    }

    // Parse existing completed sections or start fresh
    let completedSections: CompletedSections = {};
    if (log.completedSections) {
      try {
        completedSections = typeof log.completedSections === 'string'
          ? JSON.parse(log.completedSections)
          : log.completedSections as CompletedSections;
      } catch {
        completedSections = {};
      }
    }

    // Add/update this section
    const now = new Date().toISOString();
    completedSections[section] = {
      submittedAt: now,
      submittedBy: caregiverId,
    };

    // Update the log (Drizzle handles JSON serialization with mode: 'json')
    await db
      .update(careLogs)
      .set({
        completedSections: completedSections,
        updatedAt: new Date(),
      })
      .where(eq(careLogs.id, logId));

    // Create audit log entry for section submission
    const caregiver = await db
      .select({ name: caregivers.name })
      .from(caregivers)
      .where(eq(caregivers.id, caregiverId))
      .get();

    await createAuditLog({
      db,
      careLogId: logId,
      changedBy: caregiverId,
      changedByName: caregiver?.name,
      action: 'submit_section',
      sectionSubmitted: section,
    });

    return c.json({
      success: true,
      message: `${section} section submitted successfully`,
      completedSections,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Validation failed', details: error.errors }, 400);
    }
    console.error('Submit section error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Submit care log (caregiver only, locks the log)
careLogsRoute.post('/:id/submit', ...caregiverOnly, requireCareLogOwnership, async (c) => {
  try {
    const logId = c.req.param('id');
    const db = c.get('db');

    // Get the log to verify it's a draft
    const log = await db
      .select()
      .from(careLogs)
      .where(eq(careLogs.id, logId))
      .get();

    if (!log) {
      return c.json({ error: 'Care log not found' }, 404);
    }

    if (log.status !== 'draft') {
      return c.json({ error: 'Only draft logs can be submitted' }, 400);
    }

    // Mark as submitted (immutable)
    await db
      .update(careLogs)
      .set({
        status: 'submitted',
        submittedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(careLogs.id, logId));

    // Create audit log entry for final submission
    const caregiverId = c.get('caregiverId')!;
    const caregiver = await db
      .select({ name: caregivers.name })
      .from(caregivers)
      .where(eq(caregivers.id, caregiverId))
      .get();

    await createAuditLog({
      db,
      careLogId: logId,
      changedBy: caregiverId,
      changedByName: caregiver?.name,
      action: 'submit',
    });

    return c.json({
      success: true,
      message: 'Care log submitted successfully',
    });
  } catch (error) {
    console.error('Submit care log error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Invalidate care log (family_admin only)
careLogsRoute.post('/:id/invalidate', ...familyAdminOnly, requireLogInvalidation, async (c) => {
  try {
    const logId = c.req.param('id');
    const userId = c.get('userId')!;
    const body = await c.req.json();
    const { reason } = body;

    const db = c.get('db');

    // Get the log to verify it's submitted
    const log = await db
      .select()
      .from(careLogs)
      .where(eq(careLogs.id, logId))
      .get();

    if (!log) {
      return c.json({ error: 'Care log not found' }, 404);
    }

    if (log.status !== 'submitted') {
      return c.json({ error: 'Only submitted logs can be invalidated' }, 400);
    }

    // Validate reason is provided
    if (!reason || reason.trim() === '') {
      return c.json({ error: 'Invalidation reason is required' }, 400);
    }

    // Mark as invalidated and revert to draft for re-editing
    await db
      .update(careLogs)
      .set({
        status: 'draft', // Revert to draft so caregiver can fix
        invalidatedAt: new Date(),
        invalidatedBy: userId,
        invalidationReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(careLogs.id, logId));

    // TODO: Send notification to caregiver

    return c.json({
      success: true,
      message: 'Care log has been invalidated',
    });
  } catch (error) {
    console.error('Invalidate care log error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// GET /care-logs/:id/history - Get audit history for a care log (family members only)
careLogsRoute.get('/:id/history', ...familyMemberAccess, async (c) => {
  try {
    const logId = c.req.param('id');
    const db = c.get('db');
    const userId = c.get('userId');

    // Verify the care log exists and user has access
    const log = await db
      .select()
      .from(careLogs)
      .where(eq(careLogs.id, logId))
      .get();

    if (!log) {
      return c.json({ error: 'Care log not found' }, 404);
    }

    // Verify user has access to this care recipient
    const hasAccess = await canAccessCareRecipient(db, userId!, log.careRecipientId);
    if (!hasAccess) {
      return c.json({ error: 'Access denied' }, 403);
    }

    // Get audit history ordered by most recent first
    const history = await db
      .select()
      .from(careLogAudit)
      .where(eq(careLogAudit.careLogId, logId))
      .orderBy(desc(careLogAudit.createdAt))
      .all();

    // Parse JSON fields in each audit record
    const parsedHistory = history.map(record => ({
      ...record,
      changes: safeJsonParse(record.changes),
      snapshot: safeJsonParse(record.snapshot),
    }));

    return c.json(parsedHistory);
  } catch (error) {
    console.error('Get audit history error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// POST /care-logs/:id/mark-viewed - Mark a care log as viewed by a family member
careLogsRoute.post('/:id/mark-viewed', ...familyMemberAccess, async (c) => {
  try {
    const logId = c.req.param('id');
    const db = c.get('db');
    const userId = c.get('userId');

    if (!userId) {
      return c.json({ error: 'User ID required' }, 400);
    }

    // Verify the care log exists
    const log = await db
      .select()
      .from(careLogs)
      .where(eq(careLogs.id, logId))
      .get();

    if (!log) {
      return c.json({ error: 'Care log not found' }, 404);
    }

    // Verify user has access to this care recipient
    const hasAccess = await canAccessCareRecipient(db, userId, log.careRecipientId);
    if (!hasAccess) {
      return c.json({ error: 'Access denied' }, 403);
    }

    const now = new Date();

    // Check if view record exists
    const existingView = await db
      .select()
      .from(careLogViews)
      .where(
        and(
          eq(careLogViews.careLogId, logId),
          eq(careLogViews.userId, userId)
        )
      )
      .get();

    if (existingView) {
      // Update existing view timestamp
      await db
        .update(careLogViews)
        .set({ viewedAt: now })
        .where(eq(careLogViews.id, existingView.id));
    } else {
      // Create new view record
      await db.insert(careLogViews).values({
        id: crypto.randomUUID(),
        careLogId: logId,
        userId,
        viewedAt: now,
      });
    }

    return c.json({
      viewedAt: now.toISOString(),
      careLogId: logId,
    });
  } catch (error) {
    console.error('Mark viewed error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default careLogsRoute;
