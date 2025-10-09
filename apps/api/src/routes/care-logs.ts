import { Hono } from 'hono';
import { z } from 'zod';
import type { AppContext } from '../index';
import { careLogs } from '@anchor/database/schema';
import { eq, desc, and } from 'drizzle-orm';
import { caregiverOnly, familyAdminOnly, familyMemberAccess } from '../middleware/rbac';
import { requireCareLogOwnership, requireLogInvalidation, requireCareRecipientAccess } from '../middleware/permissions';
import { caregiverHasAccess } from '../lib/access-control';

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
  const [startHour, startMin] = data.startTime.split(':').map(Number);
  const [endHour, endMin] = data.endTime.split(':').map(Number);
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
  const [startHour, startMin] = data.startTime.split(':').map(Number);
  const [endHour, endMin] = data.endTime.split(':').map(Number);
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

  // Meals
  meals: z.object({
    breakfast: mealLogSchema.optional(),
    lunch: mealLogSchema.optional(),
    dinner: mealLogSchema.optional(),
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

  // Notes
  notes: z.string().optional(),
});

// Sprint 2 Day 1: Helper function to calculate total fluid intake
function calculateTotalFluidIntake(fluids: any[]): number {
  if (!fluids || fluids.length === 0) return 0;
  return fluids.reduce((total, fluid) => total + (fluid.amountMl || 0), 0);
}

// Helper function to calculate total unaccompanied time
function calculateTotalUnaccompaniedTime(periods: any[]): number {
  if (!periods || periods.length === 0) return 0;
  return periods.reduce((total, period) => total + (period.durationMinutes || 0), 0);
}

// Sprint 2 Day 4: Helper function to calculate medication adherence
function calculateMedicationAdherence(medications: any[]): {
  total: number;
  given: number;
  missed: number;
  percentage: number;
} {
  if (!medications || medications.length === 0) {
    return { total: 0, given: 0, missed: 0, percentage: 0 };
  }

  const total = medications.length;
  const given = medications.filter(med => med.given === true).length;
  const missed = total - given;
  const percentage = total > 0 ? Math.round((given / total) * 100) : 0;

  return { total, given, missed, percentage };
}

// Sprint 3 Day 5: Helper function to check for high-priority concerns
function checkHighPriorityConcerns(specialConcerns: any): boolean {
  if (!specialConcerns) return false;
  return specialConcerns.priorityLevel === 'emergency';
}

