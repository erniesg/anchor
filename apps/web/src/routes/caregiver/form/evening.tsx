import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { authenticatedApiCall } from '@/lib/api';
import { QuickActionFAB } from '@/components/caregiver/QuickActionFAB';
import {
  Moon,
  ArrowLeft,
  CheckCircle,
  Clock,
  Save,
  Loader2,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';

export const Route = createFileRoute('/caregiver/form/evening')({
  component: EveningFormComponent,
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
  assistance?: 'none' | 'some' | 'full';
  swallowingIssues?: string[];
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
  // Meals (nested object from API)
  meals?: {
    breakfast?: MealLog;
    lunch?: MealLog;
    teaBreak?: MealLog;
    dinner?: MealLog;
  };
  // Night sleep
  nightSleep?: {
    bedtime: string;
    quality: 'deep' | 'light' | 'restless' | 'no_sleep';
    wakings: number;
    wakingReasons: string[];
    behaviors: string[];
    notes?: string;
  };
  // Medications
  medications?: Array<{
    name: string;
    given: boolean;
    time: string | null;
    timeSlot: string;
  }>;
}

function EveningFormComponent() {
  const { token, careRecipient } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Form state
  const [careLogId, setCareLogId] = useState<string | null>(null);

  // Dinner
  const [dinnerTime, setDinnerTime] = useState('');
  const [dinnerAppetite, setDinnerAppetite] = useState(3);
  const [dinnerAmount, setDinnerAmount] = useState(3);
  const [dinnerAssistance, setDinnerAssistance] = useState<'none' | 'some' | 'full'>('none');

  // Night Sleep Setup
  const [bedtime, setBedtime] = useState('');
  const [sleepQuality, setSleepQuality] = useState<'deep' | 'light' | 'restless' | 'no_sleep'>('light');
  const [wakings, setWakings] = useState(0);
  const [wakingReasons, setWakingReasons] = useState<string[]>([]);
  const [behaviors, setBehaviors] = useState<string[]>([]);
  const [sleepNotes, setSleepNotes] = useState('');

  // Evening medications
  const [medications, setMedications] = useState<Array<{
    name: string;
    given: boolean;
    time: string | null;
    timeSlot: string;
  }>>([]);

  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const wakingReasonOptions = [
    'Bathroom',
    'Thirsty',
    'Pain',
    'Nightmare',
    'Noise',
    'Too hot/cold',
    'Unknown',
  ];

  const behaviorOptions = [
    'Calm',
    'Restless',
    'Confused',
    'Calling out',
    'Wandering',
  ];

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
      setIsSubmitted(!!todayLog.completedSections?.evening);

      // Load dinner from meals object
      if (todayLog.meals?.dinner) {
        setDinnerTime(todayLog.meals.dinner.time || '');
        setDinnerAppetite(todayLog.meals.dinner.appetite || 3);
        setDinnerAmount(todayLog.meals.dinner.amountEaten || 3);
        setDinnerAssistance(todayLog.meals.dinner.assistance || 'none');
      }

      // Load night sleep
      if (todayLog.nightSleep) {
        setBedtime(todayLog.nightSleep.bedtime || '');
        setSleepQuality(todayLog.nightSleep.quality || 'light');
        setWakings(todayLog.nightSleep.wakings || 0);
        setWakingReasons(todayLog.nightSleep.wakingReasons || []);
        setBehaviors(todayLog.nightSleep.behaviors || []);
        setSleepNotes(todayLog.nightSleep.notes || '');
      }

      // Load evening medications
      if (todayLog.medications) {
        const eveningMeds = todayLog.medications.filter(
          m => m.timeSlot === 'evening' || m.timeSlot === 'bedtime'
        );
        if (eveningMeds.length > 0) {
          setMedications(eveningMeds);
        }
      }
    }
  }, [todayLog]);

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

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (logId: string) => {
      if (!token) throw new Error('Not authenticated');

      const payload = {
        // API expects meals as nested object
        meals: dinnerTime ? {
          dinner: {
            time: dinnerTime,
            appetite: dinnerAppetite,
            amountEaten: dinnerAmount,
            assistance: dinnerAssistance,
            swallowingIssues: [],
          },
        } : undefined,
        nightSleep: bedtime ? {
          bedtime,
          quality: sleepQuality,
          wakings,
          wakingReasons,
          behaviors,
          notes: sleepNotes || undefined,
        } : undefined,
        medications: medications.length > 0 ? medications : undefined,
      };

      return authenticatedApiCall(
        `/care-logs/${logId}`,
        token,
        {
          method: 'PATCH',
          body: JSON.stringify(payload),
        }
      );
    },
    onSuccess: () => {
      setLastSaved(new Date());
      queryClient.invalidateQueries({ queryKey: ['caregiver-today-log'] });
    },
  });

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
          body: JSON.stringify({ section: 'evening' }),
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
      if (!logId) {
        const newLog = await createLogMutation.mutateAsync();
        logId = newLog.id;
      }
      await saveMutation.mutateAsync(logId);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmitSection = async () => {
    let logId = careLogId;
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

  const toggleWakingReason = (reason: string) => {
    setWakingReasons(prev =>
      prev.includes(reason)
        ? prev.filter(r => r !== reason)
        : [...prev, reason]
    );
  };

  const toggleBehavior = (behavior: string) => {
    setBehaviors(prev =>
      prev.includes(behavior)
        ? prev.filter(b => b !== behavior)
        : [...prev, behavior]
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading evening form...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 pb-24">
      {/* Header */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate({ to: '/caregiver/form' })}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <div className="flex items-center gap-2">
                  <Moon className="h-5 w-5 text-indigo-500" />
                  <h1 className="text-lg font-bold text-gray-900">Evening</h1>
                </div>
                <p className="text-xs text-gray-500">6pm - Bedtime</p>
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
        {/* Dinner */}
        <Card>
          <CardHeader className="pb-3">
            <h2 className="text-lg font-semibold text-gray-900">Dinner</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <RequiredLabel required>Time</RequiredLabel>
              <Input
                type="time"
                value={dinnerTime}
                onChange={(e) => setDinnerTime(e.target.value)}
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
                    onClick={() => setDinnerAppetite(level)}
                    className={`w-10 h-10 rounded-full font-medium transition-colors ${
                      dinnerAppetite === level
                        ? 'bg-indigo-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <RequiredLabel required>Amount Eaten (1-5)</RequiredLabel>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setDinnerAmount(level)}
                    className={`w-10 h-10 rounded-full font-medium transition-colors ${
                      dinnerAmount === level
                        ? 'bg-indigo-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <OptionalLabel>Assistance Level</OptionalLabel>
              <div className="flex gap-2">
                {(['none', 'some', 'full'] as const).map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setDinnerAssistance(level)}
                    className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      dinnerAssistance === level
                        ? 'bg-indigo-100 border-indigo-500 text-indigo-800'
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

        {/* Bedtime Setup */}
        <Card>
          <CardHeader className="pb-3">
            <h2 className="text-lg font-semibold text-gray-900">Bedtime</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <OptionalLabel>Bedtime</OptionalLabel>
              <Input
                type="time"
                value={bedtime}
                onChange={(e) => setBedtime(e.target.value)}
                className="max-w-[150px]"
              />
            </div>

            {bedtime && (
              <>
                <div>
                  <OptionalLabel>Expected Sleep Quality</OptionalLabel>
                  <div className="grid grid-cols-2 gap-2">
                    {(['deep', 'light', 'restless', 'no_sleep'] as const).map((quality) => (
                      <button
                        key={quality}
                        type="button"
                        onClick={() => setSleepQuality(quality)}
                        className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                          sleepQuality === quality
                            ? 'bg-indigo-100 border-indigo-500 text-indigo-800'
                            : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {quality === 'no_sleep' ? 'No Sleep' : quality.charAt(0).toUpperCase() + quality.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <OptionalLabel>Night Wakings (if known from previous night)</OptionalLabel>
                  <div className="flex gap-2">
                    {[0, 1, 2, 3, 4, 5].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setWakings(num)}
                        className={`w-10 h-10 rounded-full font-medium transition-colors ${
                          wakings === num
                            ? 'bg-indigo-500 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {num === 5 ? '5+' : num}
                      </button>
                    ))}
                  </div>
                </div>

                {wakings > 0 && (
                  <div>
                    <OptionalLabel>Reasons for Waking</OptionalLabel>
                    <div className="flex flex-wrap gap-2">
                      {wakingReasonOptions.map((reason) => (
                        <button
                          key={reason}
                          type="button"
                          onClick={() => toggleWakingReason(reason)}
                          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                            wakingReasons.includes(reason)
                              ? 'bg-indigo-100 border-indigo-500 text-indigo-800 border'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {reason}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <OptionalLabel>Behaviors Before Sleep</OptionalLabel>
                  <div className="flex flex-wrap gap-2">
                    {behaviorOptions.map((behavior) => (
                      <button
                        key={behavior}
                        type="button"
                        onClick={() => toggleBehavior(behavior)}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                          behaviors.includes(behavior)
                            ? 'bg-indigo-100 border-indigo-500 text-indigo-800 border'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {behavior}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <OptionalLabel>Notes</OptionalLabel>
                  <Input
                    type="text"
                    value={sleepNotes}
                    onChange={(e) => setSleepNotes(e.target.value)}
                    placeholder="Any notes about sleep or bedtime..."
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Evening Medications */}
        {medications.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <h2 className="text-lg font-semibold text-gray-900">Evening Medications</h2>
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
                        {med.timeSlot === 'bedtime' ? 'Bedtime' : 'Evening'}
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
            disabled={submitSectionMutation.isPending || !dinnerTime}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-6 text-lg"
          >
            {submitSectionMutation.isPending ? (
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
            ) : isSubmitted ? (
              <CheckCircle className="h-5 w-5 mr-2" />
            ) : null}
            {isSubmitted ? 'Update & Re-submit Evening' : 'Submit Evening Section'}
          </Button>

          <div className="flex gap-3">
            <Link to="/caregiver/form/afternoon" className="flex-1">
              <Button variant="outline" className="w-full flex items-center justify-center gap-2">
                <ChevronLeft className="h-4 w-4" />
                <span>Afternoon</span>
              </Button>
            </Link>
            <Link to="/caregiver/form/summary" className="flex-1">
              <Button variant="outline" className="w-full flex items-center justify-center gap-2">
                <span>Summary</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
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
