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
  Cloud,
  ArrowLeft,
  CheckCircle,
  Clock,
  Save,
  Loader2,
  ChevronRight,
  ChevronLeft,
  AlertCircle,
} from 'lucide-react';

export const Route = createFileRoute('/caregiver/form/afternoon')({
  component: AfternoonFormComponent,
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
  // Afternoon rest
  afternoonRest?: {
    startTime: string;
    endTime: string;
    quality: 'deep' | 'light' | 'restless' | 'no_sleep';
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

function AfternoonFormComponent() {
  const { token, careRecipient } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Form state
  const [careLogId, setCareLogId] = useState<string | null>(null);

  // Lunch
  const [lunchTime, setLunchTime] = useState('');
  const [lunchAmount, setLunchAmount] = useState(3);
  const [lunchAssistance, setLunchAssistance] = useState<'none' | 'some' | 'full'>('none');
  const [lunchSwallowingIssues, setLunchSwallowingIssues] = useState<string[]>([]);

  // Tea Break
  const [teaBreakTime, setTeaBreakTime] = useState('');
  const [teaBreakAmount, setTeaBreakAmount] = useState(3);

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

  const toggleSwallowingIssue = (issue: string) => {
    setLunchSwallowingIssues(prev =>
      prev.includes(issue) ? prev.filter(i => i !== issue) : [...prev, issue]
    );
  };

  // Afternoon Rest
  const [restEnabled, setRestEnabled] = useState(false);
  const [restStartTime, setRestStartTime] = useState('');
  const [restEndTime, setRestEndTime] = useState('');
  const [restQuality, setRestQuality] = useState<'deep' | 'light' | 'restless' | 'no_sleep'>('light');
  const [restNotes, setRestNotes] = useState('');

  // Afternoon medications
  const [medications, setMedications] = useState<Array<{
    name: string;
    given: boolean;
    time: string | null;
    timeSlot: string;
  }>>([]);

  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Validation - check all required fields
  const missingFields: string[] = [];
  if (!lunchTime) missingFields.push('Lunch Time');
  if (restEnabled) {
    if (!restStartTime) missingFields.push('Rest Start Time');
    if (!restEndTime) missingFields.push('Rest End Time');
  }

  const canSubmit = missingFields.length === 0;
  const requiredFieldsForProgress = restEnabled ? [lunchTime, restStartTime, restEndTime] : [lunchTime];
  const completedFieldsCount = requiredFieldsForProgress.filter(Boolean).length;
  const totalRequiredFields = requiredFieldsForProgress.length;

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
      setIsSubmitted(!!todayLog.completedSections?.afternoon);

      // Load lunch from meals object
      if (todayLog.meals?.lunch) {
        setLunchTime(todayLog.meals.lunch.time || '');
        setLunchAmount(todayLog.meals.lunch.amountEaten || 3);
        setLunchAssistance(todayLog.meals.lunch.assistance || 'none');
        setLunchSwallowingIssues(todayLog.meals.lunch.swallowingIssues || []);
      }

      // Load tea break from meals object
      if (todayLog.meals?.teaBreak) {
        setTeaBreakTime(todayLog.meals.teaBreak.time || '');
        setTeaBreakAmount(todayLog.meals.teaBreak.amountEaten || 3);
      }

      // Load afternoon rest
      if (todayLog.afternoonRest) {
        setRestEnabled(true);
        setRestStartTime(todayLog.afternoonRest.startTime || '');
        setRestEndTime(todayLog.afternoonRest.endTime || '');
        setRestQuality(todayLog.afternoonRest.quality || 'light');
        setRestNotes(todayLog.afternoonRest.notes || '');
      }

      // Load afternoon medications
      if (todayLog.medications) {
        const afternoonMeds = todayLog.medications.filter(
          m => m.timeSlot === 'afternoon'
        );
        if (afternoonMeds.length > 0) {
          setMedications(afternoonMeds);
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

      // Build meals object with lunch and teaBreak
      const mealsData: Record<string, unknown> = {};
      if (lunchTime) {
        mealsData.lunch = {
          time: lunchTime,
          amountEaten: lunchAmount,
          assistance: lunchAssistance,
          swallowingIssues: lunchSwallowingIssues,
        };
      }
      if (teaBreakTime) {
        mealsData.teaBreak = {
          time: teaBreakTime,
          amountEaten: teaBreakAmount,
          swallowingIssues: [],
        };
      }

      const payload = {
        // API expects meals as nested object
        meals: Object.keys(mealsData).length > 0 ? mealsData : undefined,
        afternoonRest: restEnabled && restStartTime ? {
          startTime: restStartTime,
          endTime: restEndTime,
          quality: restQuality,
          notes: restNotes || undefined,
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
          body: JSON.stringify({ section: 'afternoon' }),
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-sky-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading afternoon form...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 to-blue-50 pb-24">
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
                  <Cloud className="h-5 w-5 text-sky-500" />
                  <h1 className="text-lg font-bold text-gray-900">Afternoon</h1>
                </div>
                <p className="text-xs text-gray-500">12pm - 6pm</p>
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
        {/* Lunch */}
        <Card>
          <CardHeader className="pb-3">
            <h2 className="text-lg font-semibold text-gray-900">Lunch</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <RequiredLabel required>Time</RequiredLabel>
              <Input
                type="time"
                value={lunchTime}
                onChange={(e) => setLunchTime(e.target.value)}
                className="max-w-[150px]"
              />
            </div>

            <div>
              <RequiredLabel required>Amount Eaten (1-5)</RequiredLabel>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setLunchAmount(level)}
                    className={`w-10 h-10 rounded-full font-medium transition-colors ${
                      lunchAmount === level
                        ? 'bg-sky-500 text-white'
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
              <Label>Assistance Level</Label>
              <div className="flex gap-2">
                {(['none', 'some', 'full'] as const).map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setLunchAssistance(level)}
                    className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      lunchAssistance === level
                        ? 'bg-sky-100 border-sky-500 text-sky-800'
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
                      lunchSwallowingIssues.includes(issue)
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

        {/* Tea Break */}
        <Card>
          <CardHeader className="pb-3">
            <h2 className="text-lg font-semibold text-gray-900">Tea Break</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Time</Label>
              <Input
                type="time"
                value={teaBreakTime}
                onChange={(e) => setTeaBreakTime(e.target.value)}
                className="max-w-[150px]"
              />
            </div>

            {teaBreakTime && (
              <div>
                <Label>Amount Eaten (1-5)</Label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setTeaBreakAmount(level)}
                      className={`w-10 h-10 rounded-full font-medium transition-colors ${
                        teaBreakAmount === level
                          ? 'bg-sky-500 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-1">1 = Nothing, 5 = Everything</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Afternoon Rest */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Afternoon Rest</h2>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={restEnabled}
                  onChange={(e) => setRestEnabled(e.target.checked)}
                  className="h-5 w-5 rounded border-gray-300 text-sky-600 focus:ring-sky-500"
                />
                <span className="text-sm text-gray-600">Had rest</span>
              </label>
            </div>
          </CardHeader>
          {restEnabled && (
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <RequiredLabel required>Start Time</RequiredLabel>
                  <Input
                    type="time"
                    value={restStartTime}
                    onChange={(e) => setRestStartTime(e.target.value)}
                  />
                </div>
                <div>
                  <RequiredLabel required>End Time</RequiredLabel>
                  <Input
                    type="time"
                    value={restEndTime}
                    onChange={(e) => setRestEndTime(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <RequiredLabel required>Sleep Quality</RequiredLabel>
                <div className="grid grid-cols-2 gap-2">
                  {(['deep', 'light', 'restless', 'no_sleep'] as const).map((quality) => (
                    <button
                      key={quality}
                      type="button"
                      onClick={() => setRestQuality(quality)}
                      className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                        restQuality === quality
                          ? 'bg-sky-100 border-sky-500 text-sky-800'
                          : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {quality === 'no_sleep' ? 'No Sleep' : quality.charAt(0).toUpperCase() + quality.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label>Notes</Label>
                <Input
                  type="text"
                  value={restNotes}
                  onChange={(e) => setRestNotes(e.target.value)}
                  placeholder="Any notes about rest..."
                />
              </div>
            </CardContent>
          )}
        </Card>

        {/* Afternoon Medications */}
        {medications.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <h2 className="text-lg font-semibold text-gray-900">Afternoon Medications</h2>
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
                      <p className="text-xs text-gray-500">Afternoon</p>
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
        <Card className={`border-2 ${canSubmit ? 'border-green-200 bg-green-50' : 'border-sky-200 bg-sky-50'}`}>
          <CardContent className="py-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Section Progress</span>
              <span className={`text-sm font-bold ${canSubmit ? 'text-green-600' : 'text-sky-600'}`}>
                {completedFieldsCount}/{totalRequiredFields} required
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
              <div
                className={`h-2 rounded-full transition-all ${canSubmit ? 'bg-green-500' : 'bg-sky-500'}`}
                style={{ width: `${(completedFieldsCount / totalRequiredFields) * 100}%` }}
              />
            </div>
            {!canSubmit && (
              <div className="flex items-start gap-2 text-sky-700 text-sm">
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
                ? 'bg-sky-600 hover:bg-sky-700 text-white'
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
                Update & Re-submit Afternoon
              </>
            ) : !canSubmit ? (
              <>
                <AlertCircle className="h-5 w-5 mr-2" />
                Complete Required Fields
              </>
            ) : (
              'Submit Afternoon Section'
            )}
          </Button>

          <div className="flex gap-3">
            <Link to="/caregiver/form/morning" className="flex-1">
              <Button variant="outline" className="w-full flex items-center justify-center gap-2">
                <ChevronLeft className="h-4 w-4" />
                <span>Morning</span>
              </Button>
            </Link>
            <Link to="/caregiver/form/evening" className="flex-1">
              <Button variant="outline" className="w-full flex items-center justify-center gap-2">
                <span>Evening</span>
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