// Helper function to safely parse JSON (handles double-stringified data)
function safeJsonParse(value: any): any {
  if (!value) return null;
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

// Helper function to parse JSON fields in care log responses
function parseJsonFields(log: any): any {
  if (!log) return log;
  return {
    ...log,
    medications: safeJsonParse(log.medications),
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
  };
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
        medications: data.medications ? JSON.stringify(data.medications) as any : null,
        meals: data.meals ? JSON.stringify(data.meals) as any : null,
        // Sprint 2 Day 1: Fluid Intake
        fluids: fluids.length > 0 ? JSON.stringify(fluids) as any : null,
        totalFluidIntake,
        // Sprint 2 Day 3: Sleep Tracking
        afternoonRest: data.afternoonRest ? JSON.stringify(data.afternoonRest) as any : null,
        nightSleep: data.nightSleep ? JSON.stringify(data.nightSleep) as any : null,
        bloodPressure: data.bloodPressure,
        pulseRate: data.pulseRate,
        oxygenLevel: data.oxygenLevel,
        bloodSugar: data.bloodSugar,
        vitalsTime: data.vitalsTime,
        // Sprint 2 Day 5: Toileting & Hygiene
        bowelMovements: data.bowelMovements ? JSON.stringify(data.bowelMovements) as any : null,
        urination: data.urination ? JSON.stringify(data.urination) as any : null,
        // Sprint 1: Fall Risk & Safety fields
        balanceIssues: data.balanceIssues,
        nearFalls: data.nearFalls,
        actualFalls: data.actualFalls,
        walkingPattern: data.walkingPattern ? JSON.stringify(data.walkingPattern) as any : null,
        freezingEpisodes: data.freezingEpisodes,
        unaccompaniedTime: data.unaccompaniedTime ? JSON.stringify(data.unaccompaniedTime) as any : null,
        unaccompaniedIncidents: data.unaccompaniedIncidents,
        safetyChecks: data.safetyChecks ? JSON.stringify(data.safetyChecks) as any : null,
        emergencyPrep: data.emergencyPrep ? JSON.stringify(data.emergencyPrep) as any : null,
        emergencyFlag: data.emergencyFlag,
        emergencyNote: data.emergencyNote,
        // Sprint 3 Day 1: Spiritual & Emotional Well-Being
        spiritualEmotional: data.spiritualEmotional ? JSON.stringify(data.spiritualEmotional) as any : null,
        // Sprint 3 Day 2: Physical Activity & Exercise (simplified)
        physicalActivity: data.physicalActivity ? JSON.stringify(data.physicalActivity) as any : null,
        // Sprint 3 Day 4: Detailed Exercise Sessions
        morningExerciseSession: data.morningExerciseSession ? JSON.stringify(data.morningExerciseSession) as any : null,
        afternoonExerciseSession: data.afternoonExerciseSession ? JSON.stringify(data.afternoonExerciseSession) as any : null,
        movementDifficulties: data.movementDifficulties ? JSON.stringify(data.movementDifficulties) as any : null,
        // Sprint 3 Day 3: Oral Care & Hygiene
        oralCare: data.oralCare ? JSON.stringify(data.oralCare) as any : null,
        // Sprint 3 Day 5: Special Concerns & Incidents
        specialConcerns: data.specialConcerns ? JSON.stringify(data.specialConcerns) as any : null,
        notes: data.notes,
        createdAt: now,
        updatedAt: now,
      } as any)
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
        medications: data.medications as any,
        meals: data.meals as any,
        bloodPressure: data.bloodPressure,
        pulseRate: data.pulseRate,
        oxygenLevel: data.oxygenLevel,
        bloodSugar: data.bloodSugar,
        vitalsTime: data.vitalsTime,
        // Sprint 2 Day 5: Toileting & Hygiene
        bowelMovements: data.bowelMovements as any,
        urination: data.urination as any,
        // Sprint 1: Fall Risk & Safety fields
        balanceIssues: data.balanceIssues,
        nearFalls: data.nearFalls,
        actualFalls: data.actualFalls,
        walkingPattern: data.walkingPattern as any,
        freezingEpisodes: data.freezingEpisodes,
        unaccompaniedTime: data.unaccompaniedTime as any,
        unaccompaniedIncidents: data.unaccompaniedIncidents,
        safetyChecks: data.safetyChecks as any,
        emergencyPrep: data.emergencyPrep as any,
        emergencyFlag: data.emergencyFlag,
        emergencyNote: data.emergencyNote,
        // Sprint 3 Day 1: Spiritual & Emotional Well-Being
        spiritualEmotional: data.spiritualEmotional as any,
        // Sprint 3 Day 2: Physical Activity & Exercise
        physicalActivity: data.physicalActivity as any,
        // Sprint 3 Day 4: Detailed Exercise Sessions
        morningExerciseSession: data.morningExerciseSession as any,
        afternoonExerciseSession: data.afternoonExerciseSession as any,
        movementDifficulties: data.movementDifficulties as any,
        // Sprint 3 Day 3: Oral Care & Hygiene
        oralCare: data.oralCare as any,
        // Sprint 3 Day 5: Special Concerns & Incidents
        specialConcerns: data.specialConcerns as any,
        notes: data.notes,
        updatedAt: new Date(),
      } as any)
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

    return c.json(parseJsonFields(updatedLog));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: 'Validation failed', details: error.errors }, 400);
    }
    console.error('Update care log error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get care logs for a care recipient (family members only see submitted logs)
careLogsRoute.get('/recipient/:recipientId', ...familyMemberAccess, requireCareRecipientAccess, async (c) => {
  try {
    const recipientId = c.req.param('recipientId');
    const db = c.get('db');

    const logs = await db
      .select()
      .from(careLogs)
      .where(
        and(
          eq(careLogs.careRecipientId, recipientId),
          eq(careLogs.status, 'submitted') // Only show submitted logs
        )
      )
      .orderBy(desc(careLogs.logDate))
      .all();

    // Parse JSON fields in all logs
    const parsedLogs = logs.map(log => ({
      ...parseJsonFields(log),
      totalUnaccompaniedMinutes: log.unaccompaniedTime
        ? calculateTotalUnaccompaniedTime(JSON.parse(log.unaccompaniedTime as any))
        : 0,
    }));

    return c.json(parsedLogs);
  } catch (error) {
    console.error('Get care logs error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get today's care log for a recipient (family members only)
// Helper to normalize meals data format
const normalizeMealsData = (mealsData: any): any => {
  if (!mealsData) return null;
  try {
    // Handle both string (from DB) and already parsed object
    let meals = mealsData;
    if (typeof mealsData === 'string') {
      meals = JSON.parse(mealsData);
    }

    // If it's already an object with breakfast key, return as is
    if (meals.breakfast) return meals;

    // If it's an array, convert to object format
    if (Array.isArray(meals)) {
      const normalized: any = {};
      meals.forEach((meal: any) => {
        normalized[meal.meal] = {
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

    const log = await db
      .select()
      .from(careLogs)
      .where(
        and(
          eq(careLogs.careRecipientId, recipientId),
          eq(careLogs.status, 'submitted') // Only show submitted logs
        )
      )
      .orderBy(desc(careLogs.logDate), desc(careLogs.updatedAt))
      .limit(1)
      .get();

    if (!log) {
      return c.json(null);
    }

    // Normalize meals data and parse JSON fields
    const parsedLog = parseJsonFields(log);
    const medications = parsedLog.medications || [];

    return c.json({
      ...parsedLog,
      meals: normalizeMealsData(log.meals as any),
      totalUnaccompaniedMinutes: log.unaccompaniedTime
        ? calculateTotalUnaccompaniedTime(JSON.parse(log.unaccompaniedTime as any))
        : 0,
      medicationAdherence: calculateMedicationAdherence(medications), // Sprint 2 Day 4
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

    const logs = await db
      .select()
      .from(careLogs)
      .where(
        and(
          eq(careLogs.careRecipientId, recipientId),
          eq(careLogs.status, 'submitted') // Only show submitted logs
        )
      )
      .orderBy(desc(careLogs.logDate))
      .all();

    // Filter by date (compare YYYY-MM-DD portion)
    // Note: log.logDate is stored as Unix timestamp (seconds), need to convert to milliseconds
    const targetDate = new Date(date).toISOString().split('T')[0];
    console.log(`[GET /date/:date] Searching for date ${targetDate}, found ${logs.length} submitted logs`);

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
    console.log(`[GET /date/:date] Found log ${matchingLog.id} for ${targetDate}`);

    // Normalize meals data and parse JSON fields
    const parsedLog = parseJsonFields(matchingLog);
    const medications = parsedLog.medications || [];

    return c.json({
      ...parsedLog,
      meals: normalizeMealsData(matchingLog.meals as any),
      totalUnaccompaniedMinutes: matchingLog.unaccompaniedTime
        ? calculateTotalUnaccompaniedTime(JSON.parse(matchingLog.unaccompaniedTime as any))
        : 0,
      medicationAdherence: calculateMedicationAdherence(medications), // Sprint 2 Day 4
    });
  } catch (error) {
    console.error('Get date log error:', error);
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

export default careLogsRoute;
