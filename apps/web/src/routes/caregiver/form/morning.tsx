import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { authenticatedApiCall } from '@/lib/api';
import { getCurrentAppDateString } from '@/lib/date';
import { normalizeCompletedSections } from '@/lib/completedSections';
import { appetiteLevelToPercent, persistedMealValueToAppetiteLevel } from '@/lib/mealScales';
import { QuickActionFAB } from '@/components/caregiver/QuickActionFAB';
import {
  Sun,
  ArrowLeft,
  CheckCircle,
  Clock,
  Save,
  Loader2,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';

export const Route = createFileRoute('/caregiver/form/morning')({
  component: MorningFormComponent,
});

// Helper component for required field indicator
const RequiredLabel = ({ children, required = false }: { children: React.ReactNode; required?: boolean }) => (
  <span className="block text-sm font-medium text-gray-700 mb-1">
    {children}
    {required && <span className="text-red-500 ml-0.5">*</span>}
  </span>
);

// Simple label (no "optional" text - required fields have red asterisk)
const Label = ({ children }: { children: React.ReactNode }) => (
  <span className="block text-sm font-medium text-gray-700 mb-1">
    {children}
  </span>
);

interface MealLog {
  time: string;
  appetite: number;
  amountEaten: number;
  assistance: 'none' | 'some' | 'full';
  swallowingIssues: string[];
}

interface CareLog {
  id: string;
  status: 'draft' | 'submitted' | 'invalidated';
  completedSections?: {
    morning?: { submittedAt: string; submittedBy: string };
    afternoon?: { submittedAt: string; submittedBy: string };
    evening?: { submittedAt: string; submittedBy: string };
    dailySummary?: { submittedAt: string; submittedBy: string };
  };
  // Morning fields
  wakeTime?: string;
  mood?: string;
  // Previous night's sleep is stored in the shared nightSleep object
  nightSleep?: {
    quality: 'deep' | 'light' | 'restless' | 'no_sleep';
    wakings: number;
    wakingReasons: string[];
  };
  // Vitals
  bloodPressure?: string;
  pulseRate?: number;
  oxygenLevel?: number;
  bloodSugar?: number;
  vitalsTime?: string;
  // Meals (nested object from API)
  meals?: {
    breakfast?: MealLog;
    lunch?: MealLog;
    teaBreak?: MealLog;
    dinner?: MealLog;
  };
  // Medications
  medications?: Array<{
    scheduleId?: string;
    name: string;
    dosage?: string;
    given: boolean;
    time: string | null;
    timeSlot: string;
    purpose?: string;
    notes?: string;
  }>;
}

function MorningFormComponent() {
  const { token, careRecipient } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Form state
  const [careLogId, setCareLogId] = useState<string | null>(null);
  const [wakeTime, setWakeTime] = useState('');
  const [mood, setMood] = useState('');

  // Last Night's Sleep (moved from evening - makes more sense here)
  const [lastNightQuality, setLastNightQuality] = useState<'deep' | 'light' | 'restless' | 'no_sleep' | ''>('');
  const [lastNightWakings, setLastNightWakings] = useState<number | null>(null);
  const [lastNightWakingReasons, setLastNightWakingReasons] = useState<string[]>([]);

  // Vitals
  const [bloodPressure, setBloodPressure] = useState('');
  const [pulseRate, setPulseRate] = useState('');
  const [oxygenLevel, setOxygenLevel] = useState('');
  const [bloodSugar, setBloodSugar] = useState('');
  const [vitalsTime, setVitalsTime] = useState('');

  // Breakfast
  const [breakfastTime, setBreakfastTime] = useState('');
  const [breakfastAmount, setBreakfastAmount] = useState(3);
  const [breakfastAssistance, setBreakfastAssistance] = useState<'none' | 'some' | 'full'>('none');
  const [breakfastSwallowingIssues, setBreakfastSwallowingIssues] = useState<string[]>([]);

  // Swallowing issue options
  const swallowingIssueOptions = [
    'Choking',
    'Coughing',
    'Drooling',
    'Spitting out',
    'Difficulty swallowing',
    'Refusing food',
    'Pocketing food',
  ];

  // Waking reason options
  const wakingReasonOptions = [
    'Bathroom',
    'Thirsty',
    'Pain',
    'Nightmare',
    'Noise',
    'Too hot/cold',
    'Unknown',
  ];

  // Morning medications
  const [medications, setMedications] = useState<Array<{
    scheduleId?: string;
    name: string;
    dosage?: string;
    given: boolean;
    time: string | null;
    timeSlot: string;
    purpose?: string;
    notes?: string;
  }>>([]);

  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const parseOptionalNumber = (value: string): number | undefined => {
    if (!value.trim()) return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  // Validation - require the core morning fields plus an explicit sleep record.
  const requiredFieldChecks = [
    { label: 'Wake Time', complete: Boolean(wakeTime) },
    { label: 'Mood', complete: Boolean(mood) },
    { label: 'Sleep Quality', complete: Boolean(lastNightQuality) },
    { label: 'Night Wakings', complete: lastNightWakings !== null },
    { label: 'Breakfast Time', complete: Boolean(breakfastTime) },
    ...(lastNightWakings !== null && lastNightWakings > 0
      ? [{ label: 'Waking Reasons', complete: lastNightWakingReasons.length > 0 }]
      : []),
  ];
  const missingFields = requiredFieldChecks.filter((field) => !field.complete).map((field) => field.label);
  const canSubmit = missingFields.length === 0;
  const completedFieldsCount = requiredFieldChecks.filter((field) => field.complete).length;
  const totalRequiredFields = requiredFieldChecks.length;

  // Auto-save tracking
  const hasUnsavedChanges = useRef(false);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialLoad = useRef(true);
  // Note: No longer using saveMutationRef - all values are captured at effect time to avoid stale closures

  // Mark form as dirty when any field changes
  const markDirty = useCallback(() => {
    if (!isInitialLoad.current) {
      hasUnsavedChanges.current = true;
    }
  }, []);

  // Fetch today's care log
  const { data: todayLog, isLoading } = useQuery({
    queryKey: ['caregiver-today-log'],
    queryFn: async () => {
      if (!token) return null;
      try {
        const response = await authenticatedApiCall<CareLog>(
          '/care-logs/caregiver/today',
          token
        );
        return response;
      } catch {
        return null;
      }
    },
    enabled: !!token,
  });

  // Load existing data
  useEffect(() => {
    if (todayLog) {
      const completedSections = normalizeCompletedSections(todayLog.completedSections);
      setCareLogId(todayLog.id);
      setIsSubmitted(!!completedSections.morning);

      // Load morning fields
      if (todayLog.wakeTime) setWakeTime(todayLog.wakeTime);
      if (todayLog.mood) setMood(todayLog.mood);

      // Load last night's sleep from the shared nightSleep object so evening can merge bedtime details.
      if (todayLog.nightSleep) {
        setLastNightQuality(todayLog.nightSleep.quality || '');
        setLastNightWakings(todayLog.nightSleep.wakings ?? 0);
        setLastNightWakingReasons(todayLog.nightSleep.wakingReasons || []);
      }

      // Load vitals
      if (todayLog.bloodPressure) setBloodPressure(todayLog.bloodPressure);
      if (todayLog.pulseRate !== undefined) setPulseRate(String(todayLog.pulseRate));
      if (todayLog.oxygenLevel !== undefined) setOxygenLevel(String(todayLog.oxygenLevel));
      if (todayLog.bloodSugar !== undefined) setBloodSugar(String(todayLog.bloodSugar));
      if (todayLog.vitalsTime) setVitalsTime(todayLog.vitalsTime);

      // Load breakfast from meals object
      if (todayLog.meals?.breakfast) {
        setBreakfastTime(todayLog.meals.breakfast.time || '');
        setBreakfastAmount(
          todayLog.meals.breakfast.appetite ||
          persistedMealValueToAppetiteLevel(todayLog.meals.breakfast.amountEaten)
        );
        setBreakfastAssistance(todayLog.meals.breakfast.assistance || 'none');
        setBreakfastSwallowingIssues(todayLog.meals.breakfast.swallowingIssues || []);
      }

      // Load morning medications
      if (todayLog.medications) {
        const morningMeds = todayLog.medications.filter(
          m => m.timeSlot === 'before_breakfast' || m.timeSlot === 'after_breakfast'
        );
        if (morningMeds.length > 0) {
          setMedications(morningMeds);
        }
      }
    }

    // Mark initial load complete after a brief delay (regardless of whether todayLog exists)
    const timer = setTimeout(() => {
      isInitialLoad.current = false;
    }, 500);

    return () => clearTimeout(timer);
  }, [todayLog]);

  // Create care log if none exists (handles 409 duplicate gracefully)
  const createLogMutation = useMutation({
    mutationFn: async () => {
      if (!token || !careRecipient?.id) throw new Error('Not authenticated');
      const today = getCurrentAppDateString();
      try {
        return await authenticatedApiCall<CareLog>(
          '/care-logs',
          token,
          {
            method: 'POST',
            body: JSON.stringify({
              careRecipientId: careRecipient.id,
              logDate: today,
            }),
          }
        );
      } catch (err) {
        // If a log already exists for today (409), fetch it instead
        if (err instanceof Error && err.message.includes('already exists')) {
          const existing = await authenticatedApiCall<CareLog>(
            '/care-logs/caregiver/today',
            token
          );
          if (existing?.id) return existing;
        }
        throw err;
      }
    },
    onSuccess: (data) => {
      setCareLogId(data.id);
      queryClient.invalidateQueries({ queryKey: ['caregiver-today-log'] });
    },
  });

  // Type for the morning form payload
  type MorningPayload = {
    wakeTime?: string;
    mood?: string;
    nightSleep?: {
      quality?: string;
      wakings?: number;
      wakingReasons: string[];
    };
    bloodPressure?: string;
    pulseRate?: number;
    oxygenLevel?: number;
    bloodSugar?: number;
    vitalsTime?: string;
    meals?: {
      breakfast: {
        time: string;
        appetite: number;
        amountEaten: number;
        assistance: string;
        swallowingIssues: string[];
      };
    };
    medications?: typeof medications;
  };

  // Save mutation - accepts ALL needed data as arguments to avoid stale closures
  const saveMutation = useMutation({
    mutationFn: async ({ logId, payload, authToken }: { logId: string; payload: MorningPayload; authToken: string }) => {
      if (!authToken) throw new Error('Not authenticated');

      return authenticatedApiCall(
        `/care-logs/${logId}`,
        authToken,
        {
          method: 'PATCH',
          body: JSON.stringify(payload),
        }
      );
    },
    onSuccess: () => {
      setLastSaved(new Date());
      setSaveError(null);
      hasUnsavedChanges.current = false;
      queryClient.invalidateQueries({ queryKey: ['caregiver-today-log'] });
    },
  });

  // Helper to build payload with current values - used at call site
  const buildCurrentPayload = (): MorningPayload => ({
    wakeTime: wakeTime || undefined,
    mood: mood || undefined,
    nightSleep: lastNightQuality || lastNightWakings !== null || lastNightWakingReasons.length > 0 ? {
      quality: lastNightQuality || undefined,
      wakings: lastNightWakings ?? undefined,
      wakingReasons: lastNightWakingReasons,
    } : undefined,
    bloodPressure: bloodPressure || undefined,
    pulseRate: parseOptionalNumber(pulseRate),
    oxygenLevel: parseOptionalNumber(oxygenLevel),
    bloodSugar: parseOptionalNumber(bloodSugar),
    vitalsTime: vitalsTime || undefined,
    meals: breakfastTime ? {
      breakfast: {
        time: breakfastTime,
        appetite: breakfastAmount,
        amountEaten: appetiteLevelToPercent(breakfastAmount),
        assistance: breakfastAssistance,
        swallowingIssues: breakfastSwallowingIssues,
      },
    } : undefined,
    medications: medications.length > 0 ? medications : undefined,
  });

  // Debounced auto-save effect - saves 3 seconds after last change
  // IMPORTANT: Capture all values at effect time to avoid stale closure issues
  useEffect(() => {
    // Track changes to trigger auto-save
    markDirty();

    // Clear existing timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    // Capture current values NOW (at effect time, not in the timeout callback)
    const currentPayload: MorningPayload = {
      wakeTime: wakeTime || undefined,
      mood: mood || undefined,
      nightSleep: lastNightQuality || lastNightWakings !== null || lastNightWakingReasons.length > 0 ? {
        quality: lastNightQuality || undefined,
        wakings: lastNightWakings ?? undefined,
        wakingReasons: lastNightWakingReasons,
      } : undefined,
      bloodPressure: bloodPressure || undefined,
      pulseRate: parseOptionalNumber(pulseRate),
      oxygenLevel: parseOptionalNumber(oxygenLevel),
      bloodSugar: parseOptionalNumber(bloodSugar),
      vitalsTime: vitalsTime || undefined,
      meals: breakfastTime ? {
        breakfast: {
          time: breakfastTime,
          appetite: breakfastAmount,
          amountEaten: appetiteLevelToPercent(breakfastAmount),
          assistance: breakfastAssistance,
          swallowingIssues: breakfastSwallowingIssues,
        },
      } : undefined,
      medications: medications.length > 0 ? medications : undefined,
    };
    const currentToken = token;
    const currentLogId = careLogId;
    const currentCareRecipientId = careRecipient?.id;

    // Set new timeout for auto-save
    autoSaveTimeoutRef.current = setTimeout(async () => {
      if (hasUnsavedChanges.current && currentToken && currentCareRecipientId && !isSaving) {
        try {
          let logIdToUse = currentLogId;

          // Create care log if it doesn't exist
          if (!logIdToUse) {
            const today = getCurrentAppDateString();
            try {
              const newLog = await authenticatedApiCall<CareLog>(
                '/care-logs',
                currentToken,
                {
                  method: 'POST',
                  body: JSON.stringify({
                    careRecipientId: currentCareRecipientId,
                    logDate: today,
                  }),
                }
              );
              logIdToUse = newLog.id;
            } catch (createErr) {
              // If a log already exists for today (409), fetch it instead
              if (createErr instanceof Error && createErr.message.includes('already exists')) {
                const existingLog = await authenticatedApiCall<CareLog>(
                  '/care-logs/caregiver/today',
                  currentToken
                );
                if (existingLog?.id) {
                  logIdToUse = existingLog.id;
                } else {
                  throw createErr;
                }
              } else {
                throw createErr;
              }
            }
            setCareLogId(logIdToUse);
          }

          await saveMutation.mutateAsync({
            logId: logIdToUse,
            payload: currentPayload,
            authToken: currentToken,
          });
          hasUnsavedChanges.current = false;
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to save';
          setSaveError(message);
        }
      }
    }, 3000);

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [wakeTime, mood, lastNightQuality, lastNightWakings, lastNightWakingReasons, bloodPressure, pulseRate, oxygenLevel, bloodSugar, vitalsTime, breakfastTime, breakfastAmount, breakfastAssistance, breakfastSwallowingIssues, medications, careLogId, isSaving, markDirty, token, saveMutation, careRecipient]);

  // Submit section mutation - accepts ALL needed data to avoid stale closures
  const submitSectionMutation = useMutation({
    mutationFn: async ({ logId, payload, authToken }: { logId: string; payload: MorningPayload; authToken: string }) => {
      if (!authToken) throw new Error('Not authenticated');

      // First save with current payload, then submit section
      await saveMutation.mutateAsync({ logId, payload, authToken });

      return authenticatedApiCall(
        `/care-logs/${logId}/submit-section`,
        authToken,
        {
          method: 'POST',
          body: JSON.stringify({ section: 'morning' }),
        }
      );
    },
    onSuccess: () => {
      setIsSubmitted(true);
      queryClient.invalidateQueries({ queryKey: ['caregiver-today-log'] });
    },
  });

  const handleSave = async () => {
    if (!token) return;
    setIsSaving(true);
    try {
      let logId = careLogId;

      // Create log if it doesn't exist
      if (!logId) {
        const newLog = await createLogMutation.mutateAsync();
        logId = newLog.id;
      }

      // Build payload at call time to get current state values
      await saveMutation.mutateAsync({ logId, payload: buildCurrentPayload(), authToken: token });
    } finally {
      setIsSaving(false);
    }
  };

  // Check if form has any data worth saving
  const hasFormData = wakeTime || mood || lastNightQuality || lastNightWakings !== null || lastNightWakingReasons.length > 0 ||
    bloodPressure || pulseRate || oxygenLevel || bloodSugar || vitalsTime ||
    breakfastTime;

  // Toggle functions
  const toggleWakingReason = (reason: string) => {
    setLastNightWakingReasons(prev =>
      prev.includes(reason) ? prev.filter(r => r !== reason) : [...prev, reason]
    );
  };

  const toggleSwallowingIssue = (issue: string) => {
    setBreakfastSwallowingIssues(prev =>
      prev.includes(issue) ? prev.filter(i => i !== issue) : [...prev, issue]
    );
  };

  // Navigate with auto-save - always save if there's data
  const handleNavigateBack = async () => {
    // Save if we have a log and there's data or unsaved changes
    if (token && careLogId && (hasUnsavedChanges.current || hasFormData)) {
      setIsSaving(true);
      try {
        await saveMutation.mutateAsync({ logId: careLogId, payload: buildCurrentPayload(), authToken: token });
        hasUnsavedChanges.current = false;
        setSaveError(null);
      } catch (err) {
        console.error('Save failed:', err);
        setSaveError(err instanceof Error ? err.message : 'Failed to save');
      } finally {
        setIsSaving(false);
      }
    }
    navigate({ to: '/caregiver/form' });
  };

  const handleNavigateToAfternoon = async () => {
    // Always save if there's any form data
    if (token && (hasFormData || hasUnsavedChanges.current)) {
      setIsSaving(true);
      try {
        let logId = careLogId;
        if (!logId) {
          const newLog = await createLogMutation.mutateAsync();
          logId = newLog.id;
        }
        await saveMutation.mutateAsync({ logId, payload: buildCurrentPayload(), authToken: token });
        hasUnsavedChanges.current = false;
        setSaveError(null);
      } catch (err) {
        console.error('Save failed:', err);
        setSaveError(err instanceof Error ? err.message : 'Failed to save');
      } finally {
        setIsSaving(false);
      }
    }
    navigate({ to: '/caregiver/form/afternoon' });
  };

  const handleSubmitSection = async () => {
    if (!token) {
      console.error('No auth token');
      return;
    }
    try {
      let logId = careLogId;

      // Create log if it doesn't exist
      if (!logId) {
        console.log('Creating new care log...');
        const newLog = await createLogMutation.mutateAsync();
        logId = newLog.id;
        console.log('Created log:', logId);
      }

      // Build payload at call time to ensure current state values
      const payload = buildCurrentPayload();
      console.log('Submitting morning section with payload:', JSON.stringify(payload));
      await submitSectionMutation.mutateAsync({ logId, payload, authToken: token });
      console.log('Morning section submitted successfully');
    } catch (error) {
      console.error('Failed to submit morning section:', error);
      throw error; // Re-throw so mutation error state is set
    }
  };

  const toggleMedication = (index: number) => {
    const updated = [...medications];
    updated[index] = {
      ...updated[index],
      given: !updated[index].given,
      time: !updated[index].given ? new Date().toTimeString().slice(0, 5) : null,
    };
    setMedications(updated);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-amber-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading morning form...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 pb-24">
      {/* Header */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleNavigateBack}
                disabled={isSaving}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <div className="flex items-center gap-2">
                  <Sun className="h-5 w-5 text-amber-500" />
                  <h1 className="text-lg font-bold text-gray-900">Morning</h1>
                </div>
                <p className="text-xs text-gray-500">6am - 12pm</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isSubmitted ? (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                  <CheckCircle className="h-4 w-4" />
                  Submitted
                </span>
              ) : saveError ? (
                <span className="text-xs text-red-600 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Save failed
                </span>
              ) : lastSaved ? (
                <span className="text-xs text-gray-500 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Saved {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              ) : null}
              <Button
                variant="outline"
                size="sm"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Save Error Banner */}
      {saveError && (
        <div className="max-w-lg mx-auto px-4 pt-4">
          <div className="flex items-center justify-between gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 text-red-700 text-sm">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>Changes not saved. Please tap Save to retry.</span>
            </div>
            <button onClick={() => setSaveError(null)} className="text-red-400 hover:text-red-600 text-lg leading-none">&times;</button>
          </div>
        </div>
      )}

      {/* Form Content */}
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Wake Up */}
        <Card>
          <CardHeader className="pb-3">
            <h2 className="text-lg font-semibold text-gray-900">Wake Up</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <RequiredLabel required>Wake Time</RequiredLabel>
              <Input
                type="time"
                value={wakeTime}
                onChange={(e) => setWakeTime(e.target.value)}
                className="max-w-[150px]"
              />
            </div>

            <div>
              <RequiredLabel required>Mood on Waking</RequiredLabel>
              <div className="grid grid-cols-3 gap-2">
                {['alert', 'confused', 'sleepy', 'agitated', 'calm'].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMood(m)}
                    className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      mood === m
                        ? 'bg-amber-100 border-amber-500 text-amber-800'
                        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {m.charAt(0).toUpperCase() + m.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Last Night's Sleep */}
        <Card>
          <CardHeader className="pb-3">
            <h2 className="text-lg font-semibold text-gray-900">Last Night's Sleep</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <RequiredLabel required>Sleep Quality</RequiredLabel>
              <div className="grid grid-cols-2 gap-2">
                {(['deep', 'light', 'restless', 'no_sleep'] as const).map((quality) => (
                  <button
                    key={quality}
                    type="button"
                    onClick={() => setLastNightQuality(quality)}
                    className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      lastNightQuality === quality
                        ? 'bg-amber-100 border-amber-500 text-amber-800'
                        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {quality === 'no_sleep' ? 'No Sleep' : quality.charAt(0).toUpperCase() + quality.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <RequiredLabel required>Night Wakings</RequiredLabel>
              <div className="flex gap-2">
                {[0, 1, 2, 3, 4, 5].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setLastNightWakings(num)}
                    className={`w-10 h-10 rounded-full font-medium transition-colors ${
                      lastNightWakings === num
                        ? 'bg-amber-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {num === 5 ? '5+' : num}
                  </button>
                ))}
              </div>
            </div>

            {lastNightWakings !== null && lastNightWakings > 0 && (
              <div>
                <RequiredLabel required>Reasons for Waking</RequiredLabel>
                <div className="flex flex-wrap gap-2">
                  {wakingReasonOptions.map((reason) => (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => toggleWakingReason(reason)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                        lastNightWakingReasons.includes(reason)
                          ? 'bg-amber-100 border-amber-500 text-amber-800 border'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {reason}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Vitals */}
        <Card>
          <CardHeader className="pb-3">
            <h2 className="text-lg font-semibold text-gray-900">Morning Vitals</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Time Taken</Label>
              <Input
                type="time"
                value={vitalsTime}
                onChange={(e) => setVitalsTime(e.target.value)}
                className="max-w-[150px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Blood Pressure</Label>
                <Input
                  type="text"
                  placeholder="120/80"
                  value={bloodPressure}
                  onChange={(e) => setBloodPressure(e.target.value)}
                />
              </div>
              <div>
                <Label>Pulse (bpm)</Label>
                <Input
                  type="number"
                  placeholder="72"
                  value={pulseRate}
                  onChange={(e) => setPulseRate(e.target.value)}
                />
              </div>
              <div>
                <Label>Oxygen (%)</Label>
                <Input
                  type="number"
                  placeholder="98"
                  value={oxygenLevel}
                  onChange={(e) => setOxygenLevel(e.target.value)}
                />
              </div>
              <div>
                <Label>Blood Sugar (mmol/L)</Label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="5.5"
                  value={bloodSugar}
                  onChange={(e) => setBloodSugar(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Breakfast */}
        <Card>
          <CardHeader className="pb-3">
            <h2 className="text-lg font-semibold text-gray-900">Breakfast</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <RequiredLabel required>Time</RequiredLabel>
              <Input
                type="time"
                value={breakfastTime}
                onChange={(e) => setBreakfastTime(e.target.value)}
                className="max-w-[150px]"
              />
            </div>

            <div>
              <RequiredLabel required>Appetite (1-5)</RequiredLabel>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setBreakfastAmount(level)}
                    className={`w-10 h-10 rounded-full font-medium transition-colors ${
                      breakfastAmount === level
                        ? 'bg-amber-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-1">1 = Refused food, 5 = Ate everything well</p>
            </div>

            <div>
              <Label>Assistance Level</Label>
              <div className="flex gap-2">
                {(['none', 'some', 'full'] as const).map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setBreakfastAssistance(level)}
                    className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      breakfastAssistance === level
                        ? 'bg-amber-100 border-amber-500 text-amber-800'
                        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {level.charAt(0).toUpperCase() + level.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label>Swallowing Issues</Label>
              <div className="flex flex-wrap gap-2">
                {swallowingIssueOptions.map((issue) => (
                  <button
                    key={issue}
                    type="button"
                    onClick={() => toggleSwallowingIssue(issue)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      breakfastSwallowingIssues.includes(issue)
                        ? 'bg-red-100 border-red-500 text-red-800 border'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {issue}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-1">Select any issues observed during meal</p>
            </div>
          </CardContent>
        </Card>

        {/* Morning Medications */}
        {medications.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <h2 className="text-lg font-semibold text-gray-900">Morning Medications</h2>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {medications.map((med, index) => (
                  <div
                    key={index}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                      med.given ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'
                    }`}
                  >
                    <div>
                      <p className="font-medium text-gray-900">{med.name}</p>
                      {med.dosage && <p className="text-sm text-gray-600">{med.dosage}</p>}
                      <p className="text-xs text-gray-500">
                        {med.timeSlot === 'before_breakfast' ? 'Before breakfast' : 'After breakfast'}
                      </p>
                      {med.purpose && <p className="text-xs text-gray-500 mt-1">{med.purpose}</p>}
                    </div>
                    <div className="flex items-center gap-3">
                      {med.given && med.time && (
                        <span className="text-xs text-green-600">{med.time}</span>
                      )}
                      <button
                        type="button"
                        onClick={() => toggleMedication(index)}
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                          med.given
                            ? 'bg-green-500 text-white'
                            : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                        }`}
                      >
                        <CheckCircle className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Progress Indicator */}
        <Card className={`border-2 ${canSubmit ? 'border-green-200 bg-green-50' : 'border-amber-200 bg-amber-50'}`}>
          <CardContent className="py-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Section Progress</span>
              <span className={`text-sm font-bold ${canSubmit ? 'text-green-600' : 'text-amber-600'}`}>
                {completedFieldsCount}/{totalRequiredFields} required
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
              <div
                className={`h-2 rounded-full transition-all ${canSubmit ? 'bg-green-500' : 'bg-amber-500'}`}
                style={{ width: `${(completedFieldsCount / totalRequiredFields) * 100}%` }}
              />
            </div>
            {!canSubmit && (
              <div className="flex items-start gap-2 text-amber-700 text-sm">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>Missing: {missingFields.join(', ')}</span>
              </div>
            )}
            {canSubmit && !isSubmitted && (
              <div className="flex items-center gap-2 text-green-700 text-sm">
                <CheckCircle className="h-4 w-4" />
                <span>Ready to submit!</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Submit Section Button */}
        <div className="space-y-3">
          <Button
            onClick={handleSubmitSection}
            disabled={submitSectionMutation.isPending || !canSubmit}
            className={`w-full py-6 text-lg ${
              canSubmit
                ? 'bg-amber-600 hover:bg-amber-700 text-white'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {submitSectionMutation.isPending ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Submitting...
              </>
            ) : isSubmitted ? (
              <>
                <CheckCircle className="h-5 w-5 mr-2" />
                Update & Re-submit Morning
              </>
            ) : !canSubmit ? (
              <>
                <AlertCircle className="h-5 w-5 mr-2" />
                Complete Required Fields
              </>
            ) : (
              'Submit Morning Section'
            )}
          </Button>

          <Button
            variant="outline"
            className="w-full flex items-center justify-between"
            onClick={handleNavigateToAfternoon}
            disabled={isSaving}
          >
            <span>{isSaving ? 'Saving...' : 'Continue to Afternoon'}</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Quick Action FAB */}
      <QuickActionFAB
        careLogId={careLogId}
        careRecipientId={careRecipient?.id || null}
        onLogCreated={setCareLogId}
      />
    </div>
  );
}
