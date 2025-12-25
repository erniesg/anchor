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
  FileText,
  ArrowLeft,
  CheckCircle,
  Clock,
  Save,
  Loader2,
  ChevronLeft,
  AlertTriangle,
  Shield,
  Droplets,
} from 'lucide-react';

export const Route = createFileRoute('/caregiver/form/summary')({
  component: SummaryFormComponent,
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

interface CareLog {
  id: string;
  status: 'draft' | 'submitted' | 'invalidated';
  completedSections?: {
    morning?: { submittedAt: string; submittedBy: string };
    afternoon?: { submittedAt: string; submittedBy: string };
    evening?: { submittedAt: string; submittedBy: string };
    dailySummary?: { submittedAt: string; submittedBy: string };
  };
  // Fluids summary
  fluids?: Array<{ name: string; time: string; amountMl: number }>;
  totalFluidIntake?: number;
  // Fall risk
  balanceIssues?: number;
  nearFalls?: 'none' | 'once_or_twice' | 'multiple';
  actualFalls?: 'none' | 'minor' | 'major';
  walkingPattern?: string[];
  freezingEpisodes?: 'none' | 'mild' | 'severe';
  // Unaccompanied time
  unaccompaniedTime?: Array<{
    startTime: string;
    endTime: string;
    reason: string;
    replacementPerson: string;
    duration: number;
  }>;
  unaccompaniedIncidents?: string;
  // Safety checks
  safetyChecks?: {
    tripHazards: { checked: boolean; action: string };
    cables: { checked: boolean; action: string };
    sandals: { checked: boolean; action: string };
    slipHazards: { checked: boolean; action: string };
    mobilityAids: { checked: boolean; action: string };
    emergencyEquipment: { checked: boolean; action: string };
  };
  // Caregiver notes
  whatWentWell?: string;
  challengesFaced?: string;
  recommendationsForTomorrow?: string;
  importantInfoForFamily?: string;
  notes?: string;
}

function SummaryFormComponent() {
  const { token, careRecipient } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Form state
  const [careLogId, setCareLogId] = useState<string | null>(null);

  // Fall Risk
  const [balanceIssues, setBalanceIssues] = useState<number | null>(null);
  const [nearFalls, setNearFalls] = useState<'none' | 'once_or_twice' | 'multiple'>('none');
  const [actualFalls, setActualFalls] = useState<'none' | 'minor' | 'major'>('none');
  const [walkingPattern, setWalkingPattern] = useState<string[]>([]);
  const [freezingEpisodes, setFreezingEpisodes] = useState<'none' | 'mild' | 'severe'>('none');

  // Unaccompanied Time
  const [unaccompaniedTime, setUnaccompaniedTime] = useState<Array<{
    startTime: string;
    endTime: string;
    reason: string;
    replacementPerson: string;
  }>>([]);
  const [unaccompaniedIncidents, setUnaccompaniedIncidents] = useState('');

  // Safety Checks
  const [safetyChecks, setSafetyChecks] = useState({
    tripHazards: { checked: false, action: '' },
    cables: { checked: false, action: '' },
    sandals: { checked: false, action: '' },
    slipHazards: { checked: false, action: '' },
    mobilityAids: { checked: false, action: '' },
    emergencyEquipment: { checked: false, action: '' },
  });

  // Caregiver Notes
  const [whatWentWell, setWhatWentWell] = useState('');
  const [challengesFaced, setChallengesFaced] = useState('');
  const [recommendationsForTomorrow, setRecommendationsForTomorrow] = useState('');
  const [importantInfoForFamily, setImportantInfoForFamily] = useState('');
  const [notes, setNotes] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [totalFluids, setTotalFluids] = useState(0);

  const walkingPatternOptions = [
    'Steady',
    'Unsteady',
    'Shuffling',
    'Wide-based',
    'Uses aid',
  ];

  const safetyCheckLabels: Record<string, string> = {
    tripHazards: 'Trip hazards cleared',
    cables: 'Cables secured',
    sandals: 'Proper footwear worn',
    slipHazards: 'Slip hazards addressed',
    mobilityAids: 'Mobility aids accessible',
    emergencyEquipment: 'Emergency equipment ready',
  };

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
      setIsSubmitted(!!todayLog.completedSections?.dailySummary);

      // Load fluids summary
      if (todayLog.totalFluidIntake) {
        setTotalFluids(todayLog.totalFluidIntake);
      } else if (todayLog.fluids) {
        const total = todayLog.fluids.reduce((sum, f) => sum + f.amountMl, 0);
        setTotalFluids(total);
      }

      // Load fall risk
      if (todayLog.balanceIssues !== undefined) setBalanceIssues(todayLog.balanceIssues);
      if (todayLog.nearFalls) setNearFalls(todayLog.nearFalls);
      if (todayLog.actualFalls) setActualFalls(todayLog.actualFalls);
      if (todayLog.walkingPattern) setWalkingPattern(todayLog.walkingPattern);
      if (todayLog.freezingEpisodes) setFreezingEpisodes(todayLog.freezingEpisodes);

      // Load unaccompanied time
      if (todayLog.unaccompaniedTime) {
        setUnaccompaniedTime(todayLog.unaccompaniedTime.map(u => ({
          startTime: u.startTime,
          endTime: u.endTime,
          reason: u.reason,
          replacementPerson: u.replacementPerson,
        })));
      }
      if (todayLog.unaccompaniedIncidents) setUnaccompaniedIncidents(todayLog.unaccompaniedIncidents);

      // Load safety checks
      if (todayLog.safetyChecks) {
        setSafetyChecks(todayLog.safetyChecks);
      }

      // Load caregiver notes
      if (todayLog.whatWentWell) setWhatWentWell(todayLog.whatWentWell);
      if (todayLog.challengesFaced) setChallengesFaced(todayLog.challengesFaced);
      if (todayLog.recommendationsForTomorrow) setRecommendationsForTomorrow(todayLog.recommendationsForTomorrow);
      if (todayLog.importantInfoForFamily) setImportantInfoForFamily(todayLog.importantInfoForFamily);
      if (todayLog.notes) setNotes(todayLog.notes);
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
        balanceIssues: balanceIssues ?? undefined,
        nearFalls,
        actualFalls,
        walkingPattern: walkingPattern.length > 0 ? walkingPattern : undefined,
        freezingEpisodes,
        unaccompaniedTime: unaccompaniedTime.length > 0 ? unaccompaniedTime.map(u => ({
          ...u,
          duration: calculateDuration(u.startTime, u.endTime),
        })) : undefined,
        unaccompaniedIncidents: unaccompaniedIncidents || undefined,
        safetyChecks,
        whatWentWell: whatWentWell || undefined,
        challengesFaced: challengesFaced || undefined,
        recommendationsForTomorrow: recommendationsForTomorrow || undefined,
        importantInfoForFamily: importantInfoForFamily || undefined,
        notes: notes || undefined,
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
          body: JSON.stringify({ section: 'dailySummary' }),
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

  const calculateDuration = (start: string, end: string): number => {
    if (!start || !end) return 0;
    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);
    return (endH * 60 + endM) - (startH * 60 + startM);
  };

  const toggleSafetyCheck = (key: keyof typeof safetyChecks) => {
    setSafetyChecks(prev => ({
      ...prev,
      [key]: { ...prev[key], checked: !prev[key].checked },
    }));
  };

  const toggleWalkingPattern = (pattern: string) => {
    setWalkingPattern(prev =>
      prev.includes(pattern)
        ? prev.filter(p => p !== pattern)
        : [...prev, pattern]
    );
  };

  const addUnaccompaniedPeriod = () => {
    setUnaccompaniedTime(prev => [
      ...prev,
      { startTime: '', endTime: '', reason: '', replacementPerson: '' },
    ]);
  };

  const removeUnaccompaniedPeriod = (index: number) => {
    setUnaccompaniedTime(prev => prev.filter((_, i) => i !== index));
  };

  const updateUnaccompaniedPeriod = (index: number, field: string, value: string) => {
    setUnaccompaniedTime(prev => prev.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    ));
  };

  // Check section completion status
  const completedSections = todayLog?.completedSections || {};
  const sectionsCompleted = [
    !!completedSections.morning,
    !!completedSections.afternoon,
    !!completedSections.evening,
  ].filter(Boolean).length;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-green-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-emerald-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading summary...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-green-50 pb-24">
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
                  <FileText className="h-5 w-5 text-emerald-500" />
                  <h1 className="text-lg font-bold text-gray-900">Daily Summary</h1>
                </div>
                <p className="text-xs text-gray-500">End of day wrap-up</p>
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
        {/* Section Progress */}
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">Today's Progress</h3>
              <span className="text-sm text-gray-500">{sectionsCompleted}/3 sections</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {['Morning', 'Afternoon', 'Evening'].map((section, i) => {
                const key = section.toLowerCase() as 'morning' | 'afternoon' | 'evening';
                const isComplete = !!completedSections[key];
                return (
                  <div
                    key={section}
                    className={`text-center py-2 rounded-lg text-sm font-medium ${
                      isComplete
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {isComplete && <CheckCircle className="h-4 w-4 inline mr-1" />}
                    {section}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Fluids Summary */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Droplets className="h-5 w-5 text-blue-500" />
              <h2 className="text-lg font-semibold text-gray-900">Fluid Intake Summary</h2>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-center py-4">
              <p className="text-4xl font-bold text-blue-600">{totalFluids} ml</p>
              <p className="text-sm text-gray-500 mt-1">Total fluids today</p>
              {totalFluids < 1500 && (
                <p className="text-sm text-amber-600 mt-2">
                  Target: 1500-2000ml daily
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Fall Risk Assessment */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              <h2 className="text-lg font-semibold text-gray-900">Fall Risk Assessment</h2>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <RequiredLabel required>Balance Issues (1-5)</RequiredLabel>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setBalanceIssues(level)}
                    className={`w-10 h-10 rounded-full font-medium transition-colors ${
                      balanceIssues === level
                        ? 'bg-emerald-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-1">1 = No issues, 5 = Severe</p>
            </div>

            <div>
              <RequiredLabel required>Near Falls Today</RequiredLabel>
              <div className="flex gap-2">
                {(['none', 'once_or_twice', 'multiple'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setNearFalls(option)}
                    className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      nearFalls === option
                        ? 'bg-emerald-100 border-emerald-500 text-emerald-800'
                        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {option === 'none' ? 'None' : option === 'once_or_twice' ? '1-2 times' : 'Multiple'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <RequiredLabel required>Actual Falls Today</RequiredLabel>
              <div className="flex gap-2">
                {(['none', 'minor', 'major'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setActualFalls(option)}
                    className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                      actualFalls === option
                        ? option === 'major'
                          ? 'bg-red-100 border-red-500 text-red-800'
                          : 'bg-emerald-100 border-emerald-500 text-emerald-800'
                        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {option.charAt(0).toUpperCase() + option.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <OptionalLabel>Walking Pattern</OptionalLabel>
              <div className="flex flex-wrap gap-2">
                {walkingPatternOptions.map((pattern) => (
                  <button
                    key={pattern}
                    type="button"
                    onClick={() => toggleWalkingPattern(pattern)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      walkingPattern.includes(pattern)
                        ? 'bg-emerald-100 border-emerald-500 text-emerald-800 border'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {pattern}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Safety Checks */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-500" />
              <h2 className="text-lg font-semibold text-gray-900">Safety Checks</h2>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(safetyCheckLabels).map(([key, label]) => (
                <div
                  key={key}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                    safetyChecks[key as keyof typeof safetyChecks].checked
                      ? 'bg-green-50 border-green-200'
                      : 'bg-white border-gray-200'
                  }`}
                >
                  <span className="text-sm text-gray-700">{label}</span>
                  <button
                    type="button"
                    onClick={() => toggleSafetyCheck(key as keyof typeof safetyChecks)}
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                      safetyChecks[key as keyof typeof safetyChecks].checked
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                    }`}
                  >
                    <CheckCircle className="h-5 w-5" />
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Unaccompanied Time */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Unaccompanied Time</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={addUnaccompaniedPeriod}
              >
                + Add Period
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {unaccompaniedTime.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">
                No unaccompanied periods recorded
              </p>
            ) : (
              <div className="space-y-4">
                {unaccompaniedTime.map((period, index) => (
                  <div key={index} className="p-3 border rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Period {index + 1}</span>
                      <button
                        type="button"
                        onClick={() => removeUnaccompaniedPeriod(index)}
                        className="text-red-500 text-sm hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-500">Start</label>
                        <Input
                          type="time"
                          value={period.startTime}
                          onChange={(e) => updateUnaccompaniedPeriod(index, 'startTime', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">End</label>
                        <Input
                          type="time"
                          value={period.endTime}
                          onChange={(e) => updateUnaccompaniedPeriod(index, 'endTime', e.target.value)}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Reason</label>
                      <Input
                        type="text"
                        value={period.reason}
                        onChange={(e) => updateUnaccompaniedPeriod(index, 'reason', e.target.value)}
                        placeholder="e.g., Break, errand"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Who was available?</label>
                      <Input
                        type="text"
                        value={period.replacementPerson}
                        onChange={(e) => updateUnaccompaniedPeriod(index, 'replacementPerson', e.target.value)}
                        placeholder="e.g., Family member name"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Caregiver Notes */}
        <Card>
          <CardHeader className="pb-3">
            <h2 className="text-lg font-semibold text-gray-900">Caregiver Notes</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <OptionalLabel>What went well today?</OptionalLabel>
              <textarea
                value={whatWentWell}
                onChange={(e) => setWhatWentWell(e.target.value)}
                className="w-full p-3 border rounded-lg text-sm resize-none"
                rows={2}
                placeholder="Positive moments, good progress..."
              />
            </div>

            <div>
              <OptionalLabel>Challenges faced</OptionalLabel>
              <textarea
                value={challengesFaced}
                onChange={(e) => setChallengesFaced(e.target.value)}
                className="w-full p-3 border rounded-lg text-sm resize-none"
                rows={2}
                placeholder="Any difficulties today..."
              />
            </div>

            <div>
              <OptionalLabel>Recommendations for tomorrow</OptionalLabel>
              <textarea
                value={recommendationsForTomorrow}
                onChange={(e) => setRecommendationsForTomorrow(e.target.value)}
                className="w-full p-3 border rounded-lg text-sm resize-none"
                rows={2}
                placeholder="Things to watch for, suggestions..."
              />
            </div>

            <div>
              <OptionalLabel>Important info for family</OptionalLabel>
              <textarea
                value={importantInfoForFamily}
                onChange={(e) => setImportantInfoForFamily(e.target.value)}
                className="w-full p-3 border rounded-lg text-sm resize-none"
                rows={2}
                placeholder="Anything the family should know..."
              />
            </div>

            <div>
              <OptionalLabel>Additional notes</OptionalLabel>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full p-3 border rounded-lg text-sm resize-none"
                rows={3}
                placeholder="Any other observations..."
              />
            </div>
          </CardContent>
        </Card>

        {/* Submit Section Button */}
        <div className="space-y-3">
          <Button
            onClick={handleSubmitSection}
            disabled={submitSectionMutation.isPending || balanceIssues === null}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-6 text-lg"
          >
            {submitSectionMutation.isPending ? (
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
            ) : isSubmitted ? (
              <CheckCircle className="h-5 w-5 mr-2" />
            ) : null}
            {isSubmitted ? 'Update & Re-submit Summary' : 'Submit Daily Summary'}
          </Button>

          <Link to="/caregiver/form/evening" className="block">
            <Button variant="outline" className="w-full flex items-center justify-center gap-2">
              <ChevronLeft className="h-4 w-4" />
              <span>Back to Evening</span>
            </Button>
          </Link>
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
