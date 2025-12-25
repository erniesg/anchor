import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { authenticatedApiCall } from '@/lib/api';
import { QuickActionFAB } from '@/components/caregiver/QuickActionFAB';
import {
  Sun,
  ArrowLeft,
  CheckCircle,
  Clock,
  Save,
  Loader2,
  ChevronRight,
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

// Optional label helper
const OptionalLabel = ({ children }: { children: React.ReactNode }) => (
  <span className="block text-sm font-medium text-gray-700 mb-1">
    {children}
    <span className="text-gray-400 font-normal text-xs ml-1">(optional)</span>
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
  showerTime?: string;
  hairWash?: boolean;
  // Vitals
  bloodPressure?: string;
  pulseRate?: string;
  oxygenLevel?: string;
  bloodSugar?: string;
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
    name: string;
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
  const [showerTime, setShowerTime] = useState('');
  const [hairWash, setHairWash] = useState(false);

  // Vitals
  const [bloodPressure, setBloodPressure] = useState('');
  const [pulseRate, setPulseRate] = useState('');
  const [oxygenLevel, setOxygenLevel] = useState('');
  const [bloodSugar, setBloodSugar] = useState('');
  const [vitalsTime, setVitalsTime] = useState('');

  // Breakfast
  const [breakfastTime, setBreakfastTime] = useState('');
  const [breakfastAppetite, setBreakfastAppetite] = useState(3);
  const [breakfastAmount, setBreakfastAmount] = useState(3);
  const [breakfastAssistance, setBreakfastAssistance] = useState<'none' | 'some' | 'full'>('none');

  // Morning medications
  const [medications, setMedications] = useState<Array<{
    name: string;
    given: boolean;
    time: string | null;
    timeSlot: string;
  }>>([]);

  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Auto-save tracking
  const hasUnsavedChanges = useRef(false);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialLoad = useRef(true);
  const saveMutationRef = useRef<((logId: string) => Promise<void>) | null>(null);

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
      setCareLogId(todayLog.id);
      setIsSubmitted(!!todayLog.completedSections?.morning);

      // Load morning fields
      if (todayLog.wakeTime) setWakeTime(todayLog.wakeTime);
      if (todayLog.mood) setMood(todayLog.mood);
      if (todayLog.showerTime) setShowerTime(todayLog.showerTime);
      if (todayLog.hairWash) setHairWash(todayLog.hairWash);

      // Load vitals
      if (todayLog.bloodPressure) setBloodPressure(todayLog.bloodPressure);
      if (todayLog.pulseRate) setPulseRate(todayLog.pulseRate);
      if (todayLog.oxygenLevel) setOxygenLevel(todayLog.oxygenLevel);
      if (todayLog.bloodSugar) setBloodSugar(todayLog.bloodSugar);
      if (todayLog.vitalsTime) setVitalsTime(todayLog.vitalsTime);

      // Load breakfast from meals object
      if (todayLog.meals?.breakfast) {
        setBreakfastTime(todayLog.meals.breakfast.time || '');
        setBreakfastAppetite(todayLog.meals.breakfast.appetite || 3);
        setBreakfastAmount(todayLog.meals.breakfast.amountEaten || 3);
        setBreakfastAssistance(todayLog.meals.breakfast.assistance || 'none');
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

  // Debounced auto-save effect - saves 3 seconds after last change
  useEffect(() => {
    // Track changes to trigger auto-save
    markDirty();

    // Clear existing timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    // Set new timeout for auto-save
    autoSaveTimeoutRef.current = setTimeout(async () => {
      if (hasUnsavedChanges.current && careLogId && !isSaving) {
        try {
          await saveMutationRef.current?.(careLogId);
          hasUnsavedChanges.current = false;
        } catch {
          // Silent fail for auto-save - user can manually retry
        }
      }
    }, 3000);

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [wakeTime, mood, showerTime, hairWash, bloodPressure, pulseRate, oxygenLevel, bloodSugar, vitalsTime, breakfastTime, breakfastAppetite, breakfastAmount, breakfastAssistance, medications, careLogId, isSaving, markDirty]);

  // Create care log if none exists
  const createLogMutation = useMutation({
    mutationFn: async () => {
      if (!token || !careRecipient?.id) throw new Error('Not authenticated');
      const today = new Date().toISOString().split('T')[0];
      const response = await authenticatedApiCall<CareLog>(
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
      return response;
    },
    onSuccess: (data) => {
      setCareLogId(data.id);
      queryClient.invalidateQueries({ queryKey: ['caregiver-today-log'] });
    },
  });

  // Build payload for saving
  const buildPayload = useCallback(() => ({
    wakeTime: wakeTime || undefined,
    mood: mood || undefined,
    showerTime: showerTime || undefined,
    hairWash: hairWash || undefined,
    bloodPressure: bloodPressure || undefined,
    pulseRate: pulseRate || undefined,
    oxygenLevel: oxygenLevel || undefined,
    bloodSugar: bloodSugar || undefined,
    vitalsTime: vitalsTime || undefined,
    // API expects meals as nested object
    meals: breakfastTime ? {
      breakfast: {
        time: breakfastTime,
        appetite: breakfastAppetite,
        amountEaten: breakfastAmount,
        assistance: breakfastAssistance,
        swallowingIssues: [],
      },
    } : undefined,
    medications: medications.length > 0 ? medications : undefined,
  }), [wakeTime, mood, showerTime, hairWash, bloodPressure, pulseRate, oxygenLevel, bloodSugar, vitalsTime, breakfastTime, breakfastAppetite, breakfastAmount, breakfastAssistance, medications]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (logId: string) => {
      if (!token) throw new Error('Not authenticated');

      return authenticatedApiCall(
        `/care-logs/${logId}`,
        token,
        {
          method: 'PATCH',
          body: JSON.stringify(buildPayload()),
        }
      );
    },
    onSuccess: () => {
      setLastSaved(new Date());
      hasUnsavedChanges.current = false;
      queryClient.invalidateQueries({ queryKey: ['caregiver-today-log'] });
    },
  });

  // Assign to ref for auto-save
  useEffect(() => {
    saveMutationRef.current = async (logId: string) => {
      await saveMutation.mutateAsync(logId);
    };
  }, [saveMutation]);

  // Submit section mutation
  const submitSectionMutation = useMutation({
    mutationFn: async (logId: string) => {
      if (!token) throw new Error('Not authenticated');

      // First save, then submit section
      await saveMutation.mutateAsync(logId);

      return authenticatedApiCall(
        `/care-logs/${logId}/submit-section`,
        token,
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
    setIsSaving(true);
    try {
      let logId = careLogId;

      // Create log if it doesn't exist
      if (!logId) {
        const newLog = await createLogMutation.mutateAsync();
        logId = newLog.id;
      }

      await saveMutation.mutateAsync(logId);
    } finally {
      setIsSaving(false);
    }
  };

  // Check if form has any data worth saving
  const hasFormData = wakeTime || mood || showerTime || hairWash ||
    bloodPressure || pulseRate || oxygenLevel || bloodSugar || vitalsTime ||
    breakfastTime;

  // Navigate with auto-save - always save if there's data
  const handleNavigateBack = async () => {
    // Save if we have a log and there's data or unsaved changes
    if (careLogId && (hasUnsavedChanges.current || hasFormData)) {
      setIsSaving(true);
      try {
        await saveMutation.mutateAsync(careLogId);
        hasUnsavedChanges.current = false;
      } catch (err) {
        console.error('Auto-save failed:', err);
      } finally {
        setIsSaving(false);
      }
    }
    navigate({ to: '/caregiver/form' });
  };

  const handleNavigateToAfternoon = async () => {
    // Always save if there's any form data
    if (hasFormData || hasUnsavedChanges.current) {
      setIsSaving(true);
      try {
        let logId = careLogId;
        if (!logId) {
          const newLog = await createLogMutation.mutateAsync();
          logId = newLog.id;
        }
        await saveMutation.mutateAsync(logId);
        hasUnsavedChanges.current = false;
      } catch (err) {
        console.error('Auto-save failed:', err);
      } finally {
        setIsSaving(false);
      }
    }
    navigate({ to: '/caregiver/form/afternoon' });
  };

  const handleSubmitSection = async () => {
    let logId = careLogId;

    // Create log if it doesn't exist
    if (!logId) {
      const newLog = await createLogMutation.mutateAsync();
      logId = newLog.id;
    }

    await submitSectionMutation.mutateAsync(logId);
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

        {/* Shower */}
        <Card>
          <CardHeader className="pb-3">
            <h2 className="text-lg font-semibold text-gray-900">Morning Hygiene</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <OptionalLabel>Shower Time</OptionalLabel>
              <Input
                type="time"
                value={showerTime}
                onChange={(e) => setShowerTime(e.target.value)}
                className="max-w-[150px]"
              />
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="hairWash"
                checked={hairWash}
                onChange={(e) => setHairWash(e.target.checked)}
                className="h-5 w-5 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
              />
              <label htmlFor="hairWash" className="text-sm text-gray-700">
                Hair washed today
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Vitals */}
        <Card>
          <CardHeader className="pb-3">
            <h2 className="text-lg font-semibold text-gray-900">Morning Vitals</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <OptionalLabel>Time Taken</OptionalLabel>
              <Input
                type="time"
                value={vitalsTime}
                onChange={(e) => setVitalsTime(e.target.value)}
                className="max-w-[150px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <OptionalLabel>Blood Pressure</OptionalLabel>
                <Input
                  type="text"
                  placeholder="120/80"
                  value={bloodPressure}
                  onChange={(e) => setBloodPressure(e.target.value)}
                />
              </div>
              <div>
                <OptionalLabel>Pulse (bpm)</OptionalLabel>
                <Input
                  type="number"
                  placeholder="72"
                  value={pulseRate}
                  onChange={(e) => setPulseRate(e.target.value)}
                />
              </div>
              <div>
                <OptionalLabel>Oxygen (%)</OptionalLabel>
                <Input
                  type="number"
                  placeholder="98"
                  value={oxygenLevel}
                  onChange={(e) => setOxygenLevel(e.target.value)}
                />
              </div>
              <div>
                <OptionalLabel>Blood Sugar (mmol/L)</OptionalLabel>
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
                    onClick={() => setBreakfastAppetite(level)}
                    className={`w-10 h-10 rounded-full font-medium transition-colors ${
                      breakfastAppetite === level
                        ? 'bg-amber-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-1">1 = No appetite, 5 = Excellent</p>
            </div>

            <div>
              <RequiredLabel required>Amount Eaten (1-5)</RequiredLabel>
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
              <p className="text-xs text-gray-500 mt-1">1 = Nothing, 5 = Everything</p>
            </div>

            <div>
              <OptionalLabel>Assistance Level</OptionalLabel>
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
                      <p className="text-xs text-gray-500">
                        {med.timeSlot === 'before_breakfast' ? 'Before breakfast' : 'After breakfast'}
                      </p>
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

        {/* Submit Section Button */}
        <div className="space-y-3">
          <Button
            onClick={handleSubmitSection}
            disabled={submitSectionMutation.isPending || !wakeTime || !mood}
            className="w-full bg-amber-600 hover:bg-amber-700 text-white py-6 text-lg"
          >
            {submitSectionMutation.isPending ? (
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
            ) : isSubmitted ? (
              <CheckCircle className="h-5 w-5 mr-2" />
            ) : null}
            {isSubmitted ? 'Update & Re-submit Morning' : 'Submit Morning Section'}
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
