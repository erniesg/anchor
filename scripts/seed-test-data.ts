import { drizzle } from 'drizzle-orm/d1';
import { careLogs } from '../packages/database/src/schema';

/**
 * Seed test care log data for trend visualization
 * Creates 7 days of realistic care log entries
 */

const CARE_RECIPIENT_ID = '0725fbb9-21c5-46a4-9ed0-305b0a506f20'; // Qiuxia
const CAREGIVER_ID = 'e80c2b2a-4688-4a29-9579-51b3219f20fc'; // Test

// Helper to generate date for N days ago at specific time
function daysAgo(days: number, hour: number = 8, minute: number = 0): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, minute, 0, 0);
  return date;
}

// Generate realistic test data for past 7 days
const testLogs = [
  // Day 1 (6 days ago) - Good day
  {
    careRecipientId: CARE_RECIPIENT_ID,
    caregiverId: CAREGIVER_ID,
    logDate: daysAgo(6),
    timePeriod: 'morning',
    wakeTime: '07:30',
    mood: 'alert',
    showerTime: '08:00',
    hairWash: true,
    medications: [
      { name: 'Levodopa 100mg', given: true, time: '08:15', timeSlot: 'after_breakfast' },
      { name: 'Donepezil 5mg', given: true, time: '08:15', timeSlot: 'after_breakfast' },
      { name: 'Multivitamin', given: true, time: '08:15', timeSlot: 'after_breakfast' },
    ],
    meals: {
      breakfast: { time: '08:30', appetite: 5, amountEaten: 90, swallowingIssues: [] },
      lunch: { time: '12:30', appetite: 4, amountEaten: 80, swallowingIssues: [] },
      dinner: { time: '18:00', appetite: 4, amountEaten: 85, swallowingIssues: [] },
    },
    bloodPressure: '128/82',
    pulseRate: 72,
    oxygenLevel: 97,
    bloodSugar: 5.8,
    vitalsTime: '09:00',
    toileting: {
      bowelFrequency: 1,
      urineFrequency: 6,
      diaperChanges: 0,
      accidents: 'none',
      assistance: 'minimal',
      pain: 'none',
      urineColor: 'clear_yellow',
      bowelConsistency: 'normal',
    },
    emergencyFlag: false,
    notes: 'Good day overall. Patient alert and cooperative.',
  },

  // Day 2 (5 days ago) - Slight decline
  {
    careRecipientId: CARE_RECIPIENT_ID,
    caregiverId: CAREGIVER_ID,
    logDate: daysAgo(5),
    timePeriod: 'morning',
    wakeTime: '08:00',
    mood: 'confused',
    showerTime: '08:30',
    hairWash: false,
    medications: [
      { name: 'Levodopa 100mg', given: true, time: '08:45', timeSlot: 'after_breakfast' },
      { name: 'Donepezil 5mg', given: true, time: '08:45', timeSlot: 'after_breakfast' },
      { name: 'Multivitamin', given: true, time: '08:45', timeSlot: 'after_breakfast' },
    ],
    meals: {
      breakfast: { time: '09:00', appetite: 3, amountEaten: 70, swallowingIssues: ['coughing'] },
      lunch: { time: '13:00', appetite: 3, amountEaten: 65, swallowingIssues: ['coughing'] },
      dinner: { time: '18:30', appetite: 3, amountEaten: 70, swallowingIssues: [] },
    },
    bloodPressure: '135/88',
    pulseRate: 78,
    oxygenLevel: 95,
    bloodSugar: 6.2,
    vitalsTime: '09:30',
    toileting: {
      bowelFrequency: 0,
      urineFrequency: 5,
      diaperChanges: 1,
      accidents: 'small urine leak',
      assistance: 'moderate',
      pain: 'none',
      urineColor: 'yellow',
      bowelConsistency: 'none',
    },
    emergencyFlag: false,
    notes: 'Seemed more confused than usual. Some coughing during breakfast.',
  },

  // Day 3 (4 days ago) - Medication timing issue
  {
    careRecipientId: CARE_RECIPIENT_ID,
    caregiverId: CAREGIVER_ID,
    logDate: daysAgo(4),
    timePeriod: 'morning',
    wakeTime: '07:45',
    mood: 'sleepy',
    showerTime: '08:15',
    hairWash: false,
    medications: [
      { name: 'Levodopa 100mg', given: true, time: '09:30', timeSlot: 'after_breakfast' },
      { name: 'Donepezil 5mg', given: false, time: null, timeSlot: 'after_breakfast' },
      { name: 'Multivitamin', given: true, time: '09:30', timeSlot: 'after_breakfast' },
    ],
    meals: {
      breakfast: { time: '09:00', appetite: 4, amountEaten: 75, swallowingIssues: [] },
      lunch: { time: '12:45', appetite: 4, amountEaten: 80, swallowingIssues: [] },
      dinner: { time: '18:15', appetite: 3, amountEaten: 70, swallowingIssues: ['coughing'] },
    },
    bloodPressure: '132/85',
    pulseRate: 74,
    oxygenLevel: 96,
    bloodSugar: 5.9,
    vitalsTime: '10:00',
    toileting: {
      bowelFrequency: 1,
      urineFrequency: 7,
      diaperChanges: 0,
      accidents: 'none',
      assistance: 'minimal',
      pain: 'none',
      urineColor: 'clear_yellow',
      bowelConsistency: 'soft',
    },
    emergencyFlag: false,
    notes: 'Donepezil missed - patient refused medication. Will try again tomorrow.',
  },

  // Day 4 (3 days ago) - Better day
  {
    careRecipientId: CARE_RECIPIENT_ID,
    caregiverId: CAREGIVER_ID,
    logDate: daysAgo(3),
    timePeriod: 'morning',
    wakeTime: '07:30',
    mood: 'calm',
    showerTime: '08:00',
    hairWash: true,
    medications: [
      { name: 'Levodopa 100mg', given: true, time: '08:20', timeSlot: 'after_breakfast' },
      { name: 'Donepezil 5mg', given: true, time: '08:20', timeSlot: 'after_breakfast' },
      { name: 'Multivitamin', given: true, time: '08:20', timeSlot: 'after_breakfast' },
    ],
    meals: {
      breakfast: { time: '08:40', appetite: 5, amountEaten: 95, swallowingIssues: [] },
      lunch: { time: '12:30', appetite: 5, amountEaten: 90, swallowingIssues: [] },
      dinner: { time: '18:00', appetite: 4, amountEaten: 85, swallowingIssues: [] },
    },
    bloodPressure: '125/80',
    pulseRate: 70,
    oxygenLevel: 98,
    bloodSugar: 5.6,
    vitalsTime: '09:00',
    toileting: {
      bowelFrequency: 1,
      urineFrequency: 6,
      diaperChanges: 0,
      accidents: 'none',
      assistance: 'minimal',
      pain: 'none',
      urineColor: 'clear_yellow',
      bowelConsistency: 'normal',
    },
    emergencyFlag: false,
    notes: 'Excellent day. Patient very cooperative and ate well.',
  },

  // Day 5 (2 days ago) - Vitals spike
  {
    careRecipientId: CARE_RECIPIENT_ID,
    caregiverId: CAREGIVER_ID,
    logDate: daysAgo(2),
    timePeriod: 'morning',
    wakeTime: '06:30',
    mood: 'agitated',
    showerTime: '07:30',
    hairWash: false,
    medications: [
      { name: 'Levodopa 100mg', given: true, time: '08:00', timeSlot: 'after_breakfast' },
      { name: 'Donepezil 5mg', given: true, time: '08:00', timeSlot: 'after_breakfast' },
      { name: 'Multivitamin', given: true, time: '08:00', timeSlot: 'after_breakfast' },
    ],
    meals: {
      breakfast: { time: '08:15', appetite: 2, amountEaten: 50, swallowingIssues: ['refused food'] },
      lunch: { time: '12:30', appetite: 3, amountEaten: 60, swallowingIssues: [] },
      dinner: { time: '18:00', appetite: 3, amountEaten: 65, swallowingIssues: [] },
    },
    bloodPressure: '148/92',
    pulseRate: 88,
    oxygenLevel: 94,
    bloodSugar: 7.1,
    vitalsTime: '08:30',
    toileting: {
      bowelFrequency: 0,
      urineFrequency: 4,
      diaperChanges: 2,
      accidents: 'moderate',
      assistance: 'full',
      pain: 'mild',
      urineColor: 'dark_yellow',
      bowelConsistency: 'none',
    },
    emergencyFlag: true,
    emergencyNote: 'BP elevated at 148/92. Patient agitated and refused breakfast. Monitored closely.',
    notes: 'Patient woke up agitated. BP higher than normal. Gave extra fluids.',
  },

  // Day 6 (yesterday) - Recovery
  {
    careRecipientId: CARE_RECIPIENT_ID,
    caregiverId: CAREGIVER_ID,
    logDate: daysAgo(1),
    timePeriod: 'morning',
    wakeTime: '07:45',
    mood: 'calm',
    showerTime: '08:15',
    hairWash: false,
    medications: [
      { name: 'Levodopa 100mg', given: true, time: '08:30', timeSlot: 'after_breakfast' },
      { name: 'Donepezil 5mg', given: true, time: '08:30', timeSlot: 'after_breakfast' },
      { name: 'Multivitamin', given: true, time: '08:30', timeSlot: 'after_breakfast' },
    ],
    meals: {
      breakfast: { time: '08:45', appetite: 4, amountEaten: 80, swallowingIssues: [] },
      lunch: { time: '12:30', appetite: 4, amountEaten: 85, swallowingIssues: [] },
      dinner: { time: '18:00', appetite: 4, amountEaten: 80, swallowingIssues: [] },
    },
    bloodPressure: '130/84',
    pulseRate: 75,
    oxygenLevel: 96,
    bloodSugar: 6.0,
    vitalsTime: '09:00',
    toileting: {
      bowelFrequency: 1,
      urineFrequency: 6,
      diaperChanges: 0,
      accidents: 'none',
      assistance: 'minimal',
      pain: 'none',
      urineColor: 'clear_yellow',
      bowelConsistency: 'soft',
    },
    emergencyFlag: false,
    notes: 'BP back to normal. Patient calmer today.',
  },

  // Day 7 (today) - Current day
  {
    careRecipientId: CARE_RECIPIENT_ID,
    caregiverId: CAREGIVER_ID,
    logDate: daysAgo(0),
    timePeriod: 'morning',
    wakeTime: '07:30',
    mood: 'alert',
    showerTime: '08:00',
    hairWash: true,
    medications: [
      { name: 'Levodopa 100mg', given: true, time: '08:15', timeSlot: 'after_breakfast' },
      { name: 'Donepezil 5mg', given: true, time: '08:15', timeSlot: 'after_breakfast' },
      { name: 'Multivitamin', given: true, time: '08:15', timeSlot: 'after_breakfast' },
    ],
    meals: {
      breakfast: { time: '08:30', appetite: 5, amountEaten: 90, swallowingIssues: [] },
      lunch: { time: '12:30', appetite: 4, amountEaten: 85, swallowingIssues: [] },
      dinner: { time: '18:00', appetite: 4, amountEaten: 85, swallowingIssues: [] },
    },
    bloodPressure: '126/82',
    pulseRate: 72,
    oxygenLevel: 97,
    bloodSugar: 5.7,
    vitalsTime: '09:00',
    toileting: {
      bowelFrequency: 1,
      urineFrequency: 6,
      diaperChanges: 0,
      accidents: 'none',
      assistance: 'minimal',
      pain: 'none',
      urineColor: 'clear_yellow',
      bowelConsistency: 'normal',
    },
    emergencyFlag: false,
    notes: 'Good morning routine. Patient alert and cooperative.',
  },
];

export async function seedTestData(db: any) {
  console.log('🌱 Seeding test care log data...');

  for (const log of testLogs) {
    await db.insert(careLogs).values(log);
  }

  console.log(`✅ Seeded ${testLogs.length} care log entries`);
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Run this via: pnpm db:seed-test');
}
