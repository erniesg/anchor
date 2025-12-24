import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useMutation } from '@tanstack/react-query';
import { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useAutoSave } from '@/hooks/use-auto-save';
import { Save, CheckCircle, AlertCircle, Clock, Backpack } from 'lucide-react';
import { authenticatedApiCall } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

// Helper component for required field indicator
const RequiredLabel = ({ children, required = false }: { children: React.ReactNode; required?: boolean }) => (
  <span className="block text-sm font-medium text-gray-700 mb-1">
    {children}
    {required && <span className="text-red-500 ml-0.5">*</span>}
  </span>
);

// Optional label helper
const OptionalLabel = ({ children }: { children: React.ReactNode }) => (
  <span className="block text-sm font-medium text-gray-700 mb-1">
    {children}
    <span className="text-gray-400 font-normal text-xs ml-1">(optional)</span>
  </span>
);

export const Route = createFileRoute('/caregiver/form-legacy')({
  component: CareLogFormComponent,
});

// Vital signs validation ranges
interface VitalAlert {
  level: 'normal' | 'warning' | 'critical';
  message: string;
}

// Calculate age from date of birth
const calculateAge = (dateOfBirth: Date | null): number | null => {
  if (!dateOfBirth) return null;
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

const validateVitals = (
  bloodPressure: string,
  pulseRate: string,
  oxygenLevel: string,
  bloodSugar: string,
  age: number | null = null,
  gender: string | null = null
): VitalAlert[] => {
  const alerts: VitalAlert[] = [];

  // Blood Pressure (format: "120/80") - Age and gender-adjusted
  if (bloodPressure) {
    const [systolic, diastolic] = bloodPressure.split('/').map(Number);
    if (systolic && diastolic) {
      // Critical ranges (universal)
      if (systolic >= 180 || diastolic >= 120) {
        alerts.push({ level: 'critical', message: `🚨 CRITICAL: Blood pressure ${bloodPressure} is dangerously high (Hypertensive Crisis)` });
      } else if (systolic < 90 || diastolic < 60) {
        alerts.push({ level: 'critical', message: `🚨 CRITICAL: Blood pressure ${bloodPressure} is dangerously low (Hypotension)` });
      } else {
        // Age-adjusted thresholds
        let systolicTarget = 130;
        let diastolicTarget = 80;

        if (age !== null) {
          if (age >= 80) {
            // For elderly 80+: More lenient targets (ACC/AHA 2017)
            systolicTarget = 140;
            diastolicTarget = 90;
          } else if (age >= 65) {
            // For seniors 65-79: Slightly relaxed
            systolicTarget = 135;
            diastolicTarget = 85;
          }
          // Under 65: Standard targets (130/80)
        }

        // Gender adjustments (women typically 5-10 mmHg lower until menopause)
        if (gender === 'female' && age && age < 55) {
          systolicTarget -= 5;
        }

        const ageNote = age ? ` (Target for ${age}yo ${gender || 'patient'}: <${systolicTarget}/${diastolicTarget})` : '';

        if (systolic >= systolicTarget + 10 || diastolic >= diastolicTarget + 10) {
          alerts.push({ level: 'warning', message: `⚠️ WARNING: Blood pressure ${bloodPressure} is elevated${ageNote}` });
        } else if (systolic >= systolicTarget || diastolic >= diastolicTarget) {
          alerts.push({ level: 'warning', message: `⚠️ CAUTION: Blood pressure ${bloodPressure} is slightly elevated${ageNote}` });
        }
      }
    }
  }

  // Pulse Rate (bpm)
  if (pulseRate) {
    const pulse = Number(pulseRate);
    if (pulse > 0) {
      if (pulse > 120) {
        alerts.push({ level: 'critical', message: `🚨 CRITICAL: Pulse ${pulse} bpm is dangerously high (Severe Tachycardia)` });
      } else if (pulse < 40) {
        alerts.push({ level: 'critical', message: `🚨 CRITICAL: Pulse ${pulse} bpm is dangerously low (Severe Bradycardia)` });
      } else if (pulse > 100) {
        alerts.push({ level: 'warning', message: `⚠️ WARNING: Pulse ${pulse} bpm is elevated (Tachycardia)` });
      } else if (pulse < 50) {
        alerts.push({ level: 'warning', message: `⚠️ WARNING: Pulse ${pulse} bpm is low (Bradycardia)` });
      }
    }
  }

  // Oxygen Level (%)
  if (oxygenLevel) {
    const o2 = Number(oxygenLevel);
    if (o2 > 0) {
      if (o2 < 90) {
        alerts.push({ level: 'critical', message: `🚨 CRITICAL: Oxygen level ${o2}% is dangerously low (Severe Hypoxemia) - SEEK IMMEDIATE MEDICAL ATTENTION` });
      } else if (o2 < 95) {
        alerts.push({ level: 'warning', message: `⚠️ WARNING: Oxygen level ${o2}% is below normal (Mild Hypoxemia)` });
      }
    }
  }

  // Blood Sugar (mmol/L - using Singapore/international standard)
  if (bloodSugar) {
    const sugar = Number(bloodSugar);
    if (sugar > 0) {
      if (sugar > 15) {
        alerts.push({ level: 'critical', message: `🚨 CRITICAL: Blood sugar ${sugar} mmol/L is dangerously high (Severe Hyperglycemia)` });
      } else if (sugar < 3.9) {
        alerts.push({ level: 'critical', message: `🚨 CRITICAL: Blood sugar ${sugar} mmol/L is dangerously low (Hypoglycemia)` });
      } else if (sugar > 11.1) {
        alerts.push({ level: 'warning', message: `⚠️ WARNING: Blood sugar ${sugar} mmol/L is elevated (Hyperglycemia)` });
      } else if (sugar < 4.4) {
        alerts.push({ level: 'warning', message: `⚠️ CAUTION: Blood sugar ${sugar} mmol/L is slightly low` });
      }
    }
  }

  return alerts;
};

// Helper function to calculate duration in minutes
const calculateDuration = (startTime: string, endTime: string): number => {
  if (!startTime || !endTime) return 0;

  const [startHour = 0, startMin = 0] = startTime.split(':').map(Number);
  const [endHour = 0, endMin = 0] = endTime.split(':').map(Number);

  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;

  return endMinutes - startMinutes;
};

// Section type for progressive submission
type SectionName = 'morning' | 'afternoon' | 'evening' | 'dailySummary';
type CompletedSections = Partial<Record<SectionName, { submittedAt: string; submittedBy: string }>>;

function CareLogFormComponent() {
  const navigate = useNavigate();
  const { token: caregiverToken, careRecipient: authCareRecipient } = useAuth();
  const [currentSection, setCurrentSection] = useState(1);
  const [careLogId, setCareLogId] = useState<string | null>(null);
  const [logStatus, setLogStatus] = useState<'draft' | 'submitted' | 'invalidated'>('draft');

  // Progressive Section Submission - tracks which sections are shared with family
  const [completedSections, setCompletedSections] = useState<CompletedSections>({});

  // Morning Routine
  const [wakeTime, setWakeTime] = useState('');
  const [mood, setMood] = useState('');
  const [showerTime, setShowerTime] = useState('');
  const [hairWash, setHairWash] = useState(false);

  // Medications (Sprint 2 Day 4: Added purpose and notes)
  const [medications, setMedications] = useState<Array<{
    name: string;
    given: boolean;
    time: string | null;
    timeSlot: 'before_breakfast' | 'after_breakfast' | 'afternoon';
    purpose: string;
    notes: string;
  }>>([
    { name: 'Glucophage 500mg', given: false, time: null, timeSlot: 'before_breakfast', purpose: '', notes: '' },
    { name: 'Forxiga 10mg', given: false, time: null, timeSlot: 'after_breakfast', purpose: '', notes: '' },
    { name: 'Ozempic 0.5mg', given: false, time: null, timeSlot: 'afternoon', purpose: '', notes: '' },
  ]);

  // Meals - Breakfast
  const [breakfastTime, setBreakfastTime] = useState('');
  const [breakfastAppetite, setBreakfastAppetite] = useState(0);
  const [breakfastAmount, setBreakfastAmount] = useState(0);
  const [breakfastAssistance, setBreakfastAssistance] = useState<'none' | 'some' | 'full'>('none');
  const [breakfastSwallowing, setBreakfastSwallowing] = useState<string[]>([]);

  // Meals - Lunch
  const [lunchTime, setLunchTime] = useState('');
  const [lunchAppetite, setLunchAppetite] = useState(0);
  const [lunchAmount, setLunchAmount] = useState(0);
  const [lunchAssistance, setLunchAssistance] = useState<'none' | 'some' | 'full'>('none');
  const [lunchSwallowing, setLunchSwallowing] = useState<string[]>([]);

  // Meals - Tea Break
  const [teaBreakTime, setTeaBreakTime] = useState('');
  const [teaBreakAppetite, setTeaBreakAppetite] = useState(0);
  const [teaBreakAmount, setTeaBreakAmount] = useState(0);
  const [teaBreakSwallowing, setTeaBreakSwallowing] = useState<string[]>([]);

  // Meals - Dinner
  const [dinnerTime, setDinnerTime] = useState('');
  const [dinnerAppetite, setDinnerAppetite] = useState(0);
  const [dinnerAmount, setDinnerAmount] = useState(0);
  const [dinnerAssistance, setDinnerAssistance] = useState<'none' | 'some' | 'full'>('none');
  const [dinnerSwallowing, setDinnerSwallowing] = useState<string[]>([]);

  // Meals - Notes
  const [foodPreferences, setFoodPreferences] = useState('');
  const [foodRefusals, setFoodRefusals] = useState('');

  // Vitals
  const [bloodPressure, setBloodPressure] = useState('');
  const [pulseRate, setPulseRate] = useState('');
  const [oxygenLevel, setOxygenLevel] = useState('');
  const [bloodSugar, setBloodSugar] = useState('');
  const [vitalsTime, setVitalsTime] = useState('');

  // Sprint 2 Day 2: Fluid Intake
  const [fluids, setFluids] = useState<Array<{
    name: string;
    time: string;
    amountMl: number;
    swallowingIssues: string[];
  }>>([]);

  // Sprint 2 Day 3: Sleep Tracking
  const [afternoonRest, setAfternoonRest] = useState<{
    startTime: string;
    endTime: string;
    quality: 'deep' | 'light' | 'restless' | 'no_sleep';
    notes?: string;
  } | null>(null);

  const [nightSleep, setNightSleep] = useState<{
    bedtime: string;
    quality: 'deep' | 'light' | 'restless' | 'no_sleep';
    wakings: number;
    wakingReasons: string[];
    behaviors: string[];
    notes?: string;
  } | null>(null);

  // Sprint 2 Day 5: Complete Toileting & Hygiene Tracking
  // Toileting & Hygiene (Consolidated)
  // Shared fields (asked once for the whole section)
  const [toiletingDiaperChanges, setToiletingDiaperChanges] = useState<number | null>(null);
  const [toiletingDiaperStatus, setToiletingDiaperStatus] = useState<'dry' | 'wet' | 'soiled' | null>(null);
  const [toiletingAccidents, setToiletingAccidents] = useState<'none' | 'minor' | 'major'>('none');
  const [toiletingAssistance, setToiletingAssistance] = useState<'none' | 'partial' | 'full'>('none');
  const [toiletingPain, setToiletingPain] = useState<'no_pain' | 'some_pain' | 'very_painful'>('no_pain');

  // Bowel-specific fields
  const [bowelFreq, setBowelFreq] = useState(0);
  const [bowelTimesUsedToilet, setBowelTimesUsedToilet] = useState<number | null>(null);
  const [bowelConsistency, setBowelConsistency] = useState<'normal' | 'hard' | 'soft' | 'loose' | 'diarrhea' | null>(null);
  const [bowelConcerns, setBowelConcerns] = useState('');

  // Urination-specific fields
  const [urineFreq, setUrineFreq] = useState(0);
  const [urineTimesUsedToilet, setUrineTimesUsedToilet] = useState<number | null>(null);
  const [urineColor, setUrineColor] = useState<'light_clear' | 'yellow' | 'dark_yellow' | 'brown' | 'dark' | null>(null);
  const [urineConcerns, setUrineConcerns] = useState('');

  // Legacy compatibility aliases
  const diaperChanges = toiletingDiaperChanges || 0;

  // Sprint 3 Day 1: Spiritual & Emotional Well-Being
  const [prayerStartTime, setPrayerStartTime] = useState('');
  const [prayerEndTime, setPrayerEndTime] = useState('');
  const [prayerExpression, setPrayerExpression] = useState<'speaking_out_loud' | 'whispering' | 'mumbling' | 'silent_worship' | ''>('');
  const [overallMood, setOverallMood] = useState<number | null>(null);
  const [communicationScale, setCommunicationScale] = useState<number | null>(null);
  const [socialInteraction, setSocialInteraction] = useState<'engaged' | 'responsive' | 'withdrawn' | 'aggressive_hostile' | ''>('');

  // Sprint 3 Day 2: Physical Activity & Exercise (simplified version - keeping for backward compatibility)
  const [exerciseDuration] = useState<number | null>(null);
  const [exerciseType] = useState<string[]>([]);
  const [walkingDistance] = useState('');
  const [assistanceLevel] = useState<'none' | 'minimal' | 'moderate' | 'full' | ''>('');
  const [painDuringActivity] = useState<'none' | 'mild' | 'moderate' | 'severe' | ''>('');
  const [energyAfterActivity] = useState<'energized' | 'tired' | 'exhausted' | 'same' | ''>('');
  const [participationWillingness] = useState<'enthusiastic' | 'willing' | 'reluctant' | 'refused' | ''>('');
  const [equipmentUsed] = useState<string[]>([]);
  const [mobilityNotes] = useState('');

  // Sprint 3 Day 4: Detailed Exercise Sessions
  // Morning Exercise Session
  const [morningExerciseStart, setMorningExerciseStart] = useState('');
  const [morningExerciseEnd, setMorningExerciseEnd] = useState('');
  const [morningExercises, setMorningExercises] = useState<Record<string, { done: boolean; duration: number; participation: number }>>({
    eyeExercises: { done: false, duration: 0, participation: 0 },
    armShoulderStrengthening: { done: false, duration: 0, participation: 0 },
    legStrengthening: { done: false, duration: 0, participation: 0 },
    balanceTraining: { done: false, duration: 0, participation: 0 },
    stretching: { done: false, duration: 0, participation: 0 },
    armPedalling: { done: false, duration: 0, participation: 0 },
    legPedalling: { done: false, duration: 0, participation: 0 },
    physiotherapistExercises: { done: false, duration: 0, participation: 0 },
  });
  const [morningExerciseNotes, setMorningExerciseNotes] = useState('');

  // Afternoon Exercise Session
  const [afternoonExerciseStart, setAfternoonExerciseStart] = useState('');
  const [afternoonExerciseEnd, setAfternoonExerciseEnd] = useState('');
  const [afternoonExercises, setAfternoonExercises] = useState<Record<string, { done: boolean; duration: number; participation: number }>>({
    eyeExercises: { done: false, duration: 0, participation: 0 },
    armShoulderStrengthening: { done: false, duration: 0, participation: 0 },
    legStrengthening: { done: false, duration: 0, participation: 0 },
    balanceTraining: { done: false, duration: 0, participation: 0 },
    stretching: { done: false, duration: 0, participation: 0 },
    armPedalling: { done: false, duration: 0, participation: 0 },
    legPedalling: { done: false, duration: 0, participation: 0 },
    physiotherapistExercises: { done: false, duration: 0, participation: 0 },
  });
  const [afternoonExerciseNotes, setAfternoonExerciseNotes] = useState('');

  // Movement Difficulties Assessment
  const [movementDifficulties, setMovementDifficulties] = useState<Record<string, { level: string; notes: string }>>({
    gettingOutOfBed: { level: '', notes: '' },
    gettingIntoBed: { level: '', notes: '' },
    sittingInChair: { level: '', notes: '' },
    gettingUpFromChair: { level: '', notes: '' },
    gettingInCar: { level: '', notes: '' },
    gettingOutOfCar: { level: '', notes: '' },
  });

  // Sprint 3 Day 3: Oral Care & Hygiene (placeholder - not yet implemented)
  // These will be used when Oral Care section is added to the form
  const [_teethBrushed] = useState(false);
  const [_timesBrushed] = useState<number | null>(null);
  const [_denturesCleaned] = useState(false);
  const [_mouthRinsed] = useState(false);
  const [_oralAssistanceLevel] = useState<'none' | 'minimal' | 'moderate' | 'full' | ''>('');
  const [_oralHealthIssues] = useState<string[]>([]);
  const [_painOrBleeding] = useState(false);
  const [_oralCareNotes] = useState('');
  // Suppress unused variable warnings - these are intentionally unused placeholders
  void _teethBrushed; void _timesBrushed; void _denturesCleaned; void _mouthRinsed;
  void _oralAssistanceLevel; void _oralHealthIssues; void _painOrBleeding; void _oralCareNotes;

  // Sprint 3 Day 5: Special Concerns & Incidents
  const [priorityLevel, setPriorityLevel] = useState<'emergency' | 'urgent' | 'routine' | ''>('');
  const [behaviouralChanges, setBehaviouralChanges] = useState<string[]>([]);
  const [physicalChanges, setPhysicalChanges] = useState('');
  const [incidentDescription, setIncidentDescription] = useState('');
  const [actionsTaken, setActionsTaken] = useState('');
  const [specialConcernsNotes, setSpecialConcernsNotes] = useState('');

  // Safety
  const [emergencyFlag, setEmergencyFlag] = useState(false);
  const [emergencyNote, setEmergencyNote] = useState('');
  const [notes, setNotes] = useState('');

  // Sprint 3 Day 3: Caregiver Notes (structured daily summary)
  const [whatWentWell, setWhatWentWell] = useState('');
  const [challengesFaced, setChallengesFaced] = useState('');
  const [recommendationsForTomorrow, setRecommendationsForTomorrow] = useState('');
  const [importantInfoForFamily, setImportantInfoForFamily] = useState('');
  const [caregiverSignature, setCaregiverSignature] = useState('');

  // Sprint 3 Day 4: Activities & Social Interaction
  const [phoneActivities, setPhoneActivities] = useState<('youtube' | 'texting' | 'calls' | 'none')[]>([]);
  const [engagementLevel, setEngagementLevel] = useState<number | null>(null);
  const [otherActivities, setOtherActivities] = useState<('phone' | 'conversation' | 'prayer' | 'reading' | 'watching_tv' | 'listening_music' | 'games' | 'none')[]>([]);
  const [relaxationPeriods, setRelaxationPeriods] = useState<Array<{
    startTime: string;
    endTime: string;
    activity: 'resting' | 'sleeping' | 'watching_tv' | 'listening_music' | 'quiet_time';
    mood: 'happy' | 'calm' | 'restless' | 'bored' | 'engaged';
  }>>([]);

  // Sprint 1: Fall Risk Assessment
  const [balanceIssues, setBalanceIssues] = useState<number | null>(null);
  const [nearFalls, setNearFalls] = useState<'none' | 'once_or_twice' | 'multiple'>('none');
  const [actualFalls, setActualFalls] = useState<'none' | 'minor' | 'major'>('none');
  const [walkingPattern, setWalkingPattern] = useState<string[]>([]);
  const [freezingEpisodes, setFreezingEpisodes] = useState<'none' | 'mild' | 'severe'>('none');

  // Sprint 1: Unaccompanied Time
  const [unaccompaniedTime, setUnaccompaniedTime] = useState<Array<{
    startTime: string;
    endTime: string;
    reason: string;
    replacementPerson: string;
    duration: number;
  }>>([]);
  const [unaccompaniedIncidents, setUnaccompaniedIncidents] = useState('');

  // Sprint 1: Safety Checks
  const [safetyChecks, setSafetyChecks] = useState({
    tripHazards: { checked: false, action: '' },
    cables: { checked: false, action: '' },
    sandals: { checked: false, action: '' },
    slipHazards: { checked: false, action: '' },
    mobilityAids: { checked: false, action: '' },
    emergencyEquipment: { checked: false, action: '' },
  });

  // Sprint 1: Emergency Prep
  const [emergencyPrep, setEmergencyPrep] = useState({
    icePack: false,
    wheelchair: false,
    commode: false,
    walkingStick: false,
    walker: false,
    bruiseOintment: false,
    firstAidKit: false,
  });

  // Environment & Safety: Room Maintenance
  const [roomMaintenance, setRoomMaintenance] = useState<{
    cleaningStatus: 'completed_by_maid' | 'caregiver_assisted' | 'not_done' | '';
    roomComfort: 'good_temperature' | 'too_hot' | 'too_cold' | '';
  }>({
    cleaningStatus: '',
    roomComfort: '',
  });

  // Environment & Safety: Personal Items Check
  const [personalItems, setPersonalItems] = useState({
    spectaclesCleaned: { checked: false, status: '' as 'clean' | 'need_cleaning' | '' },
    jewelryAccountedFor: { checked: false, status: '' as 'all_present' | 'missing_item' | '', notes: '' },
    handbagOrganized: { checked: false, status: '' as 'organized' | 'need_organizing' | '' },
  });

  // Environment & Safety: Hospital Bag Status
  const [hospitalBagStatus, setHospitalBagStatus] = useState({
    bagReady: false,
    location: '',
    lastChecked: false,
    notes: '',
  });

  // Get care recipient demographics for personalized validation (from AuthContext)
  const careRecipient = authCareRecipient;

  const recipientAge = useMemo(() => {
    if (!careRecipient?.dateOfBirth) return null;
    return calculateAge(new Date(careRecipient.dateOfBirth));
  }, [careRecipient]);

  const recipientGender = careRecipient?.gender || null;

  // Load existing draft on mount
  const [isLoadingDraft, setIsLoadingDraft] = useState(true);

  useEffect(() => {
    const loadDraft = async () => {
      if (!caregiverToken) {
        setIsLoadingDraft(false);
        return;
      }

      try {
        const response = await authenticatedApiCall('/care-logs/caregiver/today', caregiverToken);

        if (response) {
          console.log('📋 Loading existing draft:', response.id);

          // Set the care log ID so auto-save updates this draft
          setCareLogId(response.id);
          setLogStatus(response.status || 'draft');

          // Load completed sections
          if (response.completedSections) {
            setCompletedSections(response.completedSections);
          }

          // Morning Routine
          if (response.wakeTime) setWakeTime(response.wakeTime);
          if (response.mood) setMood(response.mood);
          if (response.showerTime) setShowerTime(response.showerTime);
          if (response.hairWash) setHairWash(response.hairWash);

          // Medications
          if (response.medications && Array.isArray(response.medications)) {
            setMedications(prev => {
              // Merge saved medications with default ones
              return prev.map(defaultMed => {
                const savedMed = response.medications.find(
                  (m: { name: string }) => m.name === defaultMed.name
                );
                return savedMed ? { ...defaultMed, ...savedMed } : defaultMed;
              });
            });
          }

          // Meals - Breakfast
          if (response.meals?.breakfast) {
            const b = response.meals.breakfast;
            if (b.time) setBreakfastTime(b.time);
            if (b.appetite) setBreakfastAppetite(b.appetite);
            if (b.amountEaten) setBreakfastAmount(b.amountEaten);
            if (b.assistance) setBreakfastAssistance(b.assistance);
            if (b.swallowingIssues) setBreakfastSwallowing(b.swallowingIssues);
          }

          // Meals - Lunch
          if (response.meals?.lunch) {
            const l = response.meals.lunch;
            if (l.time) setLunchTime(l.time);
            if (l.appetite) setLunchAppetite(l.appetite);
            if (l.amountEaten) setLunchAmount(l.amountEaten);
            if (l.assistance) setLunchAssistance(l.assistance);
            if (l.swallowingIssues) setLunchSwallowing(l.swallowingIssues);
          }

          // Meals - Tea Break
          if (response.meals?.teaBreak) {
            const t = response.meals.teaBreak;
            if (t.time) setTeaBreakTime(t.time);
            if (t.appetite) setTeaBreakAppetite(t.appetite);
            if (t.amountEaten) setTeaBreakAmount(t.amountEaten);
            if (t.swallowingIssues) setTeaBreakSwallowing(t.swallowingIssues);
          }

          // Meals - Dinner
          if (response.meals?.dinner) {
            const d = response.meals.dinner;
            if (d.time) setDinnerTime(d.time);
            if (d.appetite) setDinnerAppetite(d.appetite);
            if (d.amountEaten) setDinnerAmount(d.amountEaten);
            if (d.assistance) setDinnerAssistance(d.assistance);
            if (d.swallowingIssues) setDinnerSwallowing(d.swallowingIssues);
          }

          // Food Notes
          if (response.meals?.foodPreferences) setFoodPreferences(response.meals.foodPreferences);
          if (response.meals?.foodRefusals) setFoodRefusals(response.meals.foodRefusals);

          // Vitals
          if (response.bloodPressure) setBloodPressure(response.bloodPressure);
          if (response.pulseRate) setPulseRate(response.pulseRate.toString());
          if (response.oxygenLevel) setOxygenLevel(response.oxygenLevel.toString());
          if (response.bloodSugar) setBloodSugar(response.bloodSugar.toString());
          if (response.vitalsTime) setVitalsTime(response.vitalsTime);

          // Fluids
          if (response.fluids && Array.isArray(response.fluids)) {
            setFluids(response.fluids);
          }

          // Sleep
          if (response.afternoonRest) setAfternoonRest(response.afternoonRest);
          if (response.nightSleep) setNightSleep(response.nightSleep);

          // Fall Risk
          if (response.balanceIssues !== undefined) setBalanceIssues(response.balanceIssues);
          if (response.nearFalls) setNearFalls(response.nearFalls);
          if (response.actualFalls) setActualFalls(response.actualFalls);
          if (response.freezingEpisodes) setFreezingEpisodes(response.freezingEpisodes);
          if (response.walkingPattern) setWalkingPattern(response.walkingPattern);

          // Unaccompanied Time
          if (response.unaccompaniedTime && Array.isArray(response.unaccompaniedTime)) {
            setUnaccompaniedTime(response.unaccompaniedTime);
          }
          if (response.unaccompaniedIncidents) setUnaccompaniedIncidents(response.unaccompaniedIncidents);

          // Safety Checks
          if (response.safetyChecks) setSafetyChecks(response.safetyChecks);
          if (response.emergencyPrep) setEmergencyPrep(response.emergencyPrep);

          // Spiritual & Emotional
          if (response.spiritualEmotional) {
            const se = response.spiritualEmotional;
            if (se.prayerTime?.start) setPrayerStartTime(se.prayerTime.start);
            if (se.prayerTime?.end) setPrayerEndTime(se.prayerTime.end);
            if (se.prayerExpression) setPrayerExpression(se.prayerExpression);
            if (se.overallMood !== undefined) setOverallMood(se.overallMood);
            if (se.communicationScale !== undefined) setCommunicationScale(se.communicationScale);
            if (se.socialInteraction) setSocialInteraction(se.socialInteraction);
          }

          // Exercise
          if (response.morningExerciseSession) {
            const mes = response.morningExerciseSession;
            if (mes.startTime) setMorningExerciseStart(mes.startTime);
            if (mes.endTime) setMorningExerciseEnd(mes.endTime);
            if (mes.notes) setMorningExerciseNotes(mes.notes);
            if (mes.exercises && Array.isArray(mes.exercises)) {
              // Convert exercises array back to the record format
              const exercisesRecord: Record<string, { done: boolean; duration: number; participation: number }> = {
                eyeExercises: { done: false, duration: 0, participation: 0 },
                armShoulderStrengthening: { done: false, duration: 0, participation: 0 },
                legStrengthening: { done: false, duration: 0, participation: 0 },
                balanceTraining: { done: false, duration: 0, participation: 0 },
                stretching: { done: false, duration: 0, participation: 0 },
                armPedalling: { done: false, duration: 0, participation: 0 },
                legPedalling: { done: false, duration: 0, participation: 0 },
                physiotherapistExercises: { done: false, duration: 0, participation: 0 },
              };
              mes.exercises.forEach((ex: { type: string; done: boolean; duration: number; participation: number }) => {
                // Convert "Eye Exercises" back to "eyeExercises"
                const key = ex.type.replace(/\s+/g, '').replace(/^(.)/, (c: string) => c.toLowerCase());
                if (exercisesRecord[key]) {
                  exercisesRecord[key] = { done: ex.done, duration: ex.duration, participation: ex.participation };
                }
              });
              setMorningExercises(exercisesRecord);
            }
          }
          if (response.afternoonExerciseSession) {
            const aes = response.afternoonExerciseSession;
            if (aes.startTime) setAfternoonExerciseStart(aes.startTime);
            if (aes.endTime) setAfternoonExerciseEnd(aes.endTime);
            if (aes.notes) setAfternoonExerciseNotes(aes.notes);
            if (aes.exercises && Array.isArray(aes.exercises)) {
              const exercisesRecord: Record<string, { done: boolean; duration: number; participation: number }> = {
                eyeExercises: { done: false, duration: 0, participation: 0 },
                armShoulderStrengthening: { done: false, duration: 0, participation: 0 },
                legStrengthening: { done: false, duration: 0, participation: 0 },
                balanceTraining: { done: false, duration: 0, participation: 0 },
                stretching: { done: false, duration: 0, participation: 0 },
                armPedalling: { done: false, duration: 0, participation: 0 },
                legPedalling: { done: false, duration: 0, participation: 0 },
                physiotherapistExercises: { done: false, duration: 0, participation: 0 },
              };
              aes.exercises.forEach((ex: { type: string; done: boolean; duration: number; participation: number }) => {
                const key = ex.type.replace(/\s+/g, '').replace(/^(.)/, (c: string) => c.toLowerCase());
                if (exercisesRecord[key]) {
                  exercisesRecord[key] = { done: ex.done, duration: ex.duration, participation: ex.participation };
                }
              });
              setAfternoonExercises(exercisesRecord);
            }
          }
          if (response.movementDifficulties) setMovementDifficulties(response.movementDifficulties);

          // Toileting
          if (response.toileting) {
            const t = response.toileting;
            // Shared fields
            if (t.diaperChanges !== undefined) setToiletingDiaperChanges(t.diaperChanges);
            if (t.diaperStatus) setToiletingDiaperStatus(t.diaperStatus);
            if (t.accidents) setToiletingAccidents(t.accidents);
            if (t.assistance) setToiletingAssistance(t.assistance);
            if (t.pain) setToiletingPain(t.pain);
            // Bowel movements
            if (t.bowelMovements) {
              if (t.bowelMovements.frequency) setBowelFreq(t.bowelMovements.frequency);
              if (t.bowelMovements.timesUsedToilet !== undefined) setBowelTimesUsedToilet(t.bowelMovements.timesUsedToilet);
              if (t.bowelMovements.consistency) setBowelConsistency(t.bowelMovements.consistency);
              if (t.bowelMovements.concerns) setBowelConcerns(t.bowelMovements.concerns);
            }
            // Urination
            if (t.urination) {
              if (t.urination.frequency) setUrineFreq(t.urination.frequency);
              if (t.urination.timesUsedToilet !== undefined) setUrineTimesUsedToilet(t.urination.timesUsedToilet);
              if (t.urination.urineColor) setUrineColor(t.urination.urineColor);
              if (t.urination.concerns) setUrineConcerns(t.urination.concerns);
            }
          }

          // Special Concerns
          if (response.specialConcerns) {
            const sc = response.specialConcerns;
            if (sc.priority) setPriorityLevel(sc.priority);
            if (sc.behaviouralChanges) setBehaviouralChanges(sc.behaviouralChanges);
            if (sc.physicalChanges) setPhysicalChanges(sc.physicalChanges);
            if (sc.incident) setIncidentDescription(sc.incident);
            if (sc.actionsTaken) setActionsTaken(sc.actionsTaken);
            if (sc.notes) setSpecialConcernsNotes(sc.notes);
          }

          // Sprint 3 Day 3: Caregiver Notes
          if (response.caregiverNotes) {
            const cn = response.caregiverNotes;
            if (cn.whatWentWell) setWhatWentWell(cn.whatWentWell);
            if (cn.challengesFaced) setChallengesFaced(cn.challengesFaced);
            if (cn.recommendationsForTomorrow) setRecommendationsForTomorrow(cn.recommendationsForTomorrow);
            if (cn.importantInfoForFamily) setImportantInfoForFamily(cn.importantInfoForFamily);
            if (cn.caregiverSignature) setCaregiverSignature(cn.caregiverSignature);
          }

          // Sprint 3 Day 4: Activities & Social Interaction
          if (response.activities) {
            const act = response.activities;
            if (act.phoneActivities) setPhoneActivities(act.phoneActivities);
            if (act.engagementLevel) setEngagementLevel(act.engagementLevel);
            if (act.otherActivities) setOtherActivities(act.otherActivities);
            if (act.relaxationPeriods) setRelaxationPeriods(act.relaxationPeriods);
          }

          // Emergency & Notes
          if (response.emergencyFlag) setEmergencyFlag(response.emergencyFlag);
          if (response.emergencyNote) setEmergencyNote(response.emergencyNote);
          if (response.notes) setNotes(response.notes);
        }
      } catch (error) {
        console.log('No existing draft found or error loading:', error);
      } finally {
        setIsLoadingDraft(false);
      }
    };

    loadDraft();
  }, [caregiverToken]); // Only run on mount

  // Prepare form data
  const formData = useMemo(() => {
    const recipientId = careRecipient?.id;

    if (!recipientId) {
      console.error('No care recipient ID found');
    }

    // Helper to omit empty strings and null/undefined values
    const omitEmpty = (value: unknown) => {
      if (value === '' || value === null || value === undefined) return undefined;
      return value;
    };

    return {
      careRecipientId: recipientId,
      logDate: new Date().toISOString().split('T')[0],
      wakeTime: omitEmpty(wakeTime),
      mood: omitEmpty(mood),
      showerTime: omitEmpty(showerTime),
      hairWash: hairWash || undefined,
      medications: (() => {
        const given = medications.filter(med => med.given).map(med => ({
          ...med,
          time: omitEmpty(med.time), // Convert null to undefined
          purpose: omitEmpty(med.purpose), // Sprint 2 Day 4
          notes: omitEmpty(med.notes), // Sprint 2 Day 4
        }));
        return given.length > 0 ? given : undefined;
      })(),
      meals: (breakfastTime || lunchTime || teaBreakTime || dinnerTime || foodPreferences || foodRefusals) ? {
        breakfast: breakfastTime ? {
          time: breakfastTime,
          appetite: breakfastAppetite,
          amountEaten: breakfastAmount,
          swallowingIssues: breakfastSwallowing.length > 0 ? breakfastSwallowing : undefined,
          assistance: breakfastAssistance !== 'none' ? breakfastAssistance : undefined,
        } : undefined,
        lunch: lunchTime ? {
          time: lunchTime,
          appetite: lunchAppetite,
          amountEaten: lunchAmount,
          swallowingIssues: lunchSwallowing.length > 0 ? lunchSwallowing : undefined,
          assistance: lunchAssistance !== 'none' ? lunchAssistance : undefined,
        } : undefined,
        teaBreak: teaBreakTime ? {
          time: teaBreakTime,
          appetite: teaBreakAppetite,
          amountEaten: teaBreakAmount,
          swallowingIssues: teaBreakSwallowing.length > 0 ? teaBreakSwallowing : undefined,
        } : undefined,
        dinner: dinnerTime ? {
          time: dinnerTime,
          appetite: dinnerAppetite,
          amountEaten: dinnerAmount,
          swallowingIssues: dinnerSwallowing.length > 0 ? dinnerSwallowing : undefined,
          assistance: dinnerAssistance !== 'none' ? dinnerAssistance : undefined,
        } : undefined,
        foodPreferences: omitEmpty(foodPreferences),
        foodRefusals: omitEmpty(foodRefusals),
      } : undefined,
      // Sprint 2 Day 2: Fluid Intake
      fluids: fluids.length > 0 ? fluids : undefined,
      // Sprint 2 Day 3: Sleep Tracking - only send if times are valid (start < end)
      afternoonRest: afternoonRest && afternoonRest.startTime && afternoonRest.endTime &&
        afternoonRest.startTime < afternoonRest.endTime ? afternoonRest : undefined,
      nightSleep: nightSleep,
      bloodPressure: omitEmpty(bloodPressure),
      pulseRate: pulseRate ? parseInt(pulseRate) : undefined,
      oxygenLevel: oxygenLevel ? parseInt(oxygenLevel) : undefined,
      bloodSugar: bloodSugar ? parseFloat(bloodSugar) : undefined,
      vitalsTime: omitEmpty(vitalsTime),
      // Toileting & Hygiene (Consolidated structure)
      toileting: (bowelFreq > 0 || urineFreq > 0 || toiletingDiaperChanges) ? {
        // Shared fields (asked once)
        diaperChanges: toiletingDiaperChanges !== null ? toiletingDiaperChanges : undefined,
        diaperStatus: toiletingDiaperStatus || undefined,
        accidents: toiletingAccidents !== 'none' ? toiletingAccidents : undefined,
        assistance: toiletingAssistance !== 'none' ? toiletingAssistance : undefined,
        pain: toiletingPain !== 'no_pain' ? toiletingPain : undefined,
        // Bowel-specific
        bowelMovements: bowelFreq > 0 ? {
          frequency: bowelFreq,
          timesUsedToilet: bowelTimesUsedToilet !== null ? bowelTimesUsedToilet : undefined,
          consistency: bowelConsistency || undefined,
          concerns: omitEmpty(bowelConcerns),
        } : undefined,
        // Urination-specific
        urination: urineFreq > 0 ? {
          frequency: urineFreq,
          timesUsedToilet: urineTimesUsedToilet !== null ? urineTimesUsedToilet : undefined,
          urineColor: urineColor || undefined,
          concerns: omitEmpty(urineConcerns),
        } : undefined,
      } : undefined,
      // Sprint 1: Fall Risk & Safety
      balanceIssues: balanceIssues !== null ? balanceIssues : undefined,
      nearFalls: nearFalls !== 'none' ? nearFalls : undefined,
      actualFalls: actualFalls !== 'none' ? actualFalls : undefined,
      walkingPattern: walkingPattern.length > 0 ? walkingPattern : undefined,
      freezingEpisodes: freezingEpisodes !== 'none' ? freezingEpisodes : undefined,
      unaccompaniedTime: (() => {
        // Filter out entries with missing required fields (reason, valid times)
        const validEntries = unaccompaniedTime.filter(p =>
          p.startTime && p.endTime && p.reason && p.startTime < p.endTime
        ).map(p => ({
          ...p,
          durationMinutes: calculateDuration(p.startTime, p.endTime),
        }));
        return validEntries.length > 0 ? validEntries : undefined;
      })(),
      unaccompaniedIncidents: omitEmpty(unaccompaniedIncidents),
      safetyChecks: Object.values(safetyChecks).some(v => v.checked) ? safetyChecks : undefined,
      emergencyPrep: Object.values(emergencyPrep).some(v => v) ? emergencyPrep : undefined,
      // Environment & Safety: Additional fields
      roomMaintenance: (roomMaintenance.cleaningStatus || roomMaintenance.roomComfort) ? {
        ...(roomMaintenance.cleaningStatus ? { cleaningStatus: roomMaintenance.cleaningStatus } : {}),
        ...(roomMaintenance.roomComfort ? { roomComfort: roomMaintenance.roomComfort } : {}),
      } : undefined,
      personalItemsCheck: (() => {
        // Include items where checked=true, but omit empty status values (backend accepts undefined status)
        const validItems: Record<string, { checked: boolean; status?: string; notes?: string }> = {};
        if (personalItems.spectaclesCleaned.checked) {
          validItems.spectaclesCleaned = {
            checked: true,
            ...(personalItems.spectaclesCleaned.status ? { status: personalItems.spectaclesCleaned.status } : {}),
          };
        }
        if (personalItems.jewelryAccountedFor.checked) {
          validItems.jewelryAccountedFor = {
            checked: true,
            ...(personalItems.jewelryAccountedFor.status ? { status: personalItems.jewelryAccountedFor.status } : {}),
            ...(personalItems.jewelryAccountedFor.notes ? { notes: personalItems.jewelryAccountedFor.notes } : {}),
          };
        }
        if (personalItems.handbagOrganized.checked) {
          validItems.handbagOrganized = {
            checked: true,
            ...(personalItems.handbagOrganized.status ? { status: personalItems.handbagOrganized.status } : {}),
          };
        }
        return Object.keys(validItems).length > 0 ? validItems : undefined;
      })(),
      hospitalBagStatus: (hospitalBagStatus.bagReady || hospitalBagStatus.lastChecked || hospitalBagStatus.location || hospitalBagStatus.notes) ? hospitalBagStatus : undefined,
      // Sprint 3 Day 1: Spiritual & Emotional Well-Being
      spiritualEmotional: (prayerStartTime || prayerEndTime || prayerExpression || overallMood || communicationScale || socialInteraction) ? {
        prayerTime: (prayerStartTime && prayerEndTime) ? { start: prayerStartTime, end: prayerEndTime } : undefined,
        prayerExpression: prayerExpression || undefined,
        overallMood: overallMood !== null ? overallMood : undefined,
        communicationScale: communicationScale !== null ? communicationScale : undefined,
        socialInteraction: socialInteraction || undefined,
      } : undefined,
      // Sprint 3 Day 2: Physical Activity & Exercise
      physicalActivity: (exerciseDuration || exerciseType.length > 0 || walkingDistance || assistanceLevel || painDuringActivity || energyAfterActivity || participationWillingness || equipmentUsed.length > 0 || mobilityNotes) ? {
        exerciseDuration: exerciseDuration !== null ? exerciseDuration : undefined,
        exerciseType: exerciseType.length > 0 ? exerciseType : undefined,
        walkingDistance: omitEmpty(walkingDistance),
        assistanceLevel: assistanceLevel || undefined,
        painDuringActivity: painDuringActivity || undefined,
        energyAfterActivity: energyAfterActivity || undefined,
        participationWillingness: participationWillingness || undefined,
        equipmentUsed: equipmentUsed.length > 0 ? equipmentUsed : undefined,
        mobilityNotes: omitEmpty(mobilityNotes),
      } : undefined,
      // Sprint 3 Day 4: Detailed Exercise Sessions
      morningExerciseSession: (morningExerciseStart || morningExerciseEnd || Object.values(morningExercises).some(e => e.done) || morningExerciseNotes) ? {
        startTime: morningExerciseStart || undefined,
        endTime: morningExerciseEnd || undefined,
        exercises: Object.entries(morningExercises).filter(([_, e]) => e.done).map(([type, e]) => ({
          type: type.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim(),
          done: e.done,
          duration: e.duration,
          participation: e.participation,
        })),
        notes: omitEmpty(morningExerciseNotes),
      } : undefined,
      afternoonExerciseSession: (afternoonExerciseStart || afternoonExerciseEnd || Object.values(afternoonExercises).some(e => e.done) || afternoonExerciseNotes) ? {
        startTime: afternoonExerciseStart || undefined,
        endTime: afternoonExerciseEnd || undefined,
        exercises: Object.entries(afternoonExercises).filter(([_, e]) => e.done).map(([type, e]) => ({
          type: type.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim(),
          done: e.done,
          duration: e.duration,
          participation: e.participation,
        })),
        notes: omitEmpty(afternoonExerciseNotes),
      } : undefined,
      movementDifficulties: Object.values(movementDifficulties).some(d => d.level || d.notes) ?
        Object.fromEntries(
          Object.entries(movementDifficulties)
            .filter(([_, d]) => d.level || d.notes)
            .map(([key, d]) => [key, { level: d.level || undefined, notes: omitEmpty(d.notes) }])
        ) : undefined,
      // Sprint 3 Day 3: Oral Care & Hygiene - Hidden (not in template)
      /* oralCare: (teethBrushed || timesBrushed || denturesCleaned || mouthRinsed || oralAssistanceLevel || oralHealthIssues.length > 0 || painOrBleeding || oralCareNotes) ? {
        teethBrushed: teethBrushed || undefined,
        timesBrushed: timesBrushed !== null ? timesBrushed : undefined,
        denturesCleaned: denturesCleaned || undefined,
        mouthRinsed: mouthRinsed || undefined,
        assistanceLevel: oralAssistanceLevel || undefined,
        oralHealthIssues: oralHealthIssues.length > 0 ? oralHealthIssues : undefined,
        painOrBleeding: painOrBleeding || undefined,
        notes: omitEmpty(oralCareNotes),
      } : undefined, */
      // Sprint 3 Day 5: Special Concerns & Incidents
      specialConcerns: (priorityLevel || behaviouralChanges.length > 0 || physicalChanges || incidentDescription || actionsTaken || specialConcernsNotes) ? {
        priorityLevel: priorityLevel || undefined,
        behaviouralChanges: behaviouralChanges.length > 0 ? behaviouralChanges : undefined,
        physicalChanges: omitEmpty(physicalChanges),
        incidentDescription: omitEmpty(incidentDescription),
        actionsTaken: omitEmpty(actionsTaken),
        notes: omitEmpty(specialConcernsNotes),
      } : undefined,
      // Sprint 3 Day 3: Caregiver Notes (structured daily summary)
      caregiverNotes: (whatWentWell || challengesFaced || recommendationsForTomorrow || importantInfoForFamily || caregiverSignature) ? {
        whatWentWell: omitEmpty(whatWentWell),
        challengesFaced: omitEmpty(challengesFaced),
        recommendationsForTomorrow: omitEmpty(recommendationsForTomorrow),
        importantInfoForFamily: omitEmpty(importantInfoForFamily),
        caregiverSignature: omitEmpty(caregiverSignature),
      } : undefined,
      // Sprint 3 Day 4: Activities & Social Interaction
      activities: (phoneActivities.length > 0 || engagementLevel !== null || otherActivities.length > 0 || relaxationPeriods.length > 0) ? {
        phoneActivities: phoneActivities.length > 0 ? phoneActivities : undefined,
        engagementLevel: engagementLevel ?? undefined,
        otherActivities: otherActivities.length > 0 ? otherActivities : undefined,
        relaxationPeriods: relaxationPeriods.length > 0 ? relaxationPeriods : undefined,
      } : undefined,
      emergencyFlag,
      emergencyNote: omitEmpty(emergencyNote),
      notes: omitEmpty(notes),
    };
  }, [wakeTime, mood, showerTime, hairWash, medications,
      // Meals
      breakfastTime, breakfastAppetite, breakfastAmount, breakfastAssistance, breakfastSwallowing,
      lunchTime, lunchAppetite, lunchAmount, lunchAssistance, lunchSwallowing,
      teaBreakTime, teaBreakAppetite, teaBreakAmount, teaBreakSwallowing,
      dinnerTime, dinnerAppetite, dinnerAmount, dinnerAssistance, dinnerSwallowing,
      foodPreferences, foodRefusals,
      fluids, bloodPressure, pulseRate, oxygenLevel, bloodSugar, vitalsTime,
      // Toileting & Hygiene (Consolidated)
      toiletingDiaperChanges, toiletingDiaperStatus, toiletingAccidents, toiletingAssistance, toiletingPain,
      bowelFreq, bowelTimesUsedToilet, bowelConsistency, bowelConcerns,
      urineFreq, urineTimesUsedToilet, urineColor, urineConcerns,
      balanceIssues, nearFalls, actualFalls,
      walkingPattern, freezingEpisodes, unaccompaniedTime, unaccompaniedIncidents, safetyChecks, emergencyPrep,
      // Environment & Safety: Additional fields
      roomMaintenance, personalItems, hospitalBagStatus,
      // Sprint 3 Day 1: Spiritual & Emotional
      prayerStartTime, prayerEndTime, prayerExpression, overallMood, communicationScale, socialInteraction,
      // Sprint 3 Day 2: Physical Activity
      afternoonRest, nightSleep,
      exerciseDuration, exerciseType, walkingDistance, assistanceLevel, painDuringActivity, energyAfterActivity, participationWillingness, equipmentUsed, mobilityNotes,
      // Sprint 3 Day 4: Detailed Exercise Sessions
      morningExerciseStart, morningExerciseEnd, morningExercises, morningExerciseNotes,
      afternoonExerciseStart, afternoonExerciseEnd, afternoonExercises, afternoonExerciseNotes,
      movementDifficulties,
      // Sprint 3 Day 3: Oral Care - Dependencies removed because section is commented out
      // teethBrushed, timesBrushed, denturesCleaned, mouthRinsed, oralAssistanceLevel, oralHealthIssues, painOrBleeding, oralCareNotes,
      // Sprint 3 Day 5: Special Concerns
      priorityLevel, behaviouralChanges, physicalChanges, incidentDescription, actionsTaken, specialConcernsNotes,
      // Sprint 3 Day 3: Caregiver Notes
      whatWentWell, challengesFaced, recommendationsForTomorrow, importantInfoForFamily, caregiverSignature,
      // Sprint 3 Day 4: Activities & Social
      phoneActivities, engagementLevel, otherActivities, relaxationPeriods,
      emergencyFlag, emergencyNote, notes, careRecipient]);

  // Create/Update mutation (for auto-save)
  const saveDraftMutation = useMutation({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mutationFn: async (data: any) => {
      if (!caregiverToken) throw new Error('Not authenticated');
      const url = careLogId ? `/care-logs/${careLogId}` : '/care-logs';
      const method = careLogId ? 'PATCH' : 'POST';

      return authenticatedApiCall(url, caregiverToken, {
        method,
        body: JSON.stringify(data),
      });
    },
    onSuccess: (data) => {
      if (!careLogId && data.id) {
        setCareLogId(data.id);
      }
    },
  });

  // Submit mutation (final submission)
  const submitMutation = useMutation({
    mutationFn: async (logId: string) => {
      if (!caregiverToken) throw new Error('Not authenticated');
      if (!logId) throw new Error('No draft to submit');

      return authenticatedApiCall(`/care-logs/${logId}/submit`, caregiverToken, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      setLogStatus('submitted');
      // Don't use alert() - let the visual success message show instead
    },
  });

  // Progressive Section Submission mutation
  const submitSectionMutation = useMutation({
    mutationFn: async ({ logId, section }: { logId: string; section: SectionName }) => {
      if (!caregiverToken) throw new Error('Not authenticated');
      if (!logId) throw new Error('No draft to share');

      return authenticatedApiCall(`/care-logs/${logId}/submit-section`, caregiverToken, {
        method: 'POST',
        body: JSON.stringify({ section }),
      });
    },
    onSuccess: (data: { completedSections: CompletedSections }) => {
      // Update local state with the returned completedSections
      if (data?.completedSections) {
        setCompletedSections(data.completedSections);
      }
    },
  });

  // Auto-save hook
  const { lastSaved, isSaving } = useAutoSave({
    data: formData,
    onSave: async (data) => {
      await saveDraftMutation.mutateAsync(data);
    },
    interval: 30000, // 30 seconds
    enabled: true,
    isDraft: logStatus === 'draft',
  });

  const handleSubmit = async () => {
    try {
      // Validate care recipient ID
      if (!formData.careRecipientId) {
        alert('Error: No care recipient assigned. Please log in again.');
        navigate({ to: '/caregiver/login' });
        return;
      }

      // Save current draft first if needed
      if (!careLogId) {
        const draft = await saveDraftMutation.mutateAsync(formData);
        if (draft?.id) {
          setCareLogId(draft.id);
          // Wait a moment for state to update
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // Verify we have a careLogId
      const logIdToSubmit = careLogId || (await saveDraftMutation.mutateAsync(formData))?.id;
      if (!logIdToSubmit) {
        throw new Error('Failed to create draft log');
      }

      // Update state with the log ID if it wasn't set
      if (!careLogId && logIdToSubmit) {
        setCareLogId(logIdToSubmit);
      }

      // Then submit with the log ID
      await submitMutation.mutateAsync(logIdToSubmit);

      // Success! Status will be set by mutation onSuccess
      console.log('✅ Submit completed');
    } catch (error) {
      console.error('Submit error:', error);
      alert('Failed to submit. Please try again.');
    }
  };

  // Handle sharing a section with family (progressive submission)
  const handleShareSection = async (section: SectionName) => {
    try {
      // Ensure we have a draft saved first
      let logIdToShare = careLogId;
      if (!logIdToShare) {
        const draft = await saveDraftMutation.mutateAsync(formData);
        if (draft?.id) {
          setCareLogId(draft.id);
          logIdToShare = draft.id;
        }
      }

      if (!logIdToShare) {
        alert('Failed to save draft. Please try again.');
        return;
      }

      // Submit the section
      await submitSectionMutation.mutateAsync({ logId: logIdToShare, section });
      console.log(`✅ Section "${section}" shared with family`);
    } catch (error) {
      console.error('Share section error:', error);
      alert('Failed to share section. Please try again.');
    }
  };

  // Check if form is locked (submitted or invalidated)
  const isLocked = logStatus === 'submitted' || logStatus === 'invalidated';

  // Validation and section completion tracking
  // Rules:
  // - Green checkmark = section has data AND all conditionally required fields are properly filled
  // - Amber warning = section has data but missing required fields
  // - No indicator = no data entered (section is optional)
  const sectionValidation = useMemo(() => {
    // Track if any data has been entered in each section
    const morningRoutineData = Boolean(wakeTime || mood || showerTime || hairWash);
    const medicationsData = medications.some(med => med.given || med.time);
    const mealsData = Boolean(
      breakfastTime || breakfastAppetite > 0 || breakfastAmount > 0 ||
      lunchTime || lunchAppetite > 0 || lunchAmount > 0 ||
      teaBreakTime || teaBreakAppetite > 0 || teaBreakAmount > 0 ||
      dinnerTime || dinnerAppetite > 0 || dinnerAmount > 0 ||
      foodPreferences || foodRefusals
    );
    // Vital signs: only count as hasData if at least ONE actual measurement is entered (not just time)
    const vitalsData = Boolean(bloodPressure || pulseRate || oxygenLevel || bloodSugar);
    const toiletingData = bowelFreq > 0 || urineFreq > 0 || (toiletingDiaperChanges !== null && toiletingDiaperChanges > 0);

    // Section 6: Rest & Sleep - when enabled, times and quality are required
    const restSleepData = afternoonRest !== null || nightSleep !== null;
    const afternoonRestComplete = !afternoonRest || (
      afternoonRest.startTime &&
      afternoonRest.endTime &&
      afternoonRest.startTime < afternoonRest.endTime &&
      afternoonRest.quality
    );
    const nightSleepComplete = !nightSleep || (
      nightSleep.bedtime &&
      nightSleep.quality
    );

    // Section 7: Fall Risk & Safety
    const fallRiskData = balanceIssues !== null || nearFalls !== 'none' || actualFalls !== 'none' ||
                         walkingPattern.length > 0 || freezingEpisodes !== 'none';

    // Section 8: Unaccompanied Time - when periods added, need startTime, endTime, reason
    const unaccompaniedData = unaccompaniedTime.length > 0 || Boolean(unaccompaniedIncidents);
    const unaccompaniedComplete = unaccompaniedTime.every(period =>
      period.startTime && period.endTime && period.reason && period.startTime < period.endTime
    );

    // Section 9: Safety Checks
    const safetyChecksData = Object.values(safetyChecks).some(v => v.checked);

    // Section 10: Spiritual & Emotional
    const spiritualEmotionalData = Boolean(prayerStartTime || prayerEndTime || prayerExpression ||
                                   overallMood !== null || communicationScale !== null || socialInteraction);

    // Section 11: Physical Activity
    const physicalActivityData = exerciseDuration !== null || exerciseType.length > 0 || Boolean(walkingDistance) ||
                                 Boolean(assistanceLevel) || Boolean(painDuringActivity) || Boolean(energyAfterActivity) ||
                                 Boolean(participationWillingness) || equipmentUsed.length > 0 || Boolean(mobilityNotes);

    // Section 12: Special Concerns & Incidents
    const specialConcernsData = Boolean(priorityLevel || behaviouralChanges.length > 0 || physicalChanges ||
                                incidentDescription || actionsTaken || specialConcernsNotes);

    // Section 13: Notes & Submit
    const notesData = Boolean(notes || emergencyFlag);

    return {
      1: { // Morning Routine - all fields optional, always valid if any data entered
        complete: true,
        hasData: morningRoutineData,
        missing: [],
      },
      2: { // Medications - if marked as given, time is required
        complete: medications.every(med => !med.given || (med.given && med.time !== null && med.time !== '')),
        hasData: medicationsData,
        missing: medications
          .filter(med => med.given && (!med.time || med.time === ''))
          .map(med => `⏰ Time for ${med.name}`),
      },
      3: { // Meals & Nutrition - if time entered, need appetite and amount
        complete: (
          (!breakfastTime || (breakfastTime && breakfastAppetite > 0 && breakfastAmount > 0)) &&
          (!lunchTime || (lunchTime && lunchAppetite > 0 && lunchAmount > 0)) &&
          (!teaBreakTime || (teaBreakTime && teaBreakAppetite > 0 && teaBreakAmount > 0)) &&
          (!dinnerTime || (dinnerTime && dinnerAppetite > 0 && dinnerAmount > 0))
        ),
        hasData: mealsData,
        missing: [
          ...(breakfastTime && !breakfastAppetite ? ['🍽️ Breakfast appetite (1-5)'] : []),
          ...(breakfastTime && !breakfastAmount ? ['🍽️ Breakfast amount eaten (%)'] : []),
          ...(lunchTime && !lunchAppetite ? ['🍽️ Lunch appetite (1-5)'] : []),
          ...(lunchTime && !lunchAmount ? ['🍽️ Lunch amount eaten (%)'] : []),
          ...(teaBreakTime && !teaBreakAppetite ? ['🍽️ Tea break appetite (1-5)'] : []),
          ...(teaBreakTime && !teaBreakAmount ? ['🍽️ Tea break amount eaten (%)'] : []),
          ...(dinnerTime && !dinnerAppetite ? ['🍽️ Dinner appetite (1-5)'] : []),
          ...(dinnerTime && !dinnerAmount ? ['🍽️ Dinner amount eaten (%)'] : []),
        ],
      },
      4: { // Vital Signs - all optional
        complete: true,
        hasData: vitalsData,
        missing: [],
      },
      5: { // Toileting - all optional
        complete: true,
        hasData: toiletingData,
        missing: [],
      },
      6: { // Rest & Sleep - times and quality required when enabled
        complete: afternoonRestComplete && nightSleepComplete,
        hasData: restSleepData,
        missing: [
          ...(afternoonRest && !afternoonRest.startTime ? ['⏰ Afternoon rest start time'] : []),
          ...(afternoonRest && !afternoonRest.endTime ? ['⏰ Afternoon rest end time'] : []),
          ...(afternoonRest && afternoonRest.startTime && afternoonRest.endTime &&
              afternoonRest.startTime >= afternoonRest.endTime ? ['⚠️ End time must be after start time'] : []),
          ...(nightSleep && !nightSleep.bedtime ? ['⏰ Night sleep bedtime'] : []),
        ],
      },
      7: { // Fall Risk & Safety - all fields optional
        complete: true,
        hasData: fallRiskData,
        missing: [],
      },
      8: { // Unaccompanied Time - when periods added, need required fields
        complete: unaccompaniedComplete,
        hasData: unaccompaniedData,
        missing: unaccompaniedTime.flatMap((period, idx) => {
          const issues: string[] = [];
          if (!period.startTime) issues.push(`⏰ Period ${idx + 1}: Start time`);
          if (!period.endTime) issues.push(`⏰ Period ${idx + 1}: End time`);
          if (!period.reason) issues.push(`📝 Period ${idx + 1}: Reason`);
          if (period.startTime && period.endTime && period.startTime >= period.endTime) {
            issues.push(`⚠️ Period ${idx + 1}: End time must be after start time`);
          }
          return issues;
        }),
      },
      9: { // Safety Checks - optional
        complete: true,
        hasData: safetyChecksData,
        missing: [],
      },
      10: { // Spiritual & Emotional - optional
        complete: true,
        hasData: spiritualEmotionalData,
        missing: [],
      },
      11: { // Physical Activity - optional
        complete: true,
        hasData: physicalActivityData,
        missing: [],
      },
      12: { // Special Concerns - optional
        complete: true,
        hasData: specialConcernsData,
        missing: [],
      },
      13: { // Notes & Submit - optional
        complete: true,
        hasData: notesData,
        missing: [],
      },
    };
  }, [wakeTime, mood, showerTime, hairWash, medications,
      // All meals
      breakfastTime, breakfastAppetite, breakfastAmount,
      lunchTime, lunchAppetite, lunchAmount,
      teaBreakTime, teaBreakAppetite, teaBreakAmount,
      dinnerTime, dinnerAppetite, dinnerAmount,
      foodPreferences, foodRefusals,
      bloodPressure, pulseRate, oxygenLevel, bloodSugar, bowelFreq, urineFreq,
      afternoonRest, nightSleep,
      balanceIssues, nearFalls, actualFalls, walkingPattern, freezingEpisodes,
      unaccompaniedTime, unaccompaniedIncidents, safetyChecks,
      prayerStartTime, prayerEndTime, prayerExpression, overallMood, communicationScale, socialInteraction,
      exerciseDuration, exerciseType, walkingDistance, assistanceLevel, painDuringActivity, energyAfterActivity,
      participationWillingness, equipmentUsed, mobilityNotes,
      priorityLevel, behaviouralChanges, physicalChanges, incidentDescription, actionsTaken, specialConcernsNotes,
      whatWentWell, challengesFaced, recommendationsForTomorrow, importantInfoForFamily, caregiverSignature,
      phoneActivities, engagementLevel, otherActivities, relaxationPeriods,
      notes, emergencyFlag]);

  const allSectionsComplete = Object.values(sectionValidation).every(s => s.complete);
  const sectionsWithData = Object.values(sectionValidation).filter(s => s.hasData).length;
  const totalSections = Object.keys(sectionValidation).length;
  const completionPercentage = Math.round((sectionsWithData / totalSections) * 100);

  // Incomplete sections for future validation use
  // const incompleteSections = Object.entries(sectionValidation)
  //   .filter(([_, validation]) => !validation.complete)
  //   .map(([id]) => parseInt(id));

  const sections = [
    { id: 1, title: 'Morning Routine', emoji: '🌅' },
    { id: 2, title: 'Medications', emoji: '💊' },
    { id: 3, title: 'Meals & Nutrition', emoji: '🍽️' },
    { id: 4, title: 'Vital Signs', emoji: '❤️' },
    { id: 5, title: 'Toileting', emoji: '🚽' },
    { id: 6, title: 'Rest & Sleep', emoji: '😴' },
    { id: 7, title: 'Fall Risk & Safety', emoji: '⚠️' },
    { id: 8, title: 'Unaccompanied Time', emoji: '⏱️' },
    { id: 9, title: 'Safety Checks', emoji: '🔒' },
    { id: 10, title: 'Spiritual & Emotional', emoji: '🙏' },
    { id: 11, title: 'Physical Activity', emoji: '🏃' },
    // { id: 12, title: 'Oral Care', emoji: '🦷' }, // Hidden - not in template
    { id: 12, title: 'Special Concerns', emoji: '⚠️' }, // Sprint 3 Day 5
    { id: 13, title: 'Notes & Submit', emoji: '📝' },
  ];

  // Show loading state while fetching draft
  if (isLoadingDraft) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-accent-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your care report...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-accent-50 pb-8">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-10 border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-primary-700">Daily Care Report</h1>
              <p className="text-sm text-gray-600">Today: {new Date().toLocaleDateString()}</p>
            </div>

            {/* Auto-save status and Quick Links */}
            <div className="flex items-center gap-3">
              {/* Pack List Quick Link */}
              <Button
                onClick={() => navigate({ to: '/caregiver/pack-list' })}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <Backpack className="h-4 w-4" />
                <span className="hidden sm:inline">Pack List</span>
              </Button>

              {logStatus === 'draft' && (
                <div className="flex items-center gap-2 text-sm">
                  {isSaving ? (
                    <>
                      <Save className="h-4 w-4 animate-pulse text-blue-600" />
                      <span className="text-gray-600">Saving...</span>
                    </>
                  ) : lastSaved ? (
                    <>
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-gray-600">
                        Saved {new Date(lastSaved).toLocaleTimeString()}
                      </span>
                    </>
                  ) : (
                    <>
                      <Clock className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-400">
                        {completionPercentage}% complete
                      </span>
                    </>
                  )}
                </div>
              )}
              {logStatus === 'submitted' && (
                <div className="flex items-center gap-2 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                  <CheckCircle className="h-4 w-4" />
                  Submitted
                </div>
              )}
              {logStatus === 'invalidated' && (
                <div className="flex items-center gap-2 px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
                  <AlertCircle className="h-4 w-4" />
                  Needs Correction
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Section Navigation */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {sections.map(section => {
            const validation = sectionValidation[section.id as keyof typeof sectionValidation];
            const isComplete = validation?.complete ?? true;
            const hasData = validation?.hasData ?? false;
            const isIncomplete = !isComplete;

            return (
              <button
                key={section.id}
                onClick={() => setCurrentSection(section.id)}
                className={`flex-shrink-0 px-4 py-2 rounded-lg font-medium transition-colors relative ${
                  currentSection === section.id
                    ? 'bg-primary-600 text-white'
                    : isIncomplete
                    ? 'bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-300'
                    : hasData
                    ? 'bg-green-50 text-green-900 hover:bg-green-100 border border-green-300'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="mr-2">{section.emoji}</span>
                {section.title}
                {hasData && isComplete && currentSection !== section.id && (
                  <CheckCircle className="inline-block ml-2 h-4 w-4 text-green-600" />
                )}
                {isIncomplete && (
                  <AlertCircle className="inline-block ml-2 h-4 w-4 text-amber-600" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Form Sections */}
      <div className="max-w-4xl mx-auto px-4">
        {/* Section 1: Morning Routine */}
        {currentSection === 1 && (
          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold">🌅 Morning Routine</h2>
              <p className="text-sm text-gray-500 mt-1">All fields are optional. Fill in what applies to today.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLocked && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4">
                  <p className="text-sm text-gray-600 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    This form is locked and cannot be edited.
                  </p>
                </div>
              )}

              <Input
                label="Wake Up Time"
                type="time"
                value={wakeTime}
                onChange={(e) => setWakeTime(e.target.value)}
                helperText="When did they wake up today?"
                disabled={isLocked}
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Mood</label>
                <div className="grid grid-cols-2 gap-2">
                  {['alert', 'confused', 'sleepy', 'agitated', 'calm'].map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => !isLocked && setMood(m)}
                      disabled={isLocked}
                      className={`p-3 rounded-lg border-2 transition-colors ${
                        mood === m
                          ? 'border-primary-500 bg-primary-50 text-primary-700'
                          : 'border-gray-200 hover:border-gray-300'
                      } ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {m.charAt(0).toUpperCase() + m.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <Input
                label="Shower Time"
                type="time"
                value={showerTime}
                onChange={(e) => setShowerTime(e.target.value)}
                disabled={isLocked}
              />

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="hairWash"
                  checked={hairWash}
                  onChange={(e) => setHairWash(e.target.checked)}
                  className="w-5 h-5 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
                <label htmlFor="hairWash" className="text-sm font-medium text-gray-700">
                  Hair was washed today
                </label>
              </div>

              <Button onClick={() => setCurrentSection(2)} variant="primary" size="lg" className="w-full">
                Next: Medications →
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Section 2: Medications */}
        {currentSection === 2 && (
          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold">💊 Medications</h2>
              <p className="text-sm text-gray-500 mt-1">
                All fields optional. <span className="font-medium text-gray-700">Time<span className="text-red-500">*</span> required when medication is marked as given.</span>
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {medications.map((med, idx) => (
                <div key={idx} className="border-2 border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <label className="font-medium text-gray-900">{med.name}</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={med.given}
                        onChange={(e) => {
                          const newMeds = [...medications];
                          newMeds[idx].given = e.target.checked;
                          if (e.target.checked && !newMeds[idx].time) {
                            newMeds[idx].time = new Date().toTimeString().slice(0, 5);
                          }
                          setMedications(newMeds);
                        }}
                        className="w-5 h-5"
                      />
                      <span className="text-sm text-gray-600">Given</span>
                    </div>
                  </div>

                  {/* Sprint 2 Day 4: Purpose field */}
                  <div className="mb-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Purpose
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., Diabetes control, Blood pressure"
                      value={med.purpose || ''}
                      onChange={(e) => {
                        const newMeds = [...medications];
                        newMeds[idx].purpose = e.target.value;
                        setMedications(newMeds);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    />
                  </div>

                  {med.given && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Time given<span className="text-red-500">*</span>
                      </label>
                      <Input
                        type="time"
                        value={med.time || ''}
                        onChange={(e) => {
                          const newMeds = [...medications];
                          newMeds[idx].time = e.target.value;
                          setMedications(newMeds);
                        }}
                        className={!med.time ? 'border-red-300' : ''}
                      />
                      {!med.time && (
                        <p className="text-xs text-red-500 mt-1">Time is required when medication is given</p>
                      )}
                    </div>
                  )}

                  {/* Sprint 2 Day 4: Notes field */}
                  <div className="mt-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Notes
                    </label>
                    <textarea
                      placeholder="e.g., Take with food, Patient refused"
                      value={med.notes || ''}
                      onChange={(e) => {
                        const newMeds = [...medications];
                        newMeds[idx].notes = e.target.value;
                        setMedications(newMeds);
                      }}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    />
                  </div>
                </div>
              ))}

              <div className="flex gap-3">
                <Button onClick={() => setCurrentSection(1)} variant="outline" className="flex-1">
                  ← Back
                </Button>
                <Button onClick={() => setCurrentSection(3)} variant="primary" className="flex-1">
                  Next →
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Section 3: Meals */}
        {currentSection === 3 && (
          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold">🍽️ Meals & Nutrition</h2>
              <p className="text-sm text-gray-500 mt-1">
                All fields are optional. <span className="font-medium text-gray-700">If you enter a meal time, appetite<span className="text-red-500">*</span> and amount<span className="text-red-500">*</span> are required.</span>
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Breakfast */}
              <div className="border-b pb-6">
                <h3 className="font-semibold mb-3">🌅 Breakfast</h3>
                <Input
                  label="Time"
                  type="time"
                  value={breakfastTime}
                  onChange={(e) => setBreakfastTime(e.target.value)}
                  className="mb-3"
                />
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Appetite (1-5){breakfastTime && <span className="text-red-500">*</span>}: <span className="font-bold text-primary-600">{breakfastAppetite}</span>
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={breakfastAppetite}
                    onChange={(e) => setBreakfastAppetite(parseInt(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>No appetite</span>
                    <span>Excellent</span>
                  </div>
                </div>
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Amount Eaten{breakfastTime && <span className="text-red-500">*</span>}: <span className="font-bold text-primary-600">{breakfastAmount}%</span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="25"
                    value={breakfastAmount}
                    onChange={(e) => setBreakfastAmount(parseInt(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>0%</span>
                    <span>25%</span>
                    <span>50%</span>
                    <span>75%</span>
                    <span>100%</span>
                  </div>
                </div>
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Eating Assistance</label>
                  <div className="flex gap-2">
                    {(['none', 'some', 'full'] as const).map((level) => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => setBreakfastAssistance(level)}
                        className={`flex-1 py-2 px-3 rounded-lg border text-sm ${
                          breakfastAssistance === level
                            ? 'bg-primary-100 border-primary-500 text-primary-700'
                            : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {level === 'none' ? 'Independent' : level === 'some' ? 'Some Help' : 'Full Assist'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Lunch */}
              <div className="border-b pb-6">
                <h3 className="font-semibold mb-3">☀️ Lunch</h3>
                <Input
                  label="Time"
                  type="time"
                  value={lunchTime}
                  onChange={(e) => setLunchTime(e.target.value)}
                  className="mb-3"
                />
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Appetite (1-5){lunchTime && <span className="text-red-500">*</span>}: <span className="font-bold text-primary-600">{lunchAppetite}</span>
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={lunchAppetite}
                    onChange={(e) => setLunchAppetite(parseInt(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>No appetite</span>
                    <span>Excellent</span>
                  </div>
                </div>
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Amount Eaten{lunchTime && <span className="text-red-500">*</span>}: <span className="font-bold text-primary-600">{lunchAmount}%</span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="25"
                    value={lunchAmount}
                    onChange={(e) => setLunchAmount(parseInt(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>0%</span>
                    <span>25%</span>
                    <span>50%</span>
                    <span>75%</span>
                    <span>100%</span>
                  </div>
                </div>
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Eating Assistance</label>
                  <div className="flex gap-2">
                    {(['none', 'some', 'full'] as const).map((level) => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => setLunchAssistance(level)}
                        className={`flex-1 py-2 px-3 rounded-lg border text-sm ${
                          lunchAssistance === level
                            ? 'bg-primary-100 border-primary-500 text-primary-700'
                            : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {level === 'none' ? 'Independent' : level === 'some' ? 'Some Help' : 'Full Assist'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Tea Break */}
              <div className="border-b pb-6">
                <h3 className="font-semibold mb-3">🍵 Tea Break</h3>
                <Input
                  label="Time"
                  type="time"
                  value={teaBreakTime}
                  onChange={(e) => setTeaBreakTime(e.target.value)}
                  className="mb-3"
                />
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Appetite (1-5){teaBreakTime && <span className="text-red-500">*</span>}: <span className="font-bold text-primary-600">{teaBreakAppetite}</span>
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={teaBreakAppetite}
                    onChange={(e) => setTeaBreakAppetite(parseInt(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>No appetite</span>
                    <span>Excellent</span>
                  </div>
                </div>
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Amount Eaten{teaBreakTime && <span className="text-red-500">*</span>}: <span className="font-bold text-primary-600">{teaBreakAmount}%</span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="25"
                    value={teaBreakAmount}
                    onChange={(e) => setTeaBreakAmount(parseInt(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>0%</span>
                    <span>25%</span>
                    <span>50%</span>
                    <span>75%</span>
                    <span>100%</span>
                  </div>
                </div>
              </div>

              {/* Dinner */}
              <div className="border-b pb-6">
                <h3 className="font-semibold mb-3">🌙 Dinner</h3>
                <Input
                  label="Time"
                  type="time"
                  value={dinnerTime}
                  onChange={(e) => setDinnerTime(e.target.value)}
                  className="mb-3"
                />
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Appetite (1-5){dinnerTime && <span className="text-red-500">*</span>}: <span className="font-bold text-primary-600">{dinnerAppetite}</span>
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={dinnerAppetite}
                    onChange={(e) => setDinnerAppetite(parseInt(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>No appetite</span>
                    <span>Excellent</span>
                  </div>
                </div>
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Amount Eaten{dinnerTime && <span className="text-red-500">*</span>}: <span className="font-bold text-primary-600">{dinnerAmount}%</span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="25"
                    value={dinnerAmount}
                    onChange={(e) => setDinnerAmount(parseInt(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>0%</span>
                    <span>25%</span>
                    <span>50%</span>
                    <span>75%</span>
                    <span>100%</span>
                  </div>
                </div>
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Eating Assistance</label>
                  <div className="flex gap-2">
                    {(['none', 'some', 'full'] as const).map((level) => (
                      <button
                        key={level}
                        type="button"
                        onClick={() => setDinnerAssistance(level)}
                        className={`flex-1 py-2 px-3 rounded-lg border text-sm ${
                          dinnerAssistance === level
                            ? 'bg-primary-100 border-primary-500 text-primary-700'
                            : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {level === 'none' ? 'Independent' : level === 'some' ? 'Some Help' : 'Full Assist'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Food Notes */}
              <div>
                <h3 className="font-semibold mb-3">📝 Food Notes</h3>
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Food Preferences Today</label>
                  <textarea
                    value={foodPreferences}
                    onChange={(e) => setFoodPreferences(e.target.value)}
                    placeholder="e.g., Enjoyed the soup, asked for more rice..."
                    className="w-full p-3 border rounded-lg resize-none"
                    rows={2}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Food Refusals / Dislikes</label>
                  <textarea
                    value={foodRefusals}
                    onChange={(e) => setFoodRefusals(e.target.value)}
                    placeholder="e.g., Refused vegetables, said meat was too tough..."
                    className="w-full p-3 border rounded-lg resize-none"
                    rows={2}
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <Button onClick={() => setCurrentSection(2)} variant="outline" className="flex-1">
                  ← Back
                </Button>
                <Button onClick={() => setCurrentSection(4)} variant="primary" className="flex-1">
                  Next: Vital Signs →
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Fluid Intake - Sprint 2 Day 2 (Hidden from main flow) */}
        {currentSection === 30 && (
          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold">💧 Fluid Intake Monitoring</h2>
              <p className="text-sm text-gray-600 mt-1">Track all fluids consumed today</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Total Fluid Intake Display */}
              <div
                data-testid="total-fluid-intake"
                className={`rounded-lg p-4 ${
                  fluids.reduce((sum, f) => sum + f.amountMl, 0) < 1000
                    ? 'bg-yellow-50 border-2 border-yellow-200'
                    : 'bg-green-50 border-2 border-green-200'
                }`}
              >
                <p className="text-lg font-bold text-gray-900">
                  Total daily fluid intake: {fluids.reduce((sum, f) => sum + f.amountMl, 0)} ml
                </p>
                {fluids.reduce((sum, f) => sum + f.amountMl, 0) < 1000 && (
                  <div data-testid="low-fluid-warning" className="mt-2">
                    <p className="text-sm text-yellow-800 font-semibold">
                      ⚠️ Low fluid intake (&lt;1000ml) - Dehydration risk
                    </p>
                    <p className="text-xs text-yellow-700 mt-1">
                      Recommended: 1500-2000ml per day
                    </p>
                  </div>
                )}
                {fluids.reduce((sum, f) => sum + f.amountMl, 0) >= 1000 && (
                  <div data-testid="fluid-status" className="mt-2">
                    <p className="text-sm text-green-800 font-semibold">
                      ✅ Adequate hydration
                    </p>
                  </div>
                )}
              </div>

              {/* Fluid Entries */}
              {fluids.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <p>No fluid entries yet</p>
                  <p className="text-sm mt-1">Click "Add Fluid Entry" to start tracking</p>
                </div>
              )}

              {fluids.map((fluid, idx) => (
                <div
                  key={idx}
                  data-testid={`fluid-entry-${idx}`}
                  className="border-2 border-gray-200 rounded-lg p-4 bg-white"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-gray-700">Fluid Entry {idx + 1}</h4>
                    <button
                      type="button"
                      data-testid={`remove-fluid-${idx}`}
                      onClick={() => {
                        setFluids(fluids.filter((_, i) => i !== idx));
                      }}
                      className="text-red-600 hover:text-red-800 text-sm font-medium"
                    >
                      Remove
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                    {/* Beverage Selection */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Beverage *
                      </label>
                      <select
                        name={`fluids.${idx}.name`}
                        value={fluid.name}
                        onChange={(e) => {
                          const newFluids = [...fluids];
                          newFluids[idx].name = e.target.value;
                          setFluids(newFluids);
                        }}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">Select beverage</option>
                        <option value="Glucerna Milk">Glucerna Milk</option>
                        <option value="Moringa Water">Moringa Water</option>
                        <option value="Fenugreek Water">Fenugreek Water</option>
                        <option value="Orange Juice">Orange Juice</option>
                        <option value="Cucumber Juice">Cucumber Juice</option>
                        <option value="Plain Water">Plain Water</option>
                        <option value="Tea">Tea</option>
                        <option value="Coffee">Coffee</option>
                        <option value="Soup">Soup</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    {/* Time */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Time *
                      </label>
                      <input
                        type="time"
                        name={`fluids.${idx}.time`}
                        value={fluid.time}
                        onChange={(e) => {
                          const newFluids = [...fluids];
                          newFluids[idx].time = e.target.value;
                          setFluids(newFluids);
                        }}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>

                    {/* Amount (ml) */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Amount (ml) *
                      </label>
                      <input
                        type="number"
                        name={`fluids.${idx}.amountMl`}
                        value={fluid.amountMl || ''}
                        onChange={(e) => {
                          const newFluids = [...fluids];
                          newFluids[idx].amountMl = parseInt(e.target.value) || 0;
                          setFluids(newFluids);
                        }}
                        min="0"
                        required
                        placeholder="e.g., 250"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {/* Swallowing Issues */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Swallowing Issues
                    </label>
                    <div className="flex flex-wrap gap-4">
                      {['Coughing', 'Choking', 'Slow', 'None'].map((issue) => (
                        <label key={issue} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            name={`fluids.${idx}.swallowingIssues.${issue.toLowerCase()}`}
                            checked={fluid.swallowingIssues.includes(issue.toLowerCase())}
                            onChange={(e) => {
                              const newFluids = [...fluids];
                              if (e.target.checked) {
                                newFluids[idx].swallowingIssues = [
                                  ...newFluids[idx].swallowingIssues,
                                  issue.toLowerCase(),
                                ];
                              } else {
                                newFluids[idx].swallowingIssues = newFluids[
                                  idx
                                ].swallowingIssues.filter((i) => i !== issue.toLowerCase());
                              }
                              setFluids(newFluids);
                            }}
                            className="rounded"
                          />
                          <span className="text-sm text-gray-700">{issue}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              ))}

              {/* Add Fluid Entry Button */}
              <button
                type="button"
                onClick={() => {
                  setFluids([
                    ...fluids,
                    {
                      name: '',
                      time: '',
                      amountMl: 0,
                      swallowingIssues: [],
                    },
                  ]);
                }}
                className="w-full py-3 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
              >
                + Add Fluid Entry
              </button>

              {/* Navigation */}
              <div className="flex gap-3">
                <Button onClick={() => setCurrentSection(3)} variant="outline" className="flex-1">
                  ← Back
                </Button>
                <Button onClick={() => setCurrentSection(5)} variant="primary" className="flex-1">
                  Next: Sleep Tracking →
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Section 6: Sleep Tracking - Sprint 2 Day 3 */}
        {currentSection === 6 && (
          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold">😴 Rest & Sleep</h2>
              <p className="text-sm text-gray-500 mt-1">
                All fields optional. <span className="font-medium text-gray-700">When recording rest/sleep, start time<span className="text-red-500">*</span>, end time<span className="text-red-500">*</span>, and quality<span className="text-red-500">*</span> are required.</span>
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Afternoon Rest */}
              <div className="border-b pb-4">
                <h3 className="font-semibold mb-3">Afternoon Rest</h3>
                <div className="flex items-center gap-2 mb-4">
                  <input
                    type="checkbox"
                    checked={afternoonRest !== null}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setAfternoonRest({
                          startTime: '',
                          endTime: '',
                          quality: 'light',
                          notes: '',
                        });
                      } else {
                        setAfternoonRest(null);
                      }
                    }}
                    className="w-4 h-4"
                  />
                  <label className="text-sm font-medium">Had afternoon rest today</label>
                </div>

                {afternoonRest && (
                  <div className="space-y-4 pl-6 border-l-2 border-blue-200">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Start Time <span className="text-red-500">*</span></label>
                        <Input
                          type="time"
                          value={afternoonRest.startTime}
                          onChange={(e) => setAfternoonRest({ ...afternoonRest, startTime: e.target.value })}
                          required
                          className={!afternoonRest.startTime ? 'border-red-300' : ''}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">End Time <span className="text-red-500">*</span></label>
                        <Input
                          type="time"
                          value={afternoonRest.endTime}
                          onChange={(e) => setAfternoonRest({ ...afternoonRest, endTime: e.target.value })}
                          required
                          className={!afternoonRest.endTime ? 'border-red-300' : ''}
                        />
                      </div>
                    </div>

                    {afternoonRest.startTime && afternoonRest.endTime && afternoonRest.startTime >= afternoonRest.endTime && (
                      <p className="text-sm text-red-600 font-medium">
                        ⚠️ End time must be after start time
                      </p>
                    )}
                    {afternoonRest.startTime && afternoonRest.endTime && afternoonRest.startTime < afternoonRest.endTime && (
                      <p className="text-sm text-gray-600">
                        Duration: {calculateDuration(afternoonRest.startTime, afternoonRest.endTime)} minutes
                      </p>
                    )}

                    <div>
                      <label className="block text-sm font-medium mb-2">Sleep Quality <span className="text-red-500">*</span></label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { value: 'deep', label: '💤 Deep Sleep', color: 'bg-green-100 border-green-300' },
                          { value: 'light', label: '😌 Light Sleep', color: 'bg-blue-100 border-blue-300' },
                          { value: 'restless', label: '😟 Restless', color: 'bg-yellow-100 border-yellow-300' },
                          { value: 'no_sleep', label: '😔 No Sleep', color: 'bg-red-100 border-red-300' },
                        ].map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setAfternoonRest({ ...afternoonRest, quality: option.value as 'deep' | 'light' | 'restless' | 'no_sleep' })}
                            className={`p-3 border-2 rounded-lg text-sm font-medium transition-all ${
                              afternoonRest.quality === option.value
                                ? `${option.color} border-2`
                                : 'bg-white border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">Notes</label>
                      <textarea
                        value={afternoonRest.notes || ''}
                        onChange={(e) => setAfternoonRest({ ...afternoonRest, notes: e.target.value })}
                        className="w-full p-2 border rounded-lg text-sm"
                        rows={2}
                        placeholder="Any observations about afternoon rest..."
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Night Sleep */}
              <div>
                <h3 className="font-semibold mb-3">Night Sleep</h3>
                <div className="flex items-center gap-2 mb-4">
                  <input
                    type="checkbox"
                    checked={nightSleep !== null}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setNightSleep({
                          bedtime: '',
                          quality: 'light',
                          wakings: 0,
                          wakingReasons: [],
                          behaviors: [],
                          notes: '',
                        });
                      } else {
                        setNightSleep(null);
                      }
                    }}
                    className="w-4 h-4"
                  />
                  <label className="text-sm font-medium">Record night sleep</label>
                </div>

                {nightSleep && (
                  <div className="space-y-4 pl-6 border-l-2 border-purple-200">
                    <div>
                      <label className="block text-sm font-medium mb-1">Bedtime</label>
                      <Input
                        type="time"
                        value={nightSleep.bedtime}
                        onChange={(e) => setNightSleep({ ...nightSleep, bedtime: e.target.value })}
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Sleep Quality</label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { value: 'deep', label: '💤 Deep Sleep', color: 'bg-green-100 border-green-300' },
                          { value: 'light', label: '😌 Light Sleep', color: 'bg-blue-100 border-blue-300' },
                          { value: 'restless', label: '😟 Restless', color: 'bg-yellow-100 border-yellow-300' },
                          { value: 'no_sleep', label: '😔 No Sleep', color: 'bg-red-100 border-red-300' },
                        ].map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setNightSleep({ ...nightSleep, quality: option.value as 'deep' | 'light' | 'restless' | 'no_sleep' })}
                            className={`p-3 border-2 rounded-lg text-sm font-medium transition-all ${
                              nightSleep.quality === option.value
                                ? `${option.color} border-2`
                                : 'bg-white border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">Number of Wakings</label>
                      <Input
                        type="number"
                        min="0"
                        value={nightSleep.wakings}
                        onChange={(e) => setNightSleep({ ...nightSleep, wakings: parseInt(e.target.value) || 0 })}
                      />
                    </div>

                    {nightSleep.wakings > 0 && (
                      <div>
                        <label className="block text-sm font-medium mb-2">Reasons for Waking</label>
                        <div className="space-y-2">
                          {['Toilet', 'Pain', 'Confusion', 'Dreams', 'Unknown'].map((reason) => (
                            <label key={reason} className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={nightSleep.wakingReasons.includes(reason.toLowerCase())}
                                onChange={(e) => {
                                  const reasonLower = reason.toLowerCase();
                                  if (e.target.checked) {
                                    setNightSleep({
                                      ...nightSleep,
                                      wakingReasons: [...nightSleep.wakingReasons, reasonLower],
                                    });
                                  } else {
                                    setNightSleep({
                                      ...nightSleep,
                                      wakingReasons: nightSleep.wakingReasons.filter(r => r !== reasonLower),
                                    });
                                  }
                                }}
                                className="w-4 h-4"
                              />
                              <span className="text-sm">{reason}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium mb-2">Sleep Behaviors</label>
                      <div className="grid grid-cols-2 gap-2">
                        {['Quiet', 'Snoring', 'Talking', 'Mumbling', 'Restless', 'Dreaming', 'Nightmares'].map((behavior) => (
                          <label key={behavior} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={nightSleep.behaviors.includes(behavior.toLowerCase())}
                              onChange={(e) => {
                                const behaviorLower = behavior.toLowerCase();
                                if (e.target.checked) {
                                  setNightSleep({
                                    ...nightSleep,
                                    behaviors: [...nightSleep.behaviors, behaviorLower],
                                  });
                                } else {
                                  setNightSleep({
                                    ...nightSleep,
                                    behaviors: nightSleep.behaviors.filter(b => b !== behaviorLower),
                                  });
                                }
                              }}
                              className="w-4 h-4"
                            />
                            <span className="text-sm">{behavior}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">Notes</label>
                      <textarea
                        value={nightSleep.notes || ''}
                        onChange={(e) => setNightSleep({ ...nightSleep, notes: e.target.value })}
                        className="w-full p-2 border rounded-lg text-sm"
                        rows={2}
                        placeholder="Any observations about night sleep..."
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Navigation */}
              <div className="flex gap-4 pt-4 border-t">
                <Button onClick={() => setCurrentSection(5)} variant="outline" className="flex-1">
                  ← Back: Toileting
                </Button>
                <Button onClick={() => setCurrentSection(7)} variant="primary" className="flex-1">
                  Next: Fall Risk & Safety →
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Section 4: Vital Signs */}
        {currentSection === 4 && (
          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold">❤️ Vital Signs</h2>
              <p className="text-sm text-gray-500 mt-1">All fields are optional. Record any measurements taken today.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {(() => {
                const vitalAlerts = validateVitals(bloodPressure, pulseRate, oxygenLevel, bloodSugar, recipientAge, recipientGender);
                const criticalAlerts = vitalAlerts.filter(a => a.level === 'critical');
                const warningAlerts = vitalAlerts.filter(a => a.level === 'warning');

                return (
                  <>
                    {criticalAlerts.length > 0 && (
                      <div className="bg-red-50 border-2 border-red-500 rounded-lg p-4 space-y-2">
                        {criticalAlerts.map((alert, idx) => (
                          <p key={idx} className="text-red-900 font-semibold text-sm">{alert.message}</p>
                        ))}
                        <p className="text-red-700 text-xs font-medium mt-2">⚕️ Consider notifying family immediately</p>
                      </div>
                    )}

                    {warningAlerts.length > 0 && criticalAlerts.length === 0 && (
                      <div className="bg-yellow-50 border border-yellow-400 rounded-lg p-4 space-y-2">
                        {warningAlerts.map((alert, idx) => (
                          <p key={idx} className="text-yellow-900 text-sm">{alert.message}</p>
                        ))}
                        <p className="text-yellow-700 text-xs font-medium mt-2">⚕️ Monitor closely and inform family</p>
                      </div>
                    )}
                  </>
                );
              })()}

              <Input
                label="Time Measured"
                type="time"
                value={vitalsTime}
                onChange={(e) => setVitalsTime(e.target.value)}
              />
              <Input
                label="Blood Pressure"
                type="text"
                value={bloodPressure}
                onChange={(e) => setBloodPressure(e.target.value)}
                placeholder="e.g., 120/80"
                helperText="Normal: <120/80 | Elevated: 120-129/<80 | High: ≥130/80"
              />
              <Input
                label="Pulse Rate (bpm)"
                type="number"
                value={pulseRate}
                onChange={(e) => setPulseRate(e.target.value)}
                placeholder="e.g., 72"
                helperText="Normal: 60-100 bpm"
              />
              <Input
                label="Oxygen Level (%)"
                type="number"
                min="0"
                max="100"
                value={oxygenLevel}
                onChange={(e) => setOxygenLevel(e.target.value)}
                placeholder="e.g., 98"
                helperText="Normal: 95-100% | Low: <95%"
              />
              <Input
                label="Blood Sugar (mmol/L)"
                type="number"
                step="0.1"
                value={bloodSugar}
                onChange={(e) => setBloodSugar(e.target.value)}
                placeholder="e.g., 5.6"
                helperText="Normal fasting: 4.0-5.9 | Normal after meal: <7.8"
              />

              <div className="flex gap-3">
                <Button onClick={() => setCurrentSection(3)} variant="outline" className="flex-1">
                  ← Back
                </Button>
                <Button onClick={() => setCurrentSection(5)} variant="primary" className="flex-1">
                  Next: Toileting →
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Section 5: Toileting & Hygiene (Consolidated) */}
        {currentSection === 5 && (
          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold">🚽 Toileting & Hygiene</h2>
              <p className="text-sm text-gray-500 mt-1">All fields optional. Diaper/assistance fields apply to all toileting.</p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Shared Diaper Management Section */}
              <div className="bg-gray-50 p-4 rounded-lg space-y-4">
                <h3 className="font-semibold text-lg">🩲 Diaper Management</h3>
                <p className="text-xs text-gray-500">These apply to all toileting today (bowel + urination combined)</p>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Total Diaper Changes</label>
                    <input
                      type="number"
                      min="0"
                      value={toiletingDiaperChanges || ''}
                      onChange={(e) => setToiletingDiaperChanges(e.target.value ? parseInt(e.target.value) : null)}
                      className="w-full p-2 border rounded-lg"
                      placeholder="0"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Current Status</label>
                    <div className="flex gap-1">
                      {[
                        { value: 'dry', label: 'Dry', emoji: '✨' },
                        { value: 'wet', label: 'Wet', emoji: '💧' },
                        { value: 'soiled', label: 'Soiled', emoji: '💩' },
                      ].map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setToiletingDiaperStatus(option.value as 'dry' | 'wet' | 'soiled')}
                          className={`flex-1 py-2 px-2 rounded-lg text-xs font-medium transition-colors ${
                            toiletingDiaperStatus === option.value
                              ? 'bg-purple-500 text-white'
                              : 'bg-white border hover:bg-gray-50'
                          }`}
                        >
                          {option.emoji} {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Accidents</label>
                  <div className="flex gap-2">
                    {[
                      { value: 'none', label: 'None', color: 'bg-green-500' },
                      { value: 'minor', label: 'Minor', color: 'bg-yellow-500' },
                      { value: 'major', label: 'Major', color: 'bg-red-500' },
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setToiletingAccidents(option.value as 'none' | 'minor' | 'major')}
                        className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                          toiletingAccidents === option.value
                            ? `${option.color} text-white`
                            : 'bg-white border hover:bg-gray-50'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Assistance Needed</label>
                  <div className="flex gap-2">
                    {[
                      { value: 'none', label: 'None', emoji: '✅' },
                      { value: 'partial', label: 'Partial', emoji: '🤝' },
                      { value: 'full', label: 'Full', emoji: '👐' },
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setToiletingAssistance(option.value as 'none' | 'partial' | 'full')}
                        className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                          toiletingAssistance === option.value
                            ? 'bg-purple-500 text-white'
                            : 'bg-white border hover:bg-gray-50'
                        }`}
                      >
                        {option.emoji} {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Pain During Toileting</label>
                  <div className="flex gap-2">
                    {[
                      { value: 'no_pain', label: 'No Pain', emoji: '😊' },
                      { value: 'some_pain', label: 'Some Pain', emoji: '😣' },
                      { value: 'very_painful', label: 'Very Painful', emoji: '😫' },
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setToiletingPain(option.value as 'no_pain' | 'some_pain' | 'very_painful')}
                        className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                          toiletingPain === option.value
                            ? 'bg-purple-500 text-white'
                            : 'bg-white border hover:bg-gray-50'
                        }`}
                      >
                        {option.emoji} {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bowel Movements Subsection */}
              <div className="bg-amber-50 p-4 rounded-lg space-y-4">
                <h3 className="font-semibold text-lg">💩 Bowel Movements</h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Frequency (times today)</label>
                    <input
                      type="number"
                      min="0"
                      value={bowelFreq}
                      onChange={(e) => setBowelFreq(parseInt(e.target.value) || 0)}
                      className="w-full p-2 border rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Times Used Toilet</label>
                    <input
                      type="number"
                      min="0"
                      value={bowelTimesUsedToilet || ''}
                      onChange={(e) => setBowelTimesUsedToilet(e.target.value ? parseInt(e.target.value) : null)}
                      className="w-full p-2 border rounded-lg"
                    />
                  </div>
                </div>

                {bowelFreq > 0 && (
                  <>
                    <div>
                      <label className="block text-sm font-medium mb-2">Consistency</label>
                      <select
                        value={bowelConsistency || ''}
                        onChange={(e) => setBowelConsistency(e.target.value ? e.target.value as 'normal' | 'hard' | 'soft' | 'loose' | 'diarrhea' : null)}
                        className="w-full p-2 border rounded-lg"
                      >
                        <option value="">Select...</option>
                        <option value="normal">Normal</option>
                        <option value="hard">Hard</option>
                        <option value="soft">Soft</option>
                        <option value="loose">Loose</option>
                        <option value="diarrhea">Diarrhea 🚨</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">Bowel Concerns</label>
                      <textarea
                        value={bowelConcerns}
                        onChange={(e) => setBowelConcerns(e.target.value)}
                        className="w-full p-2 border rounded-lg text-sm"
                        rows={2}
                        placeholder="Any concerns about bowel movements?"
                      />
                    </div>
                  </>
                )}
              </div>

              {/* Urination Subsection */}
              <div className="bg-blue-50 p-4 rounded-lg space-y-4">
                <h3 className="font-semibold text-lg">💧 Urination</h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Frequency (times today)</label>
                    <input
                      type="number"
                      min="0"
                      value={urineFreq}
                      onChange={(e) => setUrineFreq(parseInt(e.target.value) || 0)}
                      className="w-full p-2 border rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Times Used Toilet</label>
                    <input
                      type="number"
                      min="0"
                      value={urineTimesUsedToilet || ''}
                      onChange={(e) => setUrineTimesUsedToilet(e.target.value ? parseInt(e.target.value) : null)}
                      className="w-full p-2 border rounded-lg"
                    />
                  </div>
                </div>

                {urineFreq > 0 && (
                  <>
                    <div>
                      <label className="block text-sm font-medium mb-2">Urine Color</label>
                      <select
                        value={urineColor || ''}
                        onChange={(e) => setUrineColor(e.target.value as 'light_clear' | 'yellow' | 'dark_yellow' | 'brown' | 'dark' || null)}
                        className="w-full p-2 border rounded-lg"
                      >
                        <option value="">Select...</option>
                        <option value="light_clear">Light/Clear (good hydration)</option>
                        <option value="yellow">Yellow (normal)</option>
                        <option value="dark_yellow">Dark Yellow (check fluids)</option>
                        <option value="brown">Brown 🚨</option>
                        <option value="dark">Dark 🚨</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">Urination Concerns</label>
                      <textarea
                        value={urineConcerns}
                        onChange={(e) => setUrineConcerns(e.target.value)}
                        className="w-full p-2 border rounded-lg text-sm"
                        rows={2}
                        placeholder="Any concerns about urination?"
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="flex gap-3">
                <Button onClick={() => setCurrentSection(4)} variant="outline" className="flex-1">
                  ← Back: Vital Signs
                </Button>
                <Button onClick={() => setCurrentSection(6)} variant="primary" className="flex-1">
                  Next: Sleep →
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Section 7: Fall Risk & Safety */}
        {currentSection === 7 && (
          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-orange-500" />
                Fall Risk & Safety Assessment
              </h2>
              <p className="text-sm text-gray-500 mt-1">All fields are optional. Complete any relevant assessments.</p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Balance Issues Scale */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Balance Issues (1-5)
                </label>
                <div className="bg-gray-50 p-3 rounded-lg mb-2 text-xs">
                  <p><strong>1</strong> = No balance problems</p>
                  <p><strong>2</strong> = Slight unsteadiness occasionally</p>
                  <p><strong>3</strong> = Moderate balance problems, careful walking</p>
                  <p><strong>4</strong> = Severe balance problems, needs constant support</p>
                  <p><strong>5</strong> = Cannot maintain balance, wheelchair/bed bound</p>
                </div>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setBalanceIssues(value)}
                      className={`flex-1 py-3 rounded-lg font-semibold transition-colors ${
                        balanceIssues === value
                          ? 'bg-orange-500 text-white'
                          : 'bg-gray-100 hover:bg-gray-200'
                      }`}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>

              {/* Near Falls */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Near Falls
                </label>
                <select
                  value={nearFalls}
                  onChange={(e) => setNearFalls(e.target.value as 'none' | 'once_or_twice' | 'multiple')}
                  className="w-full px-4 py-2 border rounded-lg"
                >
                  <option value="none">None</option>
                  <option value="once_or_twice">1-2 times</option>
                  <option value="multiple">Multiple times</option>
                </select>
              </div>

              {/* Actual Falls */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Actual Falls 🚨
                </label>
                <select
                  value={actualFalls}
                  onChange={(e) => setActualFalls(e.target.value as 'none' | 'minor' | 'major')}
                  className={`w-full px-4 py-2 border rounded-lg ${actualFalls === 'major' ? 'border-2 border-red-500' : ''}`}
                >
                  <option value="none">None</option>
                  <option value="minor">Minor</option>
                  <option value="major">⚠️ MAJOR - REPORT IMMEDIATELY</option>
                </select>
                {actualFalls === 'major' && (
                  <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-800 font-semibold">
                      ⚠️ MAJOR FALL ALERT: Family will be notified immediately
                    </p>
                  </div>
                )}
              </div>

              {/* Walking Pattern */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Walking Pattern (How she walks)
                </label>
                <div className="space-y-2">
                  {['normal', 'shuffling', 'uneven', 'very_slow', 'stumbling', 'cannot_lift_feet'].map((pattern) => (
                    <label key={pattern} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={walkingPattern.includes(pattern)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setWalkingPattern([...walkingPattern, pattern]);
                          } else {
                            setWalkingPattern(walkingPattern.filter(p => p !== pattern));
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm capitalize">
                        {pattern.replace(/_/g, ' ')}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Freezing Episodes */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Freezing Episodes
                </label>
                <p className="text-xs text-gray-600 mb-2">
                  (Suddenly stopping and being unable to move forward, like feet stuck to ground)
                </p>
                <select
                  value={freezingEpisodes}
                  onChange={(e) => setFreezingEpisodes(e.target.value as 'none' | 'mild' | 'severe')}
                  className="w-full px-4 py-2 border rounded-lg"
                >
                  <option value="none">None</option>
                  <option value="mild">Mild</option>
                  <option value="severe">Severe</option>
                </select>
              </div>

              <div className="flex gap-3">
                <Button onClick={() => setCurrentSection(6)} variant="outline" className="flex-1">
                  ← Back
                </Button>
                <Button onClick={() => setCurrentSection(8)} variant="primary" className="flex-1">
                  Next →
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Section 8: Unaccompanied Time */}
        {currentSection === 8 && (
          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-500" />
                Unaccompanied Time Tracking
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                All fields optional. <span className="font-medium text-gray-700">When adding time periods, start time<span className="text-red-500">*</span>, end time<span className="text-red-500">*</span>, and reason<span className="text-red-500">*</span> are required.</span>
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Time Periods List */}
              {unaccompaniedTime.length > 0 && (
                <div className="space-y-4">
                  {unaccompaniedTime.map((period, index) => {
                    const duration = calculateDuration(period.startTime, period.endTime);
                    const isLong = duration > 60;
                    const isInvalid = duration < 0;

                    return (
                      <div
                        key={index}
                        data-testid="time-period"
                        className={`border-2 rounded-lg p-4 ${
                          isInvalid
                            ? 'border-red-300 bg-red-50'
                            : isLong
                            ? 'border-orange-300 bg-orange-50'
                            : 'border-gray-200 bg-gray-50'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-3">
                          <h4 className="font-semibold text-gray-900">
                            Period {index + 1}
                          </h4>
                          <button
                            type="button"
                            data-testid="remove-period"
                            onClick={() => {
                              const newPeriods = unaccompaniedTime.filter((_, i) => i !== index);
                              setUnaccompaniedTime(newPeriods);
                            }}
                            className="text-red-600 hover:text-red-800 text-sm font-medium"
                          >
                            Remove
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Start Time <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="time"
                              name="startTime"
                              value={period.startTime}
                              onChange={(e) => {
                                const newPeriods = [...unaccompaniedTime];
                                newPeriods[index].startTime = e.target.value;
                                setUnaccompaniedTime(newPeriods);
                              }}
                              className={`w-full px-3 py-2 border rounded-lg ${!period.startTime ? 'border-red-300' : ''}`}
                              required
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              End Time <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="time"
                              name="endTime"
                              value={period.endTime}
                              onChange={(e) => {
                                const newPeriods = [...unaccompaniedTime];
                                newPeriods[index].endTime = e.target.value;
                                setUnaccompaniedTime(newPeriods);
                              }}
                              className={`w-full px-3 py-2 border rounded-lg ${!period.endTime ? 'border-red-300' : ''}`}
                              required
                            />
                          </div>
                        </div>

                        {/* Duration Display */}
                        <div className="mb-3">
                          {isInvalid ? (
                            <p className="text-sm text-red-700 font-medium">
                              ⚠️ End time must be after start time
                            </p>
                          ) : (
                            <p className="text-sm text-gray-700">
                              Duration: <span className="font-semibold">{duration} minutes</span>
                              {isLong && (
                                <span className="ml-2 text-orange-700">
                                  ⚠️ Long period ({Math.floor(duration / 60)} hour{duration >= 120 ? 's' : ''})
                                </span>
                              )}
                            </p>
                          )}
                        </div>

                        <div className="space-y-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Reason for absence <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              placeholder="e.g., Emergency bathroom break, scheduled break"
                              value={period.reason}
                              onChange={(e) => {
                                const newPeriods = [...unaccompaniedTime];
                                newPeriods[index].reason = e.target.value;
                                setUnaccompaniedTime(newPeriods);
                              }}
                              className={`w-full px-3 py-2 border rounded-lg ${!period.reason ? 'border-red-300' : ''}`}
                              required
                            />
                            {!period.reason && (
                              <p className="text-xs text-red-500 mt-1">Reason is required</p>
                            )}
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Replacement person (if any)
                            </label>
                            <input
                              type="text"
                              placeholder="e.g., Nurse Mary, Family member"
                              value={period.replacementPerson}
                              onChange={(e) => {
                                const newPeriods = [...unaccompaniedTime];
                                newPeriods[index].replacementPerson = e.target.value;
                                setUnaccompaniedTime(newPeriods);
                              }}
                              className="w-full px-3 py-2 border rounded-lg"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Total Duration */}
                  <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-900">
                      <span className="font-semibold">Total unaccompanied time today:</span>{' '}
                      {unaccompaniedTime.reduce((sum, p) => {
                        const duration = calculateDuration(p.startTime, p.endTime);
                        return sum + (duration > 0 ? duration : 0);
                      }, 0)}{' '}
                      minutes
                      {unaccompaniedTime.reduce((sum, p) => {
                        const duration = calculateDuration(p.startTime, p.endTime);
                        return sum + (duration > 0 ? duration : 0);
                      }, 0) > 60 && (
                        <span className="ml-2 text-orange-700 font-medium">
                          ⚠️ Exceeds 1 hour - family will be notified
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              )}

              {/* Add Period Button */}
              <button
                type="button"
                onClick={() => {
                  setUnaccompaniedTime([
                    ...unaccompaniedTime,
                    {
                      startTime: '',
                      endTime: '',
                      reason: '',
                      replacementPerson: '',
                      duration: 0,
                    },
                  ]);
                }}
                className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-primary-500 hover:text-primary-700 font-medium transition-colors"
              >
                + Add Time Period
              </button>

              {/* Incidents Textarea */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Any incidents during unaccompanied time?
                </label>
                <textarea
                  placeholder="e.g., Care recipient tried to get up alone but replacement person assisted. No injuries."
                  value={unaccompaniedIncidents}
                  onChange={(e) => setUnaccompaniedIncidents(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  rows={3}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Record any concerning behaviors or incidents that occurred while the care recipient was alone
                </p>
              </div>

              {/* Info Box */}
              {unaccompaniedTime.length === 0 && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <p className="text-sm text-gray-700">
                    ℹ️ If the care recipient was never left alone today, you can skip this section.
                    Click "Add Time Period" above to record any unaccompanied time.
                  </p>
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="flex gap-3">
                <Button onClick={() => setCurrentSection(7)} variant="outline" className="flex-1">
                  ← Back
                </Button>
                <Button onClick={() => setCurrentSection(9)} variant="primary" className="flex-1">
                  Next: Safety Checks →
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Section 9: Safety Checks (was Section 8) */}
        {currentSection === 9 && (
          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                Daily Safety Checks
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                All fields are optional. Check items you've verified today.
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Safety Checks */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Safety Checklist</h3>
                <div className="space-y-4">
                  {Object.entries(safetyChecks).map(([key, value]) => {
                    const labels: Record<string, string> = {
                      tripHazards: 'Trip Hazards (mats, clutter)',
                      cables: 'Cables & Cords',
                      sandals: 'Proper Footwear (no sandals/slippers)',
                      slipHazards: 'Slip Hazards (wet floors, spills)',
                      mobilityAids: 'Mobility Aids (walker, cane within reach)',
                      emergencyEquipment: 'Emergency Equipment Accessible',
                    };

                    return (
                      <div key={key} className="border rounded-lg p-4 bg-gray-50">
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            data-testid={key.replace(/([A-Z])/g, '-$1').toLowerCase()}
                            checked={value.checked}
                            onChange={(e) => {
                              setSafetyChecks({
                                ...safetyChecks,
                                [key]: { ...value, checked: e.target.checked },
                              });
                            }}
                            className="w-5 h-5 mt-0.5"
                          />
                          <div className="flex-1">
                            <label className="font-medium text-gray-900">
                              {labels[key]}
                            </label>
                            {value.checked && (
                              <input
                                type="text"
                                data-testid={`${key.replace(/([A-Z])/g, '-$1').toLowerCase()}-action`}
                                placeholder="What action was taken?"
                                value={value.action}
                                onChange={(e) => {
                                  setSafetyChecks({
                                    ...safetyChecks,
                                    [key]: { ...value, action: e.target.value },
                                  });
                                }}
                                className="w-full mt-2 px-3 py-2 border rounded-lg text-sm"
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Progress Indicator */}
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-blue-900">
                      Safety Checks Progress:
                    </span>
                    <span className="text-sm font-bold text-blue-900">
                      {Object.values(safetyChecks).filter((v) => v.checked).length}/6
                      ({Math.round((Object.values(safetyChecks).filter((v) => v.checked).length / 6) * 100)}%)
                    </span>
                  </div>
                  {Object.values(safetyChecks).filter((v) => v.checked).length === 6 && (
                    <p className="text-sm text-green-700 mt-2">
                      ✅ All safety checks complete!
                    </p>
                  )}
                </div>
              </div>

              {/* Emergency Preparedness */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Emergency Preparedness</h3>
                <p className="text-sm text-gray-600 mb-3">
                  Check which emergency equipment is available and accessible:
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(emergencyPrep).map(([key, checked]) => {
                    const labels: Record<string, string> = {
                      icePack: 'Ice Pack',
                      wheelchair: 'Wheelchair',
                      commode: 'Commode',
                      walkingStick: 'Walking Stick',
                      walker: 'Walker',
                      bruiseOintment: 'Bruise Ointment',
                      firstAidKit: 'First Aid Kit',
                    };

                    return (
                      <div key={key} className="border rounded-lg p-3 bg-gray-50">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            data-testid={key.replace(/([A-Z])/g, '-$1').toLowerCase()}
                            checked={checked}
                            onChange={(e) => {
                              setEmergencyPrep({
                                ...emergencyPrep,
                                [key]: e.target.checked,
                              });
                            }}
                            className="w-4 h-4"
                          />
                          <span className="text-sm font-medium">{labels[key]}</span>
                        </label>
                      </div>
                    );
                  })}
                </div>

                {/* Emergency Prep Progress */}
                <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-green-900">
                      Emergency Equipment Available:
                    </span>
                    <span className="text-sm font-bold text-green-900">
                      {Object.values(emergencyPrep).filter((v) => v).length}/7
                      ({Math.round((Object.values(emergencyPrep).filter((v) => v).length / 7) * 100)}%)
                    </span>
                  </div>
                </div>
              </div>

              {/* Room Maintenance */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Room Maintenance</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Cleaning Status
                    </label>
                    <select
                      value={roomMaintenance.cleaningStatus}
                      onChange={(e) => setRoomMaintenance({ ...roomMaintenance, cleaningStatus: e.target.value as 'completed_by_maid' | 'caregiver_assisted' | 'not_done' | '' })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="">Select...</option>
                      <option value="completed_by_maid">Completed by maid</option>
                      <option value="caregiver_assisted">Caregiver assisted</option>
                      <option value="not_done">Not done</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Room Comfort
                    </label>
                    <select
                      value={roomMaintenance.roomComfort}
                      onChange={(e) => setRoomMaintenance({ ...roomMaintenance, roomComfort: e.target.value as 'good_temperature' | 'too_hot' | 'too_cold' | '' })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="">Select...</option>
                      <option value="good_temperature">Good temperature</option>
                      <option value="too_hot">Too hot</option>
                      <option value="too_cold">Too cold</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Personal Items Check */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Personal Items Check (Daily)</h3>
                <div className="space-y-4">
                  {/* Spectacles */}
                  <div className="border rounded-lg p-4 bg-gray-50">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={personalItems.spectaclesCleaned.checked}
                        onChange={(e) => setPersonalItems({
                          ...personalItems,
                          spectaclesCleaned: { ...personalItems.spectaclesCleaned, checked: e.target.checked }
                        })}
                        className="w-5 h-5 mt-0.5"
                      />
                      <div className="flex-1">
                        <label className="font-medium text-gray-900">Spectacles cleaned</label>
                        {personalItems.spectaclesCleaned.checked && (
                          <div className="mt-2 flex gap-2">
                            <label className="flex items-center gap-2">
                              <input
                                type="radio"
                                name="spectaclesStatus"
                                value="clean"
                                checked={personalItems.spectaclesCleaned.status === 'clean'}
                                onChange={() => setPersonalItems({
                                  ...personalItems,
                                  spectaclesCleaned: { ...personalItems.spectaclesCleaned, status: 'clean' }
                                })}
                              />
                              <span className="text-sm">Clean</span>
                            </label>
                            <label className="flex items-center gap-2">
                              <input
                                type="radio"
                                name="spectaclesStatus"
                                value="need_cleaning"
                                checked={personalItems.spectaclesCleaned.status === 'need_cleaning'}
                                onChange={() => setPersonalItems({
                                  ...personalItems,
                                  spectaclesCleaned: { ...personalItems.spectaclesCleaned, status: 'need_cleaning' }
                                })}
                              />
                              <span className="text-sm">Need cleaning</span>
                            </label>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Jewelry */}
                  <div className="border rounded-lg p-4 bg-gray-50">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={personalItems.jewelryAccountedFor.checked}
                        onChange={(e) => setPersonalItems({
                          ...personalItems,
                          jewelryAccountedFor: { ...personalItems.jewelryAccountedFor, checked: e.target.checked }
                        })}
                        className="w-5 h-5 mt-0.5"
                      />
                      <div className="flex-1">
                        <label className="font-medium text-gray-900">Jewelry accounted for</label>
                        {personalItems.jewelryAccountedFor.checked && (
                          <div className="mt-2 space-y-2">
                            <div className="flex gap-2">
                              <label className="flex items-center gap-2">
                                <input
                                  type="radio"
                                  name="jewelryStatus"
                                  value="all_present"
                                  checked={personalItems.jewelryAccountedFor.status === 'all_present'}
                                  onChange={() => setPersonalItems({
                                    ...personalItems,
                                    jewelryAccountedFor: { ...personalItems.jewelryAccountedFor, status: 'all_present' }
                                  })}
                                />
                                <span className="text-sm">All present</span>
                              </label>
                              <label className="flex items-center gap-2">
                                <input
                                  type="radio"
                                  name="jewelryStatus"
                                  value="missing_item"
                                  checked={personalItems.jewelryAccountedFor.status === 'missing_item'}
                                  onChange={() => setPersonalItems({
                                    ...personalItems,
                                    jewelryAccountedFor: { ...personalItems.jewelryAccountedFor, status: 'missing_item' }
                                  })}
                                />
                                <span className="text-sm">Missing item</span>
                              </label>
                            </div>
                            {personalItems.jewelryAccountedFor.status === 'missing_item' && (
                              <input
                                type="text"
                                placeholder="Which item is missing?"
                                value={personalItems.jewelryAccountedFor.notes}
                                onChange={(e) => setPersonalItems({
                                  ...personalItems,
                                  jewelryAccountedFor: { ...personalItems.jewelryAccountedFor, notes: e.target.value }
                                })}
                                className="w-full px-3 py-2 border rounded-lg text-sm"
                              />
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Handbag */}
                  <div className="border rounded-lg p-4 bg-gray-50">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={personalItems.handbagOrganized.checked}
                        onChange={(e) => setPersonalItems({
                          ...personalItems,
                          handbagOrganized: { ...personalItems.handbagOrganized, checked: e.target.checked }
                        })}
                        className="w-5 h-5 mt-0.5"
                      />
                      <div className="flex-1">
                        <label className="font-medium text-gray-900">Handbag organized</label>
                        {personalItems.handbagOrganized.checked && (
                          <div className="mt-2 flex gap-2">
                            <label className="flex items-center gap-2">
                              <input
                                type="radio"
                                name="handbagStatus"
                                value="organized"
                                checked={personalItems.handbagOrganized.status === 'organized'}
                                onChange={() => setPersonalItems({
                                  ...personalItems,
                                  handbagOrganized: { ...personalItems.handbagOrganized, status: 'organized' }
                                })}
                              />
                              <span className="text-sm">Organized</span>
                            </label>
                            <label className="flex items-center gap-2">
                              <input
                                type="radio"
                                name="handbagStatus"
                                value="need_organizing"
                                checked={personalItems.handbagOrganized.status === 'need_organizing'}
                                onChange={() => setPersonalItems({
                                  ...personalItems,
                                  handbagOrganized: { ...personalItems.handbagOrganized, status: 'need_organizing' }
                                })}
                              />
                              <span className="text-sm">Need organizing</span>
                            </label>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Progress */}
                  <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-purple-900">
                        Personal Items Checked:
                      </span>
                      <span className="text-sm font-bold text-purple-900">
                        {Object.values(personalItems).filter((v) => v.checked).length}/3
                        ({Math.round((Object.values(personalItems).filter((v) => v.checked).length / 3) * 100)}%)
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Hospital Bag Preparedness */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <span>🏥</span>
                  Hospital Bag Preparedness (Daily Check)
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Quick daily check that emergency bag is ready. For detailed bag setup, use Pack List.
                </p>

                <div className="space-y-4">
                  <div className="border rounded-lg p-4 bg-blue-50">
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={hospitalBagStatus.lastChecked}
                        onChange={(e) => setHospitalBagStatus({ ...hospitalBagStatus, lastChecked: e.target.checked })}
                        className="w-5 h-5"
                      />
                      <span className="font-medium text-gray-900">I have checked the hospital bag today</span>
                    </label>
                  </div>

                  {hospitalBagStatus.lastChecked && (
                    <>
                      <div className="border rounded-lg p-4 bg-white">
                        <label className="flex items-center gap-3 mb-3">
                          <input
                            type="checkbox"
                            checked={hospitalBagStatus.bagReady}
                            onChange={(e) => setHospitalBagStatus({ ...hospitalBagStatus, bagReady: e.target.checked })}
                            className="w-5 h-5"
                          />
                          <span className="font-medium text-gray-900">✅ Bag is fully packed and ready</span>
                        </label>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Bag Location
                          </label>
                          <input
                            type="text"
                            placeholder="e.g., Top shelf in bedroom closet"
                            value={hospitalBagStatus.location}
                            onChange={(e) => setHospitalBagStatus({ ...hospitalBagStatus, location: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Notes
                        </label>
                        <textarea
                          placeholder="Any concerns or items that need attention..."
                          value={hospitalBagStatus.notes}
                          onChange={(e) => setHospitalBagStatus({ ...hospitalBagStatus, notes: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg"
                          rows={2}
                        />
                      </div>

                      {!hospitalBagStatus.bagReady && (
                        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                          <p className="text-sm text-yellow-800">
                            ⚠️ Bag not ready! Please update the bag or notify family.
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Navigation Buttons */}
              <div className="flex gap-3">
                <Button onClick={() => setCurrentSection(8)} variant="outline" className="flex-1">
                  ← Back
                </Button>
                <Button onClick={() => setCurrentSection(10)} variant="primary" className="flex-1">
                  Next: Spiritual & Emotional →
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Section 10: Spiritual & Emotional Well-Being */}
        {currentSection === 10 && (
          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold">🙏 Spiritual & Emotional Well-Being</h2>
              <p className="text-sm text-gray-500 mt-1">All fields are optional. Track prayer, mood, and social interactions.</p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Prayer Time */}
              <div className="space-y-3">
                <label className="block text-sm font-medium">Prayer Time</label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-600">Start Time</label>
                    <input
                      type="time"
                      value={prayerStartTime}
                      onChange={(e) => setPrayerStartTime(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">End Time</label>
                    <input
                      type="time"
                      value={prayerEndTime}
                      onChange={(e) => setPrayerEndTime(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                </div>
              </div>

              {/* Prayer Expression */}
              <div className="space-y-3">
                <label className="block text-sm font-medium">Prayer Expression</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'speaking_out_loud', label: 'Speaking Out Loud' },
                    { value: 'whispering', label: 'Whispering' },
                    { value: 'mumbling', label: 'Mumbling' },
                    { value: 'silent_worship', label: 'Silent Worship' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setPrayerExpression(option.value as 'speaking_out_loud' | 'whispering' | 'mumbling' | 'silent_worship')}
                      className={`px-4 py-3 rounded-lg border-2 transition-all ${
                        prayerExpression === option.value
                          ? 'bg-primary-100 border-primary-500 text-primary-900'
                          : 'bg-white border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Overall Mood Scale */}
              <div className="space-y-3">
                <label className="block text-sm font-medium">Overall Mood (1-5 scale)</label>
                <p className="text-xs text-gray-600">1 = Very sad/depressed, 5 = Very happy and joyful</p>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((mood) => (
                    <button
                      key={mood}
                      onClick={() => setOverallMood(mood)}
                      className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all text-center font-semibold ${
                        overallMood === mood
                          ? 'bg-primary-100 border-primary-500 text-primary-900'
                          : 'bg-white border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {mood}
                    </button>
                  ))}
                </div>
              </div>

              {/* Communication Scale */}
              <div className="space-y-3">
                <label className="block text-sm font-medium">Communication (1-5 scale)</label>
                <p className="text-xs text-gray-600">1 = Cannot communicate, 5 = Clear and easy</p>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((scale) => (
                    <button
                      key={scale}
                      onClick={() => setCommunicationScale(scale)}
                      className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all text-center font-semibold ${
                        communicationScale === scale
                          ? 'bg-primary-100 border-primary-500 text-primary-900'
                          : 'bg-white border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {scale}
                    </button>
                  ))}
                </div>
              </div>

              {/* Social Interaction */}
              <div className="space-y-3">
                <label className="block text-sm font-medium">Social Interaction</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'engaged', label: 'Engaged' },
                    { value: 'responsive', label: 'Responsive' },
                    { value: 'withdrawn', label: 'Withdrawn' },
                    { value: 'aggressive_hostile', label: 'Aggressive/Hostile' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setSocialInteraction(option.value as 'engaged' | 'responsive' | 'withdrawn' | 'aggressive_hostile')}
                      className={`px-4 py-3 rounded-lg border-2 transition-all ${
                        socialInteraction === option.value
                          ? 'bg-primary-100 border-primary-500 text-primary-900'
                          : 'bg-white border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Navigation Buttons */}
              <div className="flex gap-3">
                <Button onClick={() => setCurrentSection(9)} variant="outline" className="flex-1">
                  ← Back
                </Button>
                <Button onClick={() => setCurrentSection(11)} variant="primary" className="flex-1">
                  Next: Physical Activity →
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Section 11: Physical Activity & Exercise - Enhanced with Detailed Sessions */}
        {currentSection === 11 && (
          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold">🏃 Physical Activity & Exercise</h2>
              <p className="text-sm text-gray-500 mt-1">All fields are optional. Track exercise sessions and movement assessment.</p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Morning Exercise Session */}
              <div className="bg-gray-50 p-4 rounded-lg space-y-4">
                <h3 className="font-semibold text-lg">Morning Exercise Session</h3>

                {/* Time Range */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Start Time</label>
                    <input
                      type="time"
                      name="morningExerciseStart"
                      value={morningExerciseStart}
                      onChange={(e) => setMorningExerciseStart(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">End Time</label>
                    <input
                      type="time"
                      name="morningExerciseEnd"
                      value={morningExerciseEnd}
                      onChange={(e) => setMorningExerciseEnd(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                </div>

                {/* Exercise Types */}
                <div className="space-y-3">
                  {[
                    { key: 'eyeExercises', label: 'Eye Exercises', inputName: 'EyeExercises' },
                    { key: 'armShoulderStrengthening', label: 'Arm/Shoulder Strengthening', inputName: 'ArmShoulderStrengthening' },
                    { key: 'legStrengthening', label: 'Leg Strengthening', inputName: 'LegStrengthening' },
                    { key: 'balanceTraining', label: 'Balance Training', inputName: 'BalanceTraining' },
                    { key: 'stretching', label: 'Stretching', inputName: 'Stretching' },
                    { key: 'armPedalling', label: 'Arm Pedalling (Cycling)', inputName: 'ArmPedalling' },
                    { key: 'legPedalling', label: 'Leg Pedalling (Cycling)', inputName: 'LegPedalling' },
                    { key: 'physiotherapistExercises', label: 'Physiotherapist Exercises', inputName: 'PhysiotherapistExercises' },
                  ].map((exercise) => (
                    <div key={exercise.key} className="border border-gray-200 rounded-md p-3 bg-white">
                      <div className="flex items-center gap-3 mb-2">
                        <input
                          type="checkbox"
                          name={`${exercise.inputName}Done`}
                          checked={morningExercises[exercise.key].done}
                          onChange={(e) => setMorningExercises(prev => ({
                            ...prev,
                            [exercise.key]: { ...prev[exercise.key], done: e.target.checked }
                          }))}
                          className="w-5 h-5"
                        />
                        <label className="font-medium">{exercise.label}</label>
                      </div>

                      {morningExercises[exercise.key].done && (
                        <div className="grid grid-cols-2 gap-3 ml-8">
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">Duration (min)</label>
                            <input
                              type="number"
                              name={`${exercise.inputName}Duration`}
                              min="0"
                              value={morningExercises[exercise.key].duration || ''}
                              onChange={(e) => setMorningExercises(prev => ({
                                ...prev,
                                [exercise.key]: { ...prev[exercise.key], duration: parseInt(e.target.value) || 0 }
                              }))}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">Participation (1-5)</label>
                            <div className="flex gap-1">
                              {[1, 2, 3, 4, 5].map((level) => (
                                <input
                                  key={level}
                                  type="radio"
                                  name={`${exercise.inputName}Participation`}
                                  value={level}
                                  checked={morningExercises[exercise.key].participation === level}
                                  onChange={() => setMorningExercises(prev => ({
                                    ...prev,
                                    [exercise.key]: { ...prev[exercise.key], participation: level }
                                  }))}
                                  className="w-6 h-6"
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium mb-1">Session Notes</label>
                  <textarea
                    name="morningExerciseNotes"
                    value={morningExerciseNotes}
                    onChange={(e) => setMorningExerciseNotes(e.target.value)}
                    placeholder="Any observations about the morning exercise session..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    rows={2}
                  />
                </div>
              </div>

              {/* Afternoon Exercise Session */}
              <div className="bg-gray-50 p-4 rounded-lg space-y-4">
                <h3 className="font-semibold text-lg">Afternoon Exercise Session</h3>

                {/* Time Range */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Start Time</label>
                    <input
                      type="time"
                      name="afternoonExerciseStart"
                      value={afternoonExerciseStart}
                      onChange={(e) => setAfternoonExerciseStart(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">End Time</label>
                    <input
                      type="time"
                      name="afternoonExerciseEnd"
                      value={afternoonExerciseEnd}
                      onChange={(e) => setAfternoonExerciseEnd(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                </div>

                {/* Exercise Types - Afternoon */}
                <div className="space-y-3">
                  {[
                    { key: 'eyeExercises', label: 'Eye Exercises', inputName: 'EyeExercises' },
                    { key: 'armShoulderStrengthening', label: 'Arm/Shoulder Strengthening', inputName: 'ArmShoulderStrengthening' },
                    { key: 'legStrengthening', label: 'Leg Strengthening', inputName: 'LegStrengthening' },
                    { key: 'balanceTraining', label: 'Balance Training', inputName: 'BalanceTraining' },
                    { key: 'stretching', label: 'Stretching', inputName: 'Stretching' },
                    { key: 'armPedalling', label: 'Arm Pedalling (Cycling)', inputName: 'ArmPedalling' },
                    { key: 'legPedalling', label: 'Leg Pedalling (Cycling)', inputName: 'LegPedalling' },
                    { key: 'physiotherapistExercises', label: 'Physiotherapist Exercises', inputName: 'PhysiotherapistExercises' },
                  ].map((exercise) => (
                    <div key={exercise.key} className="border border-gray-200 rounded-md p-3 bg-white">
                      <div className="flex items-center gap-3 mb-2">
                        <input
                          type="checkbox"
                          name={`${exercise.inputName}AfternoonDone`}
                          checked={afternoonExercises[exercise.key].done}
                          onChange={(e) => setAfternoonExercises(prev => ({
                            ...prev,
                            [exercise.key]: { ...prev[exercise.key], done: e.target.checked }
                          }))}
                          className="w-5 h-5"
                        />
                        <label className="font-medium">{exercise.label}</label>
                      </div>

                      {afternoonExercises[exercise.key].done && (
                        <div className="grid grid-cols-2 gap-3 ml-8">
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">Duration (min)</label>
                            <input
                              type="number"
                              name={`${exercise.inputName}AfternoonDuration`}
                              min="0"
                              value={afternoonExercises[exercise.key].duration || ''}
                              onChange={(e) => setAfternoonExercises(prev => ({
                                ...prev,
                                [exercise.key]: { ...prev[exercise.key], duration: parseInt(e.target.value) || 0 }
                              }))}
                              className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">Participation (1-5)</label>
                            <div className="flex gap-1">
                              {[1, 2, 3, 4, 5].map((level) => (
                                <input
                                  key={level}
                                  type="radio"
                                  name={`${exercise.inputName}AfternoonParticipation`}
                                  value={level}
                                  checked={afternoonExercises[exercise.key].participation === level}
                                  onChange={() => setAfternoonExercises(prev => ({
                                    ...prev,
                                    [exercise.key]: { ...prev[exercise.key], participation: level }
                                  }))}
                                  className="w-6 h-6"
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium mb-1">Session Notes</label>
                  <textarea
                    name="afternoonExerciseNotes"
                    value={afternoonExerciseNotes}
                    onChange={(e) => setAfternoonExerciseNotes(e.target.value)}
                    placeholder="Any observations about the afternoon exercise session..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    rows={2}
                  />
                </div>
              </div>

              {/* Movement Difficulties Assessment */}
              <div className="bg-blue-50 p-4 rounded-lg space-y-4">
                <h3 className="font-semibold text-lg">Movement Difficulties Assessment</h3>

                <div className="space-y-3">
                  {[
                    { key: 'gettingOutOfBed', label: 'Getting out of bed', name: 'gettingOutOfBed' },
                    { key: 'gettingIntoBed', label: 'Getting into bed', name: 'gettingIntoBed' },
                    { key: 'sittingInChair', label: 'Sitting down in chair', name: 'sittingInChair' },
                    { key: 'gettingUpFromChair', label: 'Getting up from chair', name: 'gettingUpFromChair' },
                    { key: 'gettingInCar', label: 'Getting in car', name: 'gettingInCar' },
                    { key: 'gettingOutOfCar', label: 'Getting out of car', name: 'gettingOutOfCar' },
                  ].map((activity) => (
                    <div key={activity.key} className="border border-gray-200 rounded-md p-3 bg-white">
                      <label className="block font-medium mb-2">{activity.label}</label>

                      <div className="grid grid-cols-4 gap-2 mb-2">
                        {[
                          { value: 'canDoAlone', label: 'Can Do Alone' },
                          { value: 'needsSomeHelp', label: 'Needs Some Help' },
                          { value: 'needsFullHelp', label: 'Needs Full Help' },
                          { value: 'fallsDropsHard', label: 'Falls/Drops Hard' },
                        ].map((level) => (
                          <label key={level.value} className="flex items-center gap-1 text-xs">
                            <input
                              type="radio"
                              name={activity.name}
                              value={level.value}
                              checked={movementDifficulties[activity.key].level === level.value}
                              onChange={(e) => setMovementDifficulties(prev => ({
                                ...prev,
                                [activity.key]: { ...prev[activity.key], level: e.target.value }
                              }))}
                              className="w-4 h-4"
                            />
                            <span>{level.label}</span>
                          </label>
                        ))}
                      </div>

                      {movementDifficulties[activity.key].level && movementDifficulties[activity.key].level !== 'canDoAlone' && (
                        <input
                          type="text"
                          name={`${activity.name}Notes`}
                          value={movementDifficulties[activity.key].notes}
                          onChange={(e) => setMovementDifficulties(prev => ({
                            ...prev,
                            [activity.key]: { ...prev[activity.key], notes: e.target.value }
                          }))}
                          placeholder="Additional notes..."
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm mt-2"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Navigation */}
              <div className="flex gap-3">
                <Button onClick={() => setCurrentSection(10)} variant="outline" className="flex-1">
                  ← Back
                </Button>
                <Button onClick={() => setCurrentSection(12)} variant="primary" className="flex-1">
                  Review & Submit →
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Section 12: Oral Care & Hygiene - Hidden (not in template) */}

        {/* Section 12: Special Concerns & Incidents */}
        {currentSection === 12 && (
          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold">⚠️ Special Concerns & Incidents</h2>
              <p className="text-sm text-gray-500 mt-1">All fields are optional. Document any concerns, behavioral changes, or incidents.</p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Priority Level */}
              <div>
                <label className="block text-sm font-medium mb-2">Priority Level</label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { value: 'routine', label: 'ℹ️ Routine', color: 'bg-blue-100 border-blue-300 hover:bg-blue-200' },
                    { value: 'urgent', label: '⚠️ Urgent', color: 'bg-orange-100 border-orange-300 hover:bg-orange-200' },
                    { value: 'emergency', label: '🚨 Emergency', color: 'bg-red-100 border-red-300 hover:bg-red-200' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setPriorityLevel(option.value as 'emergency' | 'urgent' | 'routine')}
                      className={`p-4 border-2 rounded-lg text-center font-medium transition-colors ${
                        priorityLevel === option.value
                          ? option.color + ' ring-2 ring-offset-2 ring-primary-500'
                          : 'bg-white border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                {priorityLevel === 'emergency' && (
                  <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
                    ⚠️ Emergency priority will alert family members immediately
                  </div>
                )}
              </div>

              {/* Behavioural Changes */}
              <div>
                <label className="block text-sm font-medium mb-2">Behavioural Changes Observed</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: 'increased_agitation', label: 'Increased Agitation' },
                    { value: 'increased_confusion', label: 'Increased Confusion' },
                    { value: 'increased_anxiety', label: 'Increased Anxiety' },
                    { value: 'withdrawal', label: 'Withdrawal' },
                    { value: 'aggression', label: 'Aggression' },
                    { value: 'sleep_disturbance', label: 'Sleep Disturbance' },
                    { value: 'appetite_change', label: 'Appetite Change' },
                    { value: 'hallucinations', label: 'Hallucinations' },
                    { value: 'delusions', label: 'Delusions' },
                    { value: 'repetitive_behaviors', label: 'Repetitive Behaviors' },
                    { value: 'wandering', label: 'Wandering' },
                    { value: 'sundowning', label: 'Sundowning' },
                    { value: 'mood_swings', label: 'Mood Swings' },
                  ].map((change) => (
                    <label key={change.value} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
                      <input
                        type="checkbox"
                        checked={behaviouralChanges.includes(change.value)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setBehaviouralChanges([...behaviouralChanges, change.value]);
                          } else {
                            setBehaviouralChanges(behaviouralChanges.filter(c => c !== change.value));
                          }
                        }}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm">{change.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Physical Changes */}
              <div>
                <label className="block text-sm font-medium mb-2">Physical Changes or Symptoms</label>
                <textarea
                  value={physicalChanges}
                  onChange={(e) => setPhysicalChanges(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Describe any physical changes, symptoms, or health concerns..."
                />
              </div>

              {/* Incident Description */}
              <div>
                <label className="block text-sm font-medium mb-2">Incident Description</label>
                <textarea
                  value={incidentDescription}
                  onChange={(e) => setIncidentDescription(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Provide detailed description of any incidents (falls, accidents, conflicts, etc.)..."
                />
              </div>

              {/* Actions Taken */}
              <div>
                <label className="block text-sm font-medium mb-2">Actions Taken</label>
                <textarea
                  value={actionsTaken}
                  onChange={(e) => setActionsTaken(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Describe what actions were taken in response..."
                />
              </div>

              {/* Additional Notes */}
              <div>
                <label className="block text-sm font-medium mb-2">Additional Notes</label>
                <textarea
                  value={specialConcernsNotes}
                  onChange={(e) => setSpecialConcernsNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Any other relevant information..."
                />
              </div>

              {/* Navigation Buttons */}
              <div className="flex justify-between pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCurrentSection(11)}
                >
                  ← Back: Physical Activity
                </Button>
                <Button
                  type="button"
                  onClick={() => setCurrentSection(13)}
                >
                  Next: Notes & Submit →
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Section 13: Notes & Submit */}
        {currentSection === 13 && (
          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold">📝 Notes & Submit</h2>
              <p className="text-sm text-gray-500 mt-1">Add any final notes and submit your care report.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4 flex items-start gap-3">
                <input
                  type="checkbox"
                  id="emergency"
                  checked={emergencyFlag}
                  onChange={(e) => setEmergencyFlag(e.target.checked)}
                  className="w-5 h-5 mt-0.5"
                />
                <label htmlFor="emergency" className="flex-1">
                  <span className="font-semibold text-yellow-900">Emergency or Alert</span>
                  <p className="text-sm text-yellow-800 mt-1">
                    Check this if there was a fall, injury, or urgent situation
                  </p>
                </label>
              </div>

              {emergencyFlag && (
                <textarea
                  value={emergencyNote}
                  onChange={(e) => setEmergencyNote(e.target.value)}
                  placeholder="Describe the emergency or alert..."
                  className="w-full px-4 py-3 border-2 border-error rounded-lg focus:outline-none focus:ring-2 focus:ring-error"
                  rows={3}
                />
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  General Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any additional observations or notes..."
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  rows={4}
                />
              </div>

              {/* Sprint 3 Day 4: Activities & Social Interaction */}
              <div className="border-t pt-4 mt-4">
                <h3 className="font-semibold text-gray-900 mb-4">📱 Activities & Social Interaction</h3>
                <div className="space-y-4">
                  {/* Phone Activities */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Phone Activities</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { value: 'youtube', label: '📺 YouTube/Videos' },
                        { value: 'texting', label: '💬 Texting' },
                        { value: 'calls', label: '📞 Phone Calls' },
                        { value: 'none', label: '❌ None' },
                      ].map(({ value, label }) => (
                        <label key={value} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50">
                          <input
                            type="checkbox"
                            checked={phoneActivities.includes(value as 'youtube' | 'texting' | 'calls' | 'none')}
                            onChange={(e) => {
                              if (value === 'none') {
                                setPhoneActivities(e.target.checked ? ['none'] : []);
                              } else {
                                if (e.target.checked) {
                                  setPhoneActivities(prev => [...prev.filter(p => p !== 'none'), value as 'youtube' | 'texting' | 'calls']);
                                } else {
                                  setPhoneActivities(prev => prev.filter(p => p !== value));
                                }
                              }
                            }}
                            className="w-4 h-4"
                          />
                          <span className="text-sm">{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Engagement Level */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Overall Engagement Level (1-5)
                    </label>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((level) => (
                        <button
                          key={level}
                          type="button"
                          onClick={() => setEngagementLevel(engagementLevel === level ? null : level)}
                          className={`flex-1 py-2 rounded-lg transition-colors ${
                            engagementLevel === level
                              ? 'bg-primary-500 text-white'
                              : 'bg-gray-100 hover:bg-gray-200'
                          }`}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>Withdrawn</span>
                      <span>Very Engaged</span>
                    </div>
                  </div>

                  {/* Other Activities */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Other Activities</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { value: 'conversation', label: '💬 Conversation' },
                        { value: 'prayer', label: '🙏 Prayer' },
                        { value: 'reading', label: '📖 Reading' },
                        { value: 'watching_tv', label: '📺 Watching TV' },
                        { value: 'listening_music', label: '🎵 Listening to Music' },
                        { value: 'games', label: '🎮 Games/Puzzles' },
                        { value: 'none', label: '❌ None' },
                      ].map(({ value, label }) => (
                        <label key={value} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50">
                          <input
                            type="checkbox"
                            checked={otherActivities.includes(value as 'phone' | 'conversation' | 'prayer' | 'reading' | 'watching_tv' | 'listening_music' | 'games' | 'none')}
                            onChange={(e) => {
                              if (value === 'none') {
                                setOtherActivities(e.target.checked ? ['none'] : []);
                              } else {
                                if (e.target.checked) {
                                  setOtherActivities(prev => [...prev.filter(p => p !== 'none'), value as 'conversation' | 'prayer' | 'reading' | 'watching_tv' | 'listening_music' | 'games']);
                                } else {
                                  setOtherActivities(prev => prev.filter(p => p !== value));
                                }
                              }
                            }}
                            className="w-4 h-4"
                          />
                          <span className="text-sm">{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Relaxation Periods */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Relaxation Periods</label>
                    <div className="space-y-3">
                      {relaxationPeriods.map((period, index) => (
                        <div key={index} className="bg-gray-50 p-3 rounded-lg space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium">Period {index + 1}</span>
                            <button
                              type="button"
                              onClick={() => setRelaxationPeriods(prev => prev.filter((_, i) => i !== index))}
                              className="text-red-500 text-sm"
                            >
                              Remove
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-xs text-gray-500">Start Time</label>
                              <Input
                                type="time"
                                value={period.startTime}
                                onChange={(e) => {
                                  const updated = [...relaxationPeriods];
                                  updated[index] = { ...period, startTime: e.target.value };
                                  setRelaxationPeriods(updated);
                                }}
                              />
                            </div>
                            <div>
                              <label className="text-xs text-gray-500">End Time</label>
                              <Input
                                type="time"
                                value={period.endTime}
                                onChange={(e) => {
                                  const updated = [...relaxationPeriods];
                                  updated[index] = { ...period, endTime: e.target.value };
                                  setRelaxationPeriods(updated);
                                }}
                              />
                            </div>
                          </div>
                          <div>
                            <label className="text-xs text-gray-500">Activity</label>
                            <select
                              value={period.activity}
                              onChange={(e) => {
                                const updated = [...relaxationPeriods];
                                updated[index] = { ...period, activity: e.target.value as 'resting' | 'sleeping' | 'watching_tv' | 'listening_music' | 'quiet_time' };
                                setRelaxationPeriods(updated);
                              }}
                              className="w-full px-3 py-2 border rounded-lg"
                            >
                              <option value="resting">😌 Resting</option>
                              <option value="sleeping">😴 Sleeping</option>
                              <option value="watching_tv">📺 Watching TV</option>
                              <option value="listening_music">🎵 Listening to Music</option>
                              <option value="quiet_time">🤫 Quiet Time</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-xs text-gray-500">Mood During</label>
                            <select
                              value={period.mood}
                              onChange={(e) => {
                                const updated = [...relaxationPeriods];
                                updated[index] = { ...period, mood: e.target.value as 'happy' | 'calm' | 'restless' | 'bored' | 'engaged' };
                                setRelaxationPeriods(updated);
                              }}
                              className="w-full px-3 py-2 border rounded-lg"
                            >
                              <option value="happy">😊 Happy</option>
                              <option value="calm">😌 Calm</option>
                              <option value="restless">😟 Restless</option>
                              <option value="bored">😐 Bored</option>
                              <option value="engaged">🤗 Engaged</option>
                            </select>
                          </div>
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setRelaxationPeriods(prev => [...prev, {
                          startTime: '',
                          endTime: '',
                          activity: 'resting',
                          mood: 'calm',
                        }])}
                        className="w-full"
                      >
                        + Add Relaxation Period
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sprint 3 Day 3: Structured Caregiver Notes */}
              <div className="border-t pt-4 mt-4">
                <h3 className="font-semibold text-gray-900 mb-4">📋 Daily Summary for Family</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      What Went Well Today?
                    </label>
                    <textarea
                      value={whatWentWell}
                      onChange={(e) => setWhatWentWell(e.target.value)}
                      placeholder="Positive moments, achievements, or good experiences..."
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      rows={3}
                      maxLength={1000}
                    />
                    <p className="text-xs text-gray-500 mt-1">{whatWentWell.length}/1000 characters</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Challenges Faced
                    </label>
                    <textarea
                      value={challengesFaced}
                      onChange={(e) => setChallengesFaced(e.target.value)}
                      placeholder="Any difficulties or concerns encountered..."
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      rows={3}
                      maxLength={1000}
                    />
                    <p className="text-xs text-gray-500 mt-1">{challengesFaced.length}/1000 characters</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Recommendations for Tomorrow
                    </label>
                    <textarea
                      value={recommendationsForTomorrow}
                      onChange={(e) => setRecommendationsForTomorrow(e.target.value)}
                      placeholder="Suggestions for next caregiver or things to try..."
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      rows={3}
                      maxLength={1000}
                    />
                    <p className="text-xs text-gray-500 mt-1">{recommendationsForTomorrow.length}/1000 characters</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Important Info for Family
                    </label>
                    <textarea
                      value={importantInfoForFamily}
                      onChange={(e) => setImportantInfoForFamily(e.target.value)}
                      placeholder="Key information family members should know..."
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      rows={3}
                      maxLength={1000}
                    />
                    <p className="text-xs text-gray-500 mt-1">{importantInfoForFamily.length}/1000 characters</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Caregiver Signature
                    </label>
                    <input
                      type="text"
                      value={caregiverSignature}
                      onChange={(e) => setCaregiverSignature(e.target.value)}
                      placeholder="Your name as signature..."
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                      maxLength={200}
                    />
                  </div>
                </div>
              </div>

              {/* Progressive Section Sharing */}
              {logStatus === 'draft' && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <h4 className="font-semibold text-purple-900 mb-3 flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Share Progress with Family
                  </h4>
                  <p className="text-sm text-purple-700 mb-4">
                    Share sections with family as you complete them throughout the day. They'll see your updates in real-time.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {/* Morning Section */}
                    <button
                      onClick={() => handleShareSection('morning')}
                      disabled={submitSectionMutation.isPending || !!completedSections.morning}
                      className={`p-3 rounded-lg border-2 text-left transition-colors ${
                        completedSections.morning
                          ? 'bg-green-100 border-green-300 cursor-default'
                          : 'bg-white border-purple-200 hover:border-purple-400 hover:bg-purple-50'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">🌅</span>
                        <span className="font-medium text-gray-900">Morning</span>
                        {completedSections.morning && <CheckCircle className="h-4 w-4 text-green-600 ml-auto" />}
                      </div>
                      <p className="text-xs text-gray-600">
                        {completedSections.morning
                          ? `Shared at ${new Date(completedSections.morning.submittedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
                          : 'Wake up, shower, medications, meals, vitals'}
                      </p>
                    </button>

                    {/* Afternoon Section */}
                    <button
                      onClick={() => handleShareSection('afternoon')}
                      disabled={submitSectionMutation.isPending || !!completedSections.afternoon}
                      className={`p-3 rounded-lg border-2 text-left transition-colors ${
                        completedSections.afternoon
                          ? 'bg-green-100 border-green-300 cursor-default'
                          : 'bg-white border-purple-200 hover:border-purple-400 hover:bg-purple-50'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">☀️</span>
                        <span className="font-medium text-gray-900">Afternoon</span>
                        {completedSections.afternoon && <CheckCircle className="h-4 w-4 text-green-600 ml-auto" />}
                      </div>
                      <p className="text-xs text-gray-600">
                        {completedSections.afternoon
                          ? `Shared at ${new Date(completedSections.afternoon.submittedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
                          : 'Toileting, rest & sleep tracking'}
                      </p>
                    </button>

                    {/* Evening Section */}
                    <button
                      onClick={() => handleShareSection('evening')}
                      disabled={submitSectionMutation.isPending || !!completedSections.evening}
                      className={`p-3 rounded-lg border-2 text-left transition-colors ${
                        completedSections.evening
                          ? 'bg-green-100 border-green-300 cursor-default'
                          : 'bg-white border-purple-200 hover:border-purple-400 hover:bg-purple-50'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">🌙</span>
                        <span className="font-medium text-gray-900">Evening</span>
                        {completedSections.evening && <CheckCircle className="h-4 w-4 text-green-600 ml-auto" />}
                      </div>
                      <p className="text-xs text-gray-600">
                        {completedSections.evening
                          ? `Shared at ${new Date(completedSections.evening.submittedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
                          : 'Physical activity & exercise'}
                      </p>
                    </button>

                    {/* Daily Summary Section */}
                    <button
                      onClick={() => handleShareSection('dailySummary')}
                      disabled={submitSectionMutation.isPending || !!completedSections.dailySummary}
                      className={`p-3 rounded-lg border-2 text-left transition-colors ${
                        completedSections.dailySummary
                          ? 'bg-green-100 border-green-300 cursor-default'
                          : 'bg-white border-purple-200 hover:border-purple-400 hover:bg-purple-50'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">📋</span>
                        <span className="font-medium text-gray-900">Daily Summary</span>
                        {completedSections.dailySummary && <CheckCircle className="h-4 w-4 text-green-600 ml-auto" />}
                      </div>
                      <p className="text-xs text-gray-600">
                        {completedSections.dailySummary
                          ? `Shared at ${new Date(completedSections.dailySummary.submittedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
                          : 'Safety, concerns, notes'}
                      </p>
                    </button>
                  </div>
                  {submitSectionMutation.isPending && (
                    <p className="text-sm text-purple-600 mt-3 text-center">Sharing with family...</p>
                  )}
                  {Object.keys(completedSections).length > 0 && Object.keys(completedSections).length < 4 && (
                    <p className="text-xs text-purple-600 mt-3 text-center">
                      {4 - Object.keys(completedSections).length} section{4 - Object.keys(completedSections).length !== 1 ? 's' : ''} remaining
                    </p>
                  )}
                </div>
              )}

              {/* Submit Section */}
              {isLocked ? (
                <div className="mt-6">
                  {logStatus === 'submitted' && (
                    <div className="bg-green-50 border-2 border-green-200 rounded-lg p-6 text-center">
                      <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-3" />
                      <h3 className="text-lg font-semibold text-green-900 mb-2">
                        Report Submitted Successfully!
                      </h3>
                      <p className="text-sm text-green-800">
                        Your care report has been submitted and is now locked. The family will be able to view it.
                      </p>
                      <Button
                        onClick={() => navigate({ to: '/caregiver/form' })}
                        variant="primary"
                        className="mt-4"
                      >
                        Create New Report for Tomorrow
                      </Button>
                    </div>
                  )}
                  {logStatus === 'invalidated' && (
                    <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6 text-center">
                      <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-3" />
                      <h3 className="text-lg font-semibold text-red-900 mb-2">
                        Report Flagged for Correction
                      </h3>
                      <p className="text-sm text-red-800 mb-4">
                        The family has flagged this report. Please review and create a new corrected report.
                      </p>
                      <Button
                        onClick={() => {
                          setLogStatus('draft');
                          setCareLogId(null);
                          setCurrentSection(1);
                        }}
                        variant="primary"
                        className="bg-red-600 hover:bg-red-700"
                      >
                        Create Corrected Report
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Summary of entered data */}
                  {allSectionsComplete && (
                    <div className="bg-blue-50 border border-blue-300 rounded-lg p-4">
                      <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                        <CheckCircle className="h-5 w-5" />
                        Review Your Report
                      </h4>
                      <div className="space-y-2 text-sm text-blue-800">
                        {/* Morning Routine */}
                        {wakeTime && <p>🌅 Wake time: {wakeTime}</p>}
                        {mood && <p>😊 Mood: {mood}</p>}
                        {showerTime && <p>🚿 Shower: {showerTime}{hairWash ? ' (hair washed)' : ''}</p>}

                        {/* Medications */}
                        {medications.filter(m => m.given).length > 0 && (
                          <div>
                            <p className="font-semibold">💊 Medications given:</p>
                            <ul className="ml-4 space-y-1">
                              {medications.filter(m => m.given).map((m, idx) => (
                                <li key={idx}>• {m.name} at {m.time || '(time not recorded)'}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Meals */}
                        {(breakfastTime || lunchTime || teaBreakTime || dinnerTime) && (
                          <div>
                            <p className="font-semibold">🍽️ Meals:</p>
                            <ul className="ml-4 space-y-1">
                              {breakfastTime && (
                                <li>• Breakfast: {breakfastTime} - Appetite: {breakfastAppetite}/5, Eaten: {breakfastAmount}%{breakfastAssistance !== 'none' ? ` (${breakfastAssistance} assist)` : ''}</li>
                              )}
                              {lunchTime && (
                                <li>• Lunch: {lunchTime} - Appetite: {lunchAppetite}/5, Eaten: {lunchAmount}%{lunchAssistance !== 'none' ? ` (${lunchAssistance} assist)` : ''}</li>
                              )}
                              {teaBreakTime && (
                                <li>• Tea Break: {teaBreakTime} - Appetite: {teaBreakAppetite}/5, Eaten: {teaBreakAmount}%</li>
                              )}
                              {dinnerTime && (
                                <li>• Dinner: {dinnerTime} - Appetite: {dinnerAppetite}/5, Eaten: {dinnerAmount}%{dinnerAssistance !== 'none' ? ` (${dinnerAssistance} assist)` : ''}</li>
                              )}
                            </ul>
                          </div>
                        )}
                        {foodPreferences && <p>👍 Food preferences: {foodPreferences}</p>}
                        {foodRefusals && <p>👎 Food refusals: {foodRefusals}</p>}

                        {/* Vitals */}
                        {(bloodPressure || pulseRate || oxygenLevel || bloodSugar) && (
                          <div>
                            <p className="font-semibold">❤️ Vital Signs {vitalsTime && `at ${vitalsTime}`}:</p>
                            <ul className="ml-4 space-y-1">
                              {bloodPressure && <li>• Blood Pressure: {bloodPressure}</li>}
                              {pulseRate && <li>• Pulse: {pulseRate} bpm</li>}
                              {oxygenLevel && <li>• Oxygen: {oxygenLevel}%</li>}
                              {bloodSugar && <li>• Blood Sugar: {bloodSugar} mmol/L</li>}
                            </ul>
                          </div>
                        )}

                        {/* Toileting */}
                        {(bowelFreq > 0 || urineFreq > 0 || toiletingDiaperChanges) && (
                          <p>🚽 Toileting: {bowelFreq} bowel, {urineFreq} urine, {toiletingDiaperChanges || 0} diaper changes</p>
                        )}

                        {/* Fall Risk */}
                        {balanceIssues !== null && (
                          <p>⚠️ Balance Issues: Level {balanceIssues}/5</p>
                        )}
                        {nearFalls !== 'none' && (
                          <p>⚠️ Near Falls: {nearFalls.replace('_', ' ')}</p>
                        )}
                        {actualFalls !== 'none' && (
                          <p className="font-semibold text-red-700">🚨 Actual Falls: {actualFalls}</p>
                        )}
                        {walkingPattern.length > 0 && (
                          <p>🚶 Walking Pattern: {walkingPattern.map(p => p.replace(/_/g, ' ')).join(', ')}</p>
                        )}
                        {freezingEpisodes !== 'none' && (
                          <p>❄️ Freezing Episodes: {freezingEpisodes}</p>
                        )}

                        {/* Unaccompanied Time */}
                        {unaccompaniedTime.length > 0 && (
                          <div>
                            <p className="font-semibold">⏱️ Unaccompanied Time:</p>
                            <ul className="ml-4 space-y-1">
                              {unaccompaniedTime.map((period, idx) => (
                                <li key={idx}>
                                  • {period.startTime} - {period.endTime} ({calculateDuration(period.startTime, period.endTime)} min): {period.reason}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Safety Checks */}
                        {Object.values(safetyChecks).some(v => v.checked) && (
                          <p>🔒 Safety Checks: {Object.values(safetyChecks).filter(v => v.checked).length}/6 completed</p>
                        )}

                        {/* Emergency Prep */}
                        {Object.values(emergencyPrep).some(v => v) && (
                          <p>🚑 Emergency Equipment: {Object.values(emergencyPrep).filter(v => v).length}/7 available</p>
                        )}

                        {/* Notes */}
                        {emergencyFlag && (
                          <p className="font-semibold text-red-700">🚨 EMERGENCY ALERT: {emergencyNote}</p>
                        )}
                        {notes && <p>📝 Notes: {notes.substring(0, 100)}{notes.length > 100 ? '...' : ''}</p>}
                      </div>
                    </div>
                  )}

                  {/* Validation warnings */}
                  {!allSectionsComplete && (
                    <div className="bg-amber-50 border border-amber-300 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <h4 className="font-semibold text-amber-900 mb-2">
                            Please complete the following before submitting:
                          </h4>
                          <ul className="space-y-1">
                            {Object.entries(sectionValidation).map(([sectionId, validation]) => {
                              if (!validation.complete && validation.missing.length > 0) {
                                const section = sections.find(s => s.id === parseInt(sectionId));
                                return (
                                  <li key={sectionId} className="text-sm text-amber-800">
                                    <button
                                      onClick={() => setCurrentSection(parseInt(sectionId))}
                                      className="hover:underline font-medium"
                                    >
                                      {section?.emoji} {section?.title}:
                                    </button>
                                    <ul className="ml-6 mt-1">
                                      {validation.missing.map((field, idx) => (
                                        <li key={idx} className="text-amber-700">• {field}</li>
                                      ))}
                                    </ul>
                                  </li>
                                );
                              }
                              return null;
                            })}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <Button onClick={() => setCurrentSection(12)} variant="outline" className="flex-1">
                      ← Back
                    </Button>
                    <Button
                      onClick={handleSubmit}
                      variant="primary"
                      size="lg"
                      className="flex-1 bg-green-600 hover:bg-green-700"
                      disabled={submitMutation.isPending || isSaving || !allSectionsComplete}
                    >
                      {submitMutation.isPending ? 'Submitting...' : allSectionsComplete ? 'Submit Report ✅' : 'Complete Required Fields'}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
