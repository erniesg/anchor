import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useMutation } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useAutoSave } from '@/hooks/use-auto-save';
import { Save, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { authenticatedApiCall } from '@/lib/api';

export const Route = createFileRoute('/caregiver/form')({
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

  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);

  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;

  return endMinutes - startMinutes;
};

function CareLogFormComponent() {
  const navigate = useNavigate();
  const [currentSection, setCurrentSection] = useState(1);
  const [careLogId, setCareLogId] = useState<string | null>(null);
  const [logStatus, setLogStatus] = useState<'draft' | 'submitted' | 'invalidated'>('draft');

  // Morning Routine
  const [wakeTime, setWakeTime] = useState('');
  const [mood, setMood] = useState('');
  const [showerTime, setShowerTime] = useState('');
  const [hairWash, setHairWash] = useState(false);

  // Medications (Sprint 2 Day 4: Added purpose and notes)
  const [medications, setMedications] = useState([
    { name: 'Glucophage 500mg', given: false, time: null, timeSlot: 'before_breakfast' as const, purpose: '', notes: '' },
    { name: 'Forxiga 10mg', given: false, time: null, timeSlot: 'after_breakfast' as const, purpose: '', notes: '' },
    { name: 'Ozempic 0.5mg', given: false, time: null, timeSlot: 'afternoon' as const, purpose: '', notes: '' },
  ]);

  // Meals
  const [breakfastTime, setBreakfastTime] = useState('');
  const [breakfastAppetite, setBreakfastAppetite] = useState(0);
  const [breakfastAmount, setBreakfastAmount] = useState(0);

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
  // Bowel Movements
  const [bowelFreq, setBowelFreq] = useState(0);
  const [bowelTimesUsedToilet, setBowelTimesUsedToilet] = useState<number | null>(null);
  const [bowelDiaperChanges, setBowelDiaperChanges] = useState<number | null>(null);
  const [bowelDiaperStatus, setBowelDiaperStatus] = useState<'dry' | 'wet' | 'soiled' | null>(null);
  const [bowelAccidents, setBowelAccidents] = useState<'none' | 'minor' | 'major'>('none');
  const [bowelAssistance, setBowelAssistance] = useState<'none' | 'partial' | 'full'>('none');
  const [bowelPain, setBowelPain] = useState<'no_pain' | 'some_pain' | 'very_painful'>('no_pain');
  const [bowelConsistency, setBowelConsistency] = useState<'normal' | 'hard' | 'soft' | 'loose' | 'diarrhea' | null>(null);
  const [bowelConcerns, setBowelConcerns] = useState('');

  // Urination
  const [urineFreq, setUrineFreq] = useState(0);
  const [urineTimesUsedToilet, setUrineTimesUsedToilet] = useState<number | null>(null);
  const [urineDiaperChanges, setUrineDiaperChanges] = useState<number | null>(null);
  const [urineDiaperStatus, setUrineDiaperStatus] = useState<'dry' | 'wet' | 'soiled' | null>(null);
  const [urineAccidents, setUrineAccidents] = useState<'none' | 'minor' | 'major'>('none');
  const [urineAssistance, setUrineAssistance] = useState<'none' | 'partial' | 'full'>('none');
  const [urinePain, setUrinePain] = useState<'no_pain' | 'some_pain' | 'very_painful'>('no_pain');
  const [urineColor, setUrineColor] = useState<'light_clear' | 'yellow' | 'dark_yellow' | 'brown' | 'dark' | null>(null);
  const [urineConcerns, setUrineConcerns] = useState('');

  // Legacy (to be removed after migration)
  const [diaperChanges, setDiaperChanges] = useState(0);

  // Sprint 3 Day 1: Spiritual & Emotional Well-Being
  const [prayerStartTime, setPrayerStartTime] = useState('');
  const [prayerEndTime, setPrayerEndTime] = useState('');
  const [prayerExpression, setPrayerExpression] = useState<'speaking_out_loud' | 'whispering' | 'mumbling' | 'silent_worship' | ''>('');
  const [overallMood, setOverallMood] = useState<number | null>(null);
  const [communicationScale, setCommunicationScale] = useState<number | null>(null);
  const [socialInteraction, setSocialInteraction] = useState<'engaged' | 'responsive' | 'withdrawn' | 'aggressive_hostile' | ''>('');

  // Sprint 3 Day 2: Physical Activity & Exercise
  const [exerciseDuration, setExerciseDuration] = useState<number | null>(null);
  const [exerciseType, setExerciseType] = useState<string[]>([]);
  const [walkingDistance, setWalkingDistance] = useState('');
  const [assistanceLevel, setAssistanceLevel] = useState<'none' | 'minimal' | 'moderate' | 'full' | ''>('');
  const [painDuringActivity, setPainDuringActivity] = useState<'none' | 'mild' | 'moderate' | 'severe' | ''>('');
  const [energyAfterActivity, setEnergyAfterActivity] = useState<'energized' | 'tired' | 'exhausted' | 'same' | ''>('');
  const [participationWillingness, setParticipationWillingness] = useState<'enthusiastic' | 'willing' | 'reluctant' | 'refused' | ''>('');
  const [equipmentUsed, setEquipmentUsed] = useState<string[]>([]);
  const [mobilityNotes, setMobilityNotes] = useState('');

  // Sprint 3 Day 3: Oral Care & Hygiene
  const [teethBrushed, setTeethBrushed] = useState(false);
  const [timesBrushed, setTimesBrushed] = useState<number | null>(null);
  const [denturesCleaned, setDenturesCleaned] = useState(false);
  const [mouthRinsed, setMouthRinsed] = useState(false);
  const [oralAssistanceLevel, setOralAssistanceLevel] = useState<'none' | 'minimal' | 'moderate' | 'full' | ''>('');
  const [oralHealthIssues, setOralHealthIssues] = useState<string[]>([]);
  const [painOrBleeding, setPainOrBleeding] = useState(false);
  const [oralCareNotes, setOralCareNotes] = useState('');

  // Safety
  const [emergencyFlag, setEmergencyFlag] = useState(false);
  const [emergencyNote, setEmergencyNote] = useState('');
  const [notes, setNotes] = useState('');

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

  // Get care recipient ID (mock for now - should come from caregiver session)
  const careRecipientId = localStorage.getItem('careRecipientId') || '';
  const caregiverToken = localStorage.getItem('caregiverToken') || '';

  // Get care recipient demographics for personalized validation
  const careRecipient = useMemo(() => {
    return JSON.parse(localStorage.getItem('careRecipient') || '{}');
  }, []);

  const recipientAge = useMemo(() => {
    if (!careRecipient.dateOfBirth) return null;
    return calculateAge(new Date(careRecipient.dateOfBirth));
  }, [careRecipient]);

  const recipientGender = careRecipient.gender || null;

  // Prepare form data
  const formData = useMemo(() => {
    const recipientId = careRecipient.id;

    // Debug logging
    if (!recipientId) {
      console.error('No care recipient ID found in localStorage');
      console.error('careRecipient:', careRecipient);
    }

    // Helper to omit empty strings and null/undefined values
    const omitEmpty = (value: any) => {
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
      meals: breakfastTime ? {
        breakfast: {
          time: breakfastTime,
          appetite: breakfastAppetite,
          amountEaten: breakfastAmount,
        },
      } : undefined,
      // Sprint 2 Day 2: Fluid Intake
      fluids: fluids.length > 0 ? fluids : undefined,
      // Sprint 2 Day 3: Sleep Tracking
      afternoonRest: afternoonRest,
      nightSleep: nightSleep,
      bloodPressure: omitEmpty(bloodPressure),
      pulseRate: pulseRate ? parseInt(pulseRate) : undefined,
      oxygenLevel: oxygenLevel ? parseInt(oxygenLevel) : undefined,
      bloodSugar: bloodSugar ? parseFloat(bloodSugar) : undefined,
      vitalsTime: omitEmpty(vitalsTime),
      // Sprint 2 Day 5: Complete Toileting & Hygiene Tracking
      bowelMovements: bowelFreq > 0 ? {
        frequency: bowelFreq,
        timesUsedToilet: bowelTimesUsedToilet !== null ? bowelTimesUsedToilet : undefined,
        diaperChanges: bowelDiaperChanges !== null ? bowelDiaperChanges : undefined,
        diaperStatus: bowelDiaperStatus || undefined,
        accidents: bowelAccidents !== 'none' ? bowelAccidents : undefined,
        assistance: bowelAssistance !== 'none' ? bowelAssistance : undefined,
        pain: bowelPain !== 'no_pain' ? bowelPain : undefined,
        consistency: bowelConsistency || undefined,
        concerns: omitEmpty(bowelConcerns),
      } : undefined,
      urination: urineFreq > 0 ? {
        frequency: urineFreq,
        timesUsedToilet: urineTimesUsedToilet !== null ? urineTimesUsedToilet : undefined,
        diaperChanges: urineDiaperChanges !== null ? urineDiaperChanges : undefined,
        diaperStatus: urineDiaperStatus || undefined,
        accidents: urineAccidents !== 'none' ? urineAccidents : undefined,
        assistance: urineAssistance !== 'none' ? urineAssistance : undefined,
        pain: urinePain !== 'no_pain' ? urinePain : undefined,
        urineColor: urineColor || undefined,
        concerns: omitEmpty(urineConcerns),
      } : undefined,
      // Sprint 1: Fall Risk & Safety
      balanceIssues: balanceIssues !== null ? balanceIssues : undefined,
      nearFalls: nearFalls !== 'none' ? nearFalls : undefined,
      actualFalls: actualFalls !== 'none' ? actualFalls : undefined,
      walkingPattern: walkingPattern.length > 0 ? walkingPattern : undefined,
      freezingEpisodes: freezingEpisodes !== 'none' ? freezingEpisodes : undefined,
      unaccompaniedTime: unaccompaniedTime.length > 0 ? unaccompaniedTime.map(p => ({
        ...p,
        durationMinutes: calculateDuration(p.startTime, p.endTime),
      })) : undefined,
      unaccompaniedIncidents: omitEmpty(unaccompaniedIncidents),
      safetyChecks: Object.values(safetyChecks).some(v => v.checked) ? safetyChecks : undefined,
      emergencyPrep: Object.values(emergencyPrep).some(v => v) ? emergencyPrep : undefined,
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
      // Sprint 3 Day 3: Oral Care & Hygiene
      oralCare: (teethBrushed || timesBrushed || denturesCleaned || mouthRinsed || oralAssistanceLevel || oralHealthIssues.length > 0 || painOrBleeding || oralCareNotes) ? {
        teethBrushed: teethBrushed || undefined,
        timesBrushed: timesBrushed !== null ? timesBrushed : undefined,
        denturesCleaned: denturesCleaned || undefined,
        mouthRinsed: mouthRinsed || undefined,
        assistanceLevel: oralAssistanceLevel || undefined,
        oralHealthIssues: oralHealthIssues.length > 0 ? oralHealthIssues : undefined,
        painOrBleeding: painOrBleeding || undefined,
        notes: omitEmpty(oralCareNotes),
      } : undefined,
      emergencyFlag,
      emergencyNote: omitEmpty(emergencyNote),
      notes: omitEmpty(notes),
    };
  }, [wakeTime, mood, showerTime, hairWash, medications, breakfastTime, breakfastAppetite,
      breakfastAmount, fluids, bloodPressure, pulseRate, oxygenLevel, bloodSugar, vitalsTime,
      // Sprint 2 Day 5: All toileting state variables
      bowelFreq, bowelTimesUsedToilet, bowelDiaperChanges, bowelDiaperStatus, bowelAccidents,
      bowelAssistance, bowelPain, bowelConsistency, bowelConcerns,
      urineFreq, urineTimesUsedToilet, urineDiaperChanges, urineDiaperStatus, urineAccidents,
      urineAssistance, urinePain, urineColor, urineConcerns,
      balanceIssues, nearFalls, actualFalls,
      walkingPattern, freezingEpisodes, unaccompaniedTime, unaccompaniedIncidents, safetyChecks, emergencyPrep,
      // Sprint 3 Day 1: Spiritual & Emotional
      prayerStartTime, prayerEndTime, prayerExpression, overallMood, communicationScale, socialInteraction,
      // Sprint 3 Day 2: Physical Activity
      exerciseDuration, exerciseType, walkingDistance, assistanceLevel, painDuringActivity, energyAfterActivity, participationWillingness, equipmentUsed, mobilityNotes,
      // Sprint 3 Day 3: Oral Care
      teethBrushed, timesBrushed, denturesCleaned, mouthRinsed, oralAssistanceLevel, oralHealthIssues, painOrBleeding, oralCareNotes,
      emergencyFlag, emergencyNote, notes, careRecipient]);

  // Create/Update mutation (for auto-save)
  const saveDraftMutation = useMutation({
    mutationFn: async (data: any) => {
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
      if (!logId) throw new Error('No draft to submit');

      return authenticatedApiCall(`/care-logs/${logId}/submit`, caregiverToken, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      setLogStatus('submitted');
      // Don't use alert() - let the visual success message show instead
      console.log('✅ Care log submitted successfully');
    },
  });

  // Auto-save hook
  const { lastSaved, isSaving, saveError } = useAutoSave({
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
        console.log('Creating draft before submit...');
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

  // Check if form is locked (submitted or invalidated)
  const isLocked = logStatus === 'submitted' || logStatus === 'invalidated';

  // Validation and section completion tracking
  const sectionValidation = useMemo(() => {
    // Track if any data has been entered in each section
    const morningRoutineData = wakeTime || mood || showerTime || hairWash;
    const medicationsData = medications.some(med => med.given || med.time);
    const mealsData = breakfastTime || breakfastAppetite > 0 || breakfastAmount > 0;
    const vitalsData = bloodPressure || pulseRate || oxygenLevel || bloodSugar || vitalsTime;
    const toiletingData = bowelFreq > 0 || urineFreq > 0;
    const fallRiskData = balanceIssues !== null || nearFalls !== 'none' || actualFalls !== 'none' ||
                         walkingPattern.length > 0 || freezingEpisodes !== 'none';
    const unaccompaniedData = unaccompaniedTime.length > 0 || unaccompaniedIncidents;
    const safetyChecksData = Object.values(safetyChecks).some(v => v.checked);
    const notesData = notes || emergencyFlag;

    return {
      1: { // Morning Routine - optional
        complete: true,
        hasData: morningRoutineData,
        missing: [],
      },
      2: { // Medications - if marked as given, need time
        complete: medications.every(med => !med.given || (med.given && med.time !== null && med.time !== '')),
        hasData: medicationsData,
        missing: medications
          .filter(med => med.given && (!med.time || med.time === ''))
          .map(med => `⏰ Time for ${med.name}`),
      },
      3: { // Meals & Nutrition - if time entered, need all fields
        complete: !breakfastTime || (breakfastTime && breakfastAppetite > 0 && breakfastAmount > 0),
        hasData: mealsData,
        missing: [
          ...(breakfastTime && !breakfastAppetite ? ['🍽️ Breakfast appetite (1-5)'] : []),
          ...(breakfastTime && !breakfastAmount ? ['🍽️ Breakfast amount eaten (%)'] : []),
        ],
      },
      4: { // Vital Signs - all optional
        complete: true,
        hasData: vitalsData,
        missing: [],
      },
      5: { // Toileting - optional (at least one recommended)
        complete: true,
        hasData: toiletingData,
        missing: [],
      },
      6: { // Fall Risk & Safety - optional
        complete: true,
        hasData: fallRiskData,
        missing: [],
      },
      7: { // Unaccompanied Time - optional
        complete: true,
        hasData: unaccompaniedData,
        missing: [],
      },
      8: { // Safety Checks - optional
        complete: true,
        hasData: safetyChecksData,
        missing: [],
      },
      9: { // Notes & Submit - optional
        complete: true,
        hasData: notesData,
        missing: [],
      },
    };
  }, [wakeTime, mood, showerTime, hairWash, medications, breakfastTime, breakfastAppetite, breakfastAmount,
      bloodPressure, pulseRate, oxygenLevel, bloodSugar, vitalsTime, bowelFreq, urineFreq, diaperChanges,
      balanceIssues, nearFalls, actualFalls, walkingPattern, freezingEpisodes,
      unaccompaniedTime, unaccompaniedIncidents, safetyChecks, notes, emergencyFlag]);

  const allSectionsComplete = Object.values(sectionValidation).every(s => s.complete);
  const sectionsWithData = Object.values(sectionValidation).filter(s => s.hasData).length;
  const totalSections = Object.keys(sectionValidation).length;
  const completionPercentage = Math.round((sectionsWithData / totalSections) * 100);

  const incompleteSections = Object.entries(sectionValidation)
    .filter(([_, validation]) => !validation.complete)
    .map(([id]) => parseInt(id));

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
    { id: 12, title: 'Oral Care', emoji: '🦷' },
    { id: 13, title: 'Notes & Submit', emoji: '📝' },
  ];

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

            {/* Auto-save status */}
            <div className="flex items-center gap-3">
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
                label="Shower Time (optional)"
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
                      Purpose (optional)
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
                    <Input
                      label="Time given"
                      type="time"
                      value={med.time || ''}
                      onChange={(e) => {
                        const newMeds = [...medications];
                        newMeds[idx].time = e.target.value;
                        setMedications(newMeds);
                      }}
                    />
                  )}

                  {/* Sprint 2 Day 4: Notes field */}
                  <div className="mt-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Notes (optional)
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
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="font-semibold mb-3">Breakfast</h3>
                <Input
                  label="Time"
                  type="time"
                  value={breakfastTime}
                  onChange={(e) => setBreakfastTime(e.target.value)}
                  className="mb-3"
                />
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Appetite (1-5): <span className="font-bold text-primary-600">{breakfastAppetite}</span>
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Amount Eaten: <span className="font-bold text-primary-600">{breakfastAmount}%</span>
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
                      Swallowing Issues (optional)
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
              <p className="text-sm text-gray-600">Track afternoon rest and night sleep quality</p>
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
                        <label className="block text-sm font-medium mb-1">Start Time</label>
                        <Input
                          type="time"
                          value={afternoonRest.startTime}
                          onChange={(e) => setAfternoonRest({ ...afternoonRest, startTime: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">End Time</label>
                        <Input
                          type="time"
                          value={afternoonRest.endTime}
                          onChange={(e) => setAfternoonRest({ ...afternoonRest, endTime: e.target.value })}
                          required
                        />
                      </div>
                    </div>

                    {afternoonRest.startTime && afternoonRest.endTime && (
                      <p className="text-sm text-gray-600">
                        Duration: {calculateDuration(afternoonRest.startTime, afternoonRest.endTime)} minutes
                      </p>
                    )}

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
                            onClick={() => setAfternoonRest({ ...afternoonRest, quality: option.value as any })}
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
                      <label className="block text-sm font-medium mb-1">Notes (optional)</label>
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
                            onClick={() => setNightSleep({ ...nightSleep, quality: option.value as any })}
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
                      <label className="block text-sm font-medium mb-1">Notes (optional)</label>
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

        {/* Section 5: Complete Toileting & Hygiene (Sprint 2 Day 5) */}
        {currentSection === 5 && (
          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold">🚽 Toileting & Hygiene</h2>
              <p className="text-sm text-gray-600 mt-1">Track bowel movements and urination separately</p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Bowel Movements Section */}
              <div className="bg-amber-50 p-4 rounded-lg space-y-4">
                <h3 className="font-semibold text-lg">💩 Bowel Movements</h3>

                <div>
                  <label className="block text-sm font-medium mb-1">Frequency (times today) *</label>
                  <input
                    type="number"
                    min="0"
                    value={bowelFreq}
                    onChange={(e) => setBowelFreq(parseInt(e.target.value) || 0)}
                    className="w-full p-2 border rounded-lg"
                  />
                </div>

                {bowelFreq > 0 && (
                  <>
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

                    <div>
                      <label className="block text-sm font-medium mb-1">Diaper Changes</label>
                      <input
                        type="number"
                        min="0"
                        value={bowelDiaperChanges || ''}
                        onChange={(e) => setBowelDiaperChanges(e.target.value ? parseInt(e.target.value) : null)}
                        className="w-full p-2 border rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Diaper Status</label>
                      <div className="flex gap-2">
                        {[
                          { value: 'dry', label: 'Dry', emoji: '✨' },
                          { value: 'wet', label: 'Wet', emoji: '💧' },
                          { value: 'soiled', label: 'Soiled', emoji: '💩' },
                        ].map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setBowelDiaperStatus(option.value as any)}
                            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                              bowelDiaperStatus === option.value
                                ? 'bg-amber-500 text-white'
                                : 'bg-white border hover:bg-gray-50'
                            }`}
                          >
                            {option.emoji} {option.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Consistency</label>
                      <select
                        value={bowelConsistency || ''}
                        onChange={(e) => setBowelConsistency(e.target.value as any || null)}
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
                      <label className="block text-sm font-medium mb-2">Accidents</label>
                      <div className="flex gap-2">
                        {[
                          { value: 'none', label: 'None' },
                          { value: 'minor', label: 'Minor' },
                          { value: 'major', label: 'Major' },
                        ].map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setBowelAccidents(option.value as any)}
                            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                              bowelAccidents === option.value
                                ? 'bg-amber-500 text-white'
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
                            onClick={() => setBowelAssistance(option.value as any)}
                            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                              bowelAssistance === option.value
                                ? 'bg-amber-500 text-white'
                                : 'bg-white border hover:bg-gray-50'
                            }`}
                          >
                            {option.emoji} {option.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Pain Level</label>
                      <div className="flex gap-2">
                        {[
                          { value: 'no_pain', label: 'No Pain', emoji: '😊' },
                          { value: 'some_pain', label: 'Some Pain', emoji: '😣' },
                          { value: 'very_painful', label: 'Very Painful', emoji: '😫' },
                        ].map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setBowelPain(option.value as any)}
                            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                              bowelPain === option.value
                                ? 'bg-amber-500 text-white'
                                : 'bg-white border hover:bg-gray-50'
                            }`}
                          >
                            {option.emoji} {option.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">Concerns/Notes</label>
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

              {/* Urination Section */}
              <div className="bg-blue-50 p-4 rounded-lg space-y-4">
                <h3 className="font-semibold text-lg">💧 Urination</h3>

                <div>
                  <label className="block text-sm font-medium mb-1">Frequency (times today) *</label>
                  <input
                    type="number"
                    min="0"
                    value={urineFreq}
                    onChange={(e) => setUrineFreq(parseInt(e.target.value) || 0)}
                    className="w-full p-2 border rounded-lg"
                  />
                </div>

                {urineFreq > 0 && (
                  <>
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

                    <div>
                      <label className="block text-sm font-medium mb-1">Diaper Changes</label>
                      <input
                        type="number"
                        min="0"
                        value={urineDiaperChanges || ''}
                        onChange={(e) => setUrineDiaperChanges(e.target.value ? parseInt(e.target.value) : null)}
                        className="w-full p-2 border rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Diaper Status</label>
                      <div className="flex gap-2">
                        {[
                          { value: 'dry', label: 'Dry', emoji: '✨' },
                          { value: 'wet', label: 'Wet', emoji: '💧' },
                          { value: 'soiled', label: 'Soiled', emoji: '💩' },
                        ].map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setUrineDiaperStatus(option.value as any)}
                            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                              urineDiaperStatus === option.value
                                ? 'bg-blue-500 text-white'
                                : 'bg-white border hover:bg-gray-50'
                            }`}
                          >
                            {option.emoji} {option.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Urine Color</label>
                      <select
                        value={urineColor || ''}
                        onChange={(e) => setUrineColor(e.target.value as any || null)}
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
                      <label className="block text-sm font-medium mb-2">Accidents</label>
                      <div className="flex gap-2">
                        {[
                          { value: 'none', label: 'None' },
                          { value: 'minor', label: 'Minor' },
                          { value: 'major', label: 'Major' },
                        ].map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setUrineAccidents(option.value as any)}
                            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                              urineAccidents === option.value
                                ? 'bg-blue-500 text-white'
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
                            onClick={() => setUrineAssistance(option.value as any)}
                            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                              urineAssistance === option.value
                                ? 'bg-blue-500 text-white'
                                : 'bg-white border hover:bg-gray-50'
                            }`}
                          >
                            {option.emoji} {option.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Pain Level</label>
                      <div className="flex gap-2">
                        {[
                          { value: 'no_pain', label: 'No Pain', emoji: '😊' },
                          { value: 'some_pain', label: 'Some Pain', emoji: '😣' },
                          { value: 'very_painful', label: 'Very Painful', emoji: '😫' },
                        ].map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setUrinePain(option.value as any)}
                            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                              urinePain === option.value
                                ? 'bg-blue-500 text-white'
                                : 'bg-white border hover:bg-gray-50'
                            }`}
                          >
                            {option.emoji} {option.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-1">Concerns/Notes</label>
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
                <label className="block text-sm font-medium mb-2">Near Falls</label>
                <select
                  value={nearFalls}
                  onChange={(e) => setNearFalls(e.target.value as any)}
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
                  onChange={(e) => setActualFalls(e.target.value as any)}
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
                  onChange={(e) => setFreezingEpisodes(e.target.value as any)}
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
              <p className="text-sm text-gray-600 mt-1">
                Record any periods when the care recipient was left alone
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
                              Start Time
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
                              className="w-full px-3 py-2 border rounded-lg"
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              End Time
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
                              className="w-full px-3 py-2 border rounded-lg"
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
                              Reason for absence
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
                              className="w-full px-3 py-2 border rounded-lg"
                            />
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
                  Any incidents during unaccompanied time? (optional)
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
              <p className="text-sm text-gray-600 mt-1">
                Complete daily safety checklist and emergency preparedness
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
              <p className="text-sm text-gray-600">Track prayer, mood, and social interactions</p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Prayer Time */}
              <div className="space-y-3">
                <label className="block text-sm font-medium">Prayer Time (optional)</label>
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
                <label className="block text-sm font-medium">Prayer Expression (optional)</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'speaking_out_loud', label: 'Speaking Out Loud' },
                    { value: 'whispering', label: 'Whispering' },
                    { value: 'mumbling', label: 'Mumbling' },
                    { value: 'silent_worship', label: 'Silent Worship' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setPrayerExpression(option.value as any)}
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
                <label className="block text-sm font-medium">Social Interaction (optional)</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'engaged', label: 'Engaged' },
                    { value: 'responsive', label: 'Responsive' },
                    { value: 'withdrawn', label: 'Withdrawn' },
                    { value: 'aggressive_hostile', label: 'Aggressive/Hostile' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setSocialInteraction(option.value as any)}
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

        {/* Section 11: Physical Activity & Exercise */}
        {currentSection === 11 && (
          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold">🏃 Physical Activity & Exercise</h2>
              <p className="text-sm text-gray-600">Track exercise, mobility, and physical therapy</p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Exercise Duration */}
              <div className="space-y-2">
                <label className="block text-sm font-medium">Exercise Duration (minutes)</label>
                <input
                  type="number"
                  min="0"
                  value={exerciseDuration || ''}
                  onChange={(e) => setExerciseDuration(e.target.value ? parseInt(e.target.value) : null)}
                  placeholder="Enter minutes"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>

              {/* Exercise Type (multiple selection) */}
              <div className="space-y-3">
                <label className="block text-sm font-medium">Exercise Type (select all that apply)</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'walking', label: '🚶 Walking' },
                    { value: 'stretching', label: '🧘 Stretching' },
                    { value: 'chair_exercises', label: '🪑 Chair Exercises' },
                    { value: 'outdoor_activity', label: '🌳 Outdoor Activity' },
                    { value: 'physical_therapy', label: '🏥 Physical Therapy' },
                  ].map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => {
                        setExerciseType(prev =>
                          prev.includes(type.value)
                            ? prev.filter(t => t !== type.value)
                            : [...prev, type.value]
                        );
                      }}
                      className={`px-4 py-3 rounded-lg border-2 text-left transition-colors ${
                        exerciseType.includes(type.value)
                          ? 'border-primary-500 bg-primary-100 text-primary-900'
                          : 'border-gray-300 hover:border-primary-300'
                      }`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Walking Distance */}
              <div className="space-y-2">
                <label className="block text-sm font-medium">Walking Distance (optional)</label>
                <input
                  type="text"
                  value={walkingDistance}
                  onChange={(e) => setWalkingDistance(e.target.value)}
                  placeholder="e.g., around house, to mailbox, 2 blocks"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>

              {/* Assistance Level */}
              <div className="space-y-3">
                <label className="block text-sm font-medium">Assistance Level Required</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'none', label: 'None' },
                    { value: 'minimal', label: 'Minimal' },
                    { value: 'moderate', label: 'Moderate' },
                    { value: 'full', label: 'Full' },
                  ].map((level) => (
                    <button
                      key={level.value}
                      type="button"
                      onClick={() => setAssistanceLevel(level.value as any)}
                      className={`px-4 py-2 rounded-lg border-2 transition-colors ${
                        assistanceLevel === level.value
                          ? 'border-primary-500 bg-primary-100 text-primary-900'
                          : 'border-gray-300 hover:border-primary-300'
                      }`}
                    >
                      {level.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Pain During Activity */}
              <div className="space-y-3">
                <label className="block text-sm font-medium">Pain During Activity</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'none', label: '😊 None' },
                    { value: 'mild', label: '😐 Mild' },
                    { value: 'moderate', label: '😣 Moderate' },
                    { value: 'severe', label: '😫 Severe' },
                  ].map((pain) => (
                    <button
                      key={pain.value}
                      type="button"
                      onClick={() => setPainDuringActivity(pain.value as any)}
                      className={`px-4 py-2 rounded-lg border-2 transition-colors ${
                        painDuringActivity === pain.value
                          ? 'border-primary-500 bg-primary-100 text-primary-900'
                          : 'border-gray-300 hover:border-primary-300'
                      }`}
                    >
                      {pain.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Energy After Activity */}
              <div className="space-y-3">
                <label className="block text-sm font-medium">Energy Level After Activity</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'energized', label: '⚡ Energized' },
                    { value: 'same', label: '😐 Same' },
                    { value: 'tired', label: '😴 Tired' },
                    { value: 'exhausted', label: '🥱 Exhausted' },
                  ].map((energy) => (
                    <button
                      key={energy.value}
                      type="button"
                      onClick={() => setEnergyAfterActivity(energy.value as any)}
                      className={`px-4 py-2 rounded-lg border-2 transition-colors ${
                        energyAfterActivity === energy.value
                          ? 'border-primary-500 bg-primary-100 text-primary-900'
                          : 'border-gray-300 hover:border-primary-300'
                      }`}
                    >
                      {energy.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Participation Willingness */}
              <div className="space-y-3">
                <label className="block text-sm font-medium">Participation Willingness</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'enthusiastic', label: '🤩 Enthusiastic' },
                    { value: 'willing', label: '👍 Willing' },
                    { value: 'reluctant', label: '😒 Reluctant' },
                    { value: 'refused', label: '🙅 Refused' },
                  ].map((will) => (
                    <button
                      key={will.value}
                      type="button"
                      onClick={() => setParticipationWillingness(will.value as any)}
                      className={`px-4 py-2 rounded-lg border-2 transition-colors ${
                        participationWillingness === will.value
                          ? 'border-primary-500 bg-primary-100 text-primary-900'
                          : 'border-gray-300 hover:border-primary-300'
                      }`}
                    >
                      {will.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Equipment Used */}
              <div className="space-y-3">
                <label className="block text-sm font-medium">Equipment Used (select all that apply)</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'walker', label: '🚶‍♂️ Walker' },
                    { value: 'cane', label: '🦯 Cane' },
                    { value: 'wheelchair', label: '♿ Wheelchair' },
                    { value: 'none', label: 'None' },
                  ].map((equip) => (
                    <button
                      key={equip.value}
                      type="button"
                      onClick={() => {
                        setEquipmentUsed(prev =>
                          prev.includes(equip.value)
                            ? prev.filter(e => e !== equip.value)
                            : [...prev, equip.value]
                        );
                      }}
                      className={`px-4 py-3 rounded-lg border-2 text-left transition-colors ${
                        equipmentUsed.includes(equip.value)
                          ? 'border-primary-500 bg-primary-100 text-primary-900'
                          : 'border-gray-300 hover:border-primary-300'
                      }`}
                    >
                      {equip.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mobility Notes */}
              <div className="space-y-2">
                <label className="block text-sm font-medium">Mobility Notes (optional)</label>
                <textarea
                  value={mobilityNotes}
                  onChange={(e) => setMobilityNotes(e.target.value)}
                  placeholder="Any observations about mobility changes or concerns..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  rows={3}
                />
              </div>

              {/* Navigation */}
              <div className="flex gap-3">
                <Button onClick={() => setCurrentSection(10)} variant="outline" className="flex-1">
                  ← Back
                </Button>
                <Button onClick={() => setCurrentSection(12)} variant="primary" className="flex-1">
                  Next: Oral Care →
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Section 12: Oral Care & Hygiene */}
        {currentSection === 12 && (
          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold">🦷 Oral Care & Hygiene</h2>
              <p className="text-sm text-gray-600">Track teeth brushing, denture care, and oral health</p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Teeth Brushed */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="teethBrushed"
                    checked={teethBrushed}
                    onChange={(e) => setTeethBrushed(e.target.checked)}
                    className="w-5 h-5"
                  />
                  <label htmlFor="teethBrushed" className="text-sm font-medium">
                    Teeth Brushed Today
                  </label>
                </div>
              </div>

              {/* Times Brushed (conditional on teeth brushed) */}
              {teethBrushed && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium">Number of Times Brushed</label>
                  <input
                    type="number"
                    min="0"
                    value={timesBrushed || ''}
                    onChange={(e) => setTimesBrushed(e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="Enter number of times"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              )}

              {/* Dentures Cleaned */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="denturesCleaned"
                    checked={denturesCleaned}
                    onChange={(e) => setDenturesCleaned(e.target.checked)}
                    className="w-5 h-5"
                  />
                  <label htmlFor="denturesCleaned" className="text-sm font-medium">
                    Dentures Cleaned
                  </label>
                </div>
              </div>

              {/* Mouth Rinsed */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="mouthRinsed"
                    checked={mouthRinsed}
                    onChange={(e) => setMouthRinsed(e.target.checked)}
                    className="w-5 h-5"
                  />
                  <label htmlFor="mouthRinsed" className="text-sm font-medium">
                    Mouth Rinsed
                  </label>
                </div>
              </div>

              {/* Assistance Level */}
              <div className="space-y-3">
                <label className="block text-sm font-medium">Assistance Level Required</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'none', label: 'None' },
                    { value: 'minimal', label: 'Minimal' },
                    { value: 'moderate', label: 'Moderate' },
                    { value: 'full', label: 'Full' },
                  ].map((level) => (
                    <button
                      key={level.value}
                      type="button"
                      onClick={() => setOralAssistanceLevel(level.value as any)}
                      className={`px-4 py-2 rounded-lg border-2 transition-colors ${
                        oralAssistanceLevel === level.value
                          ? 'border-primary-500 bg-primary-100 text-primary-900'
                          : 'border-gray-300 hover:border-primary-300'
                      }`}
                    >
                      {level.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Oral Health Issues (multi-select) */}
              <div className="space-y-3">
                <label className="block text-sm font-medium">Oral Health Issues (select all that apply)</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'bleeding_gums', label: '🩸 Bleeding Gums' },
                    { value: 'dry_mouth', label: '💧 Dry Mouth' },
                    { value: 'sores', label: '🔴 Sores' },
                    { value: 'pain', label: '😣 Pain' },
                    { value: 'bad_breath', label: '💨 Bad Breath' },
                    { value: 'none', label: '✅ None' },
                  ].map((issue) => (
                    <button
                      key={issue.value}
                      type="button"
                      onClick={() => {
                        setOralHealthIssues(prev =>
                          prev.includes(issue.value)
                            ? prev.filter(i => i !== issue.value)
                            : [...prev, issue.value]
                        );
                      }}
                      className={`px-4 py-3 rounded-lg border-2 text-left transition-colors ${
                        oralHealthIssues.includes(issue.value)
                          ? 'border-primary-500 bg-primary-100 text-primary-900'
                          : 'border-gray-300 hover:border-primary-300'
                      }`}
                    >
                      {issue.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Pain Or Bleeding */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="painOrBleeding"
                    checked={painOrBleeding}
                    onChange={(e) => setPainOrBleeding(e.target.checked)}
                    className="w-5 h-5"
                  />
                  <label htmlFor="painOrBleeding" className="text-sm font-medium">
                    Pain or Bleeding During Care
                  </label>
                </div>
              </div>

              {/* Oral Care Notes */}
              <div className="space-y-2">
                <label className="block text-sm font-medium">Oral Care Notes (optional)</label>
                <textarea
                  value={oralCareNotes}
                  onChange={(e) => setOralCareNotes(e.target.value)}
                  placeholder="Any observations about oral health or concerns..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  rows={3}
                />
              </div>

              {/* Navigation */}
              <div className="flex gap-3">
                <Button onClick={() => setCurrentSection(11)} variant="outline" className="flex-1">
                  ← Back
                </Button>
                <Button onClick={() => setCurrentSection(13)} variant="primary" className="flex-1">
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
                  General Notes (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any additional observations or notes..."
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  rows={4}
                />
              </div>

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
                        {breakfastTime && (
                          <p>🍽️ Breakfast: {breakfastTime} - Appetite: {breakfastAppetite}/5, Eaten: {breakfastAmount}%</p>
                        )}

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
                        {(bowelFreq > 0 || urineFreq > 0 || diaperChanges > 0) && (
                          <p>🚽 Toileting: {bowelFreq} bowel, {urineFreq} urine, {diaperChanges} diaper changes</p>
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
