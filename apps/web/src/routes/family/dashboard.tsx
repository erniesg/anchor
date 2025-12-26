import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Copy, Check, Heart, History, X } from 'lucide-react';
import { authenticatedApiCall } from '@/lib/api';
import { FamilyLayout } from '@/components/FamilyLayout';
import { useAuth } from '@/contexts/AuthContext';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks } from 'date-fns';

export const Route = createFileRoute('/family/dashboard')({
  component: DashboardComponent,
});

interface FluidEntry {
  time?: string;
  name?: string;
  amount?: number;
  amountMl?: number;
  swallowingIssues?: string[];
}

interface SleepData {
  quality?: 'deep' | 'light' | 'restless' | 'none';
  wakings?: number;
}

interface ChartDataItem {
  date: string;
  afternoonRest?: SleepData;
  nightSleep?: SleepData;
  [key: string]: unknown;
}

interface MedicationEntry {
  name?: string;
  given?: boolean;
  time?: string;
  purpose?: string;
  notes?: string;
}

interface ExerciseEntry {
  type?: string;
  duration?: number;
  participation?: number;
}

interface ExerciseSession {
  startTime?: string;
  endTime?: string;
  exercises?: ExerciseEntry[];
  notes?: string;
}

interface MovementDifficultyData {
  level?: 'canDoAlone' | 'needsSomeHelp' | 'needsFullHelp' | 'fallsOrDrops';
  notes?: string;
}

interface UnaccompaniedPeriod {
  startTime?: string;
  endTime?: string;
  reason?: string;
  replacementPerson?: string;
}

interface SafetyCheckItem {
  checked?: boolean;
  action?: string;
}

interface PersonalItemCheckItem {
  checked?: boolean;
  status?: string;
  notes?: string;
}

interface MealsData {
  breakfast?: {
    appetite?: number;
    amountEaten?: number;
  };
}

interface MedicationAdherenceData {
  percentage?: number;
  given?: number;
  missed?: number;
}

interface CompletedSection {
  submittedAt: string;
  submittedBy: string;
}

interface CompletedSections {
  morning?: CompletedSection;
  afternoon?: CompletedSection;
  evening?: CompletedSection;
  dailySummary?: CompletedSection;
}

interface CareLog {
  id: string;
  logDate: string;
  status?: string;
  completedSections?: CompletedSections;
  hasUnviewedChanges?: boolean;
  bloodPressure?: string;
  pulseRate?: number;
  oxygenLevel?: number;
  bloodSugar?: number;
  totalFluidIntake?: number;
  totalUnaccompaniedMinutes?: number;
  balanceIssues?: boolean;
  nearFalls?: string;
  actualFalls?: string;
  fluids?: FluidEntry[];
  medications?: MedicationEntry[];
  meals?: MealsData;
  medicationAdherence?: MedicationAdherenceData;
  morningExerciseSession?: ExerciseSession;
  afternoonExerciseSession?: ExerciseSession;
  movementDifficulties?: Record<string, MovementDifficultyData>;
  unaccompaniedTime?: UnaccompaniedPeriod[];
  unaccompaniedIncidents?: string;
  safetyChecks?: Record<string, SafetyCheckItem>;
  emergencyPrep?: Record<string, boolean>;
  roomMaintenance?: {
    cleaningStatus?: string;
    roomComfort?: string;
  };
  personalItemsCheck?: Record<string, PersonalItemCheckItem>;
  hospitalBagStatus?: {
    lastChecked?: string;
    bagReady?: boolean;
  };
  [key: string]: unknown;
}

// Status Badge Component
function StatusBadge({ status }: { status?: string }) {
  if (!status) return null;

  const styles = {
    draft: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    submitted: 'bg-green-100 text-green-800 border-green-200',
    invalidated: 'bg-red-100 text-red-800 border-red-200',
  };

  const labels = {
    draft: '📝 Draft (In Progress)',
    submitted: '✅ Submitted',
    invalidated: '⚠️ Needs Correction',
  };

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${styles[status as keyof typeof styles] || ''}`}>
      {labels[status as keyof typeof labels] || status}
    </span>
  );
}

function DashboardComponent() {
  const navigate = useNavigate();
  const { user, token, careRecipient, setCareRecipient: setAuthCareRecipient } = useAuth();
  const [viewMode, setViewMode] = useState<'today' | 'week' | 'activity'>('today');
  const [weekOffset, setWeekOffset] = useState(0); // 0 = this week, -1 = last week, etc.
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Fetch care recipients from API to check onboarding status
  const { data: careRecipients } = useQuery({
    queryKey: ['care-recipients-onboarding-check'],
    queryFn: async () => {
      if (!token) return null;
      try {
        return await authenticatedApiCall('/care-recipients', token);
      } catch {
        return null;
      }
    },
    enabled: !!user && !!token,
  });

  // Set care recipient from API data if not already set
  useEffect(() => {
    if (careRecipients && careRecipients.length > 0 && !careRecipient) {
      setAuthCareRecipient(careRecipients[0]);
    }
  }, [careRecipients, careRecipient, setAuthCareRecipient]);

  // Redirect to onboarding if no care recipients exist (checked via API)
  useEffect(() => {
    if (user && careRecipients !== undefined && careRecipients !== null && careRecipients.length === 0) {
      navigate({ to: '/family/onboarding' });
    }
  }, [user, careRecipients, navigate]);

  // Calculate week range (Mon-Sun)
  const getWeekRange = (offset: number = 0) => {
    const referenceDate = addWeeks(new Date(), offset);
    const weekStart = startOfWeek(referenceDate, { weekStartsOn: 1 }); // Monday
    const weekEnd = endOfWeek(referenceDate, { weekStartsOn: 1 }); // Sunday
    return { start: weekStart, end: weekEnd };
  };

  const currentWeek = getWeekRange(weekOffset);
  const weekDates = eachDayOfInterval({ start: currentWeek.start, end: currentWeek.end });

  // Fetch today's care log
  const { data: todayLog, isLoading } = useQuery({
    queryKey: ['care-log-today', careRecipient?.id],
    queryFn: async () => {
      if (!careRecipient?.id || !token) return null;
      try {
        return await authenticatedApiCall(`/care-logs/recipient/${careRecipient.id}/today`, token);
      } catch (error) {
        console.error('Failed to fetch today log:', error);
        return null;
      }
    },
    enabled: !!careRecipient?.id && !!token && viewMode === 'today',
    refetchInterval: 30000,
  });

  const queryClient = useQueryClient();

  // Mark care log as viewed mutation
  const markViewedMutation = useMutation({
    mutationFn: async (logId: string) => {
      if (!token) throw new Error('No token');
      return authenticatedApiCall(`/care-logs/${logId}/mark-viewed`, token, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['care-log-today', careRecipient?.id] });
    },
  });

  // Fetch audit history for the care log
  interface AuditEntry {
    id: string;
    careLogId: string;
    action: 'create' | 'update' | 'submit' | 'submit_section';
    changes: Record<string, { old: unknown; new: unknown }> | null;
    snapshot: Record<string, unknown> | null;
    performedBy: string;
    createdAt: string;
  }

  const { data: auditHistory, isLoading: historyLoading } = useQuery<AuditEntry[]>({
    queryKey: ['care-log-history', todayLog?.id],
    queryFn: async () => {
      if (!todayLog?.id || !token) return [];
      try {
        return await authenticatedApiCall(`/care-logs/${todayLog.id}/history`, token);
      } catch (error) {
        console.error('Failed to fetch audit history:', error);
        return [];
      }
    },
    enabled: !!todayLog?.id && !!token && (showHistoryModal || viewMode === 'activity'),
  });

  // Auto-mark as viewed after 3 seconds when there are unviewed changes
  useEffect(() => {
    if (todayLog?.id && todayLog?.hasUnviewedChanges && viewMode === 'today') {
      const timeout = setTimeout(() => {
        markViewedMutation.mutate(todayLog.id);
      }, 3000);
      return () => clearTimeout(timeout);
    }
  }, [todayLog?.id, todayLog?.hasUnviewedChanges, viewMode]);

  // Fetch week data (Mon-Sun)
  const { data: weekLogs, isLoading: weekLoading } = useQuery({
    queryKey: ['care-logs-week', careRecipient?.id, weekOffset],
    queryFn: async () => {
      if (!careRecipient?.id || !token) return [];
      const promises = weekDates.map((date) =>
        authenticatedApiCall(`/care-logs/recipient/${careRecipient.id}/date/${format(date, 'yyyy-MM-dd')}`, token)
          .catch(() => null)
      );
      const results = await Promise.all(promises);
      return results.filter(Boolean);
    },
    enabled: !!careRecipient?.id && !!token && viewMode === 'week',
    refetchInterval: 60000,
  });

  // Transform week data for charts
  const chartData =
    weekLogs?.map((log: CareLog) => ({
      date: format(new Date(log.logDate), 'MMM dd'),
      systolic: log.bloodPressure ? parseInt(log.bloodPressure.split('/')[0]) : null,
      diastolic: log.bloodPressure ? parseInt(log.bloodPressure.split('/')[1]) : null,
      pulse: log.pulseRate,
      oxygen: log.oxygenLevel,
      bloodSugar: log.bloodSugar,
      appetite: log.meals?.breakfast?.appetite || 0,
      amountEaten: log.meals?.breakfast?.amountEaten || 0,
      balanceIssues: log.balanceIssues,
      nearFalls: log.nearFalls === 'none' ? 0 : log.nearFalls === 'once_or_twice' ? 1 : log.nearFalls === 'multiple' ? 2 : null,
      actualFalls: log.actualFalls === 'none' ? 0 : log.actualFalls === 'minor' ? 1 : log.actualFalls === 'major' ? 2 : null,
      unaccompaniedMinutes: log.totalUnaccompaniedMinutes || 0,
      fluidIntake: log.totalFluidIntake || 0, // Sprint 2 Day 2: Fluid intake
      medicationAdherence: log.medicationAdherence?.percentage || 0, // Sprint 2 Day 4: Medication adherence
      medicationsGiven: log.medicationAdherence?.given || 0,
      medicationsMissed: log.medicationAdherence?.missed || 0,
    })) || [];

  // Sprint 2 Day 2: Fluid breakdown details toggle
  const [showFluidDetails, setShowFluidDetails] = useState(false);

  // Sprint 2 Day 3: Sleep details toggle
  const [showSleepDetails, setShowSleepDetails] = useState(false);

  // Caregiver login URL copy state
  const [copiedLoginUrl, setCopiedLoginUrl] = useState(false);

  const caregiverLoginUrl = window.location.origin + '/caregiver/login';

  const copyCaregiverLoginUrl = () => {
    navigator.clipboard.writeText(caregiverLoginUrl);
    setCopiedLoginUrl(true);
    setTimeout(() => setCopiedLoginUrl(false), 2000);
  };

  return (
    <FamilyLayout>
      <div className="bg-gradient-to-br from-primary-50 to-accent-50 min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Page Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">
              {careRecipient ? `${careRecipient.name}'s Care Dashboard` : 'Dashboard'}
            </h1>
            {user && (
              <p className="text-sm text-gray-600 mt-1">Welcome back, {user.name}</p>
            )}
          </div>

        {!careRecipient ? (
          // Onboarding prompt
          <Card>
            <CardHeader>
              <h2 className="text-2xl font-semibold text-gray-900">Getting Started</h2>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-6">
                Welcome to Anchor! Here's how to get started with caregiving coordination:
              </p>
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                    <span className="text-primary-700 font-semibold">1</span>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">Add a care recipient</h3>
                    <p className="text-sm text-gray-600 mt-1">Set up the profile for your loved one</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-accent-100 rounded-full flex items-center justify-center">
                    <span className="text-accent-700 font-semibold">2</span>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">Create caregiver account</h3>
                    <p className="text-sm text-gray-600 mt-1">Generate a PIN for your caregiver to access forms</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-secondary-100 rounded-full flex items-center justify-center">
                    <span className="text-secondary-700 font-semibold">3</span>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">View care logs & trends</h3>
                    <p className="text-sm text-gray-600 mt-1">Monitor daily activities and health trends</p>
                  </div>
                </div>
              </div>
              <div className="mt-8 pt-6 border-t border-gray-100">
                <Button variant="primary" size="lg" onClick={() => window.location.href = '/family/onboarding'}>
                  Start Setup
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          // Dashboard with care logs
          <div className="space-y-6">
            {/* 1. Caregiver Login Info Card - Actions/Notifications at top */}
            <Card className="border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                      <Heart className="h-5 w-5 text-white" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700">
                      Share with caregivers:
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <a
                        href={caregiverLoginUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-700 font-semibold text-sm hover:underline truncate"
                      >
                        {caregiverLoginUrl}
                      </a>
                      <button
                        onClick={copyCaregiverLoginUrl}
                        className="flex-shrink-0 flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                      >
                        {copiedLoginUrl ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        {copiedLoginUrl ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  </div>
                  <Link to="/family/settings/caregivers" search={{ recipientId: undefined, action: undefined }} className="flex-shrink-0 text-blue-600 hover:text-blue-700 text-sm font-medium">
                    Manage →
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* 2. Care Recipient Info + View Toggle + Data - All together */}
            <Card>
              <CardContent className="p-6">
                {/* Header row: Care recipient name + View toggle */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">{careRecipient.name}</h2>
                    <p className="text-sm text-gray-600">{careRecipient.condition || 'No condition specified'}</p>
                  </div>

                  {/* View Mode Toggle */}
                  <div className="flex items-center gap-4">
                    <div className="flex bg-gray-100 rounded-lg p-1">
                      <button
                        onClick={() => { setViewMode('today'); setWeekOffset(0); }}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                          viewMode === 'today'
                            ? 'bg-white text-primary-700 shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        Today
                      </button>
                      <button
                        onClick={() => setViewMode('week')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                          viewMode === 'week'
                            ? 'bg-white text-primary-700 shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        Week
                      </button>
                      <button
                        onClick={() => setViewMode('activity')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                          viewMode === 'activity'
                            ? 'bg-white text-primary-700 shadow-sm'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        Activity
                      </button>
                    </div>

                    {/* Status for today view */}
                    {viewMode === 'today' && (
                      <div className="text-right">
                        {todayLog?.status && (
                          <div className="flex items-center gap-2">
                            <StatusBadge status={todayLog.status} />
                            {todayLog.hasUnviewedChanges && (
                              <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-orange-100 text-orange-800 rounded-full animate-pulse">
                                <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                                New
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Week Navigation */}
                {viewMode === 'week' && (
                  <div className="flex items-center justify-center gap-2 mb-6">
                    <button
                      onClick={() => setWeekOffset(weekOffset - 1)}
                      className="px-3 py-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
                    >
                      ←
                    </button>
                    <span className="text-sm text-gray-700 min-w-[200px] text-center">
                      {weekOffset === 0 ? 'This Week' : `${format(currentWeek.start, 'MMM dd')} - ${format(currentWeek.end, 'MMM dd')}`}
                    </span>
                    <button
                      onClick={() => setWeekOffset(weekOffset + 1)}
                      disabled={weekOffset >= 0}
                      className="px-3 py-1 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      →
                    </button>
                  </div>
                )}

                {/* Last updated for today */}
                {viewMode === 'today' && (
                  <p className="text-xs text-gray-500 mb-4">
                    Last updated: {todayLog ? new Date(todayLog.updatedAt).toLocaleTimeString() : 'No data'}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Unified Today's Progress - Contextual display based on state */}
            {viewMode === 'today' && (() => {
              const completedCount = Object.keys(todayLog?.completedSections || {}).length;
              const hasAnytimeData = todayLog && (
                (todayLog.fluids && (todayLog.fluids as FluidEntry[]).length > 0) ||
                (todayLog.totalFluidIntake && todayLog.totalFluidIntake > 0) ||
                todayLog.bowelMovements ||
                todayLog.urination ||
                todayLog.morningExerciseSession ||
                todayLog.afternoonExerciseSession
              );

              // State 1: No log at all
              if (!todayLog) {
                return (
                  <Card className="border-2 border-dashed border-gray-200">
                    <CardContent className="py-8 text-center">
                      <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                        <span className="text-2xl">📋</span>
                      </div>
                      <h3 className="font-medium text-gray-700">Waiting for today's care log</h3>
                      <p className="text-sm text-gray-500 mt-1">
                        Caregiver will submit sections throughout the day
                      </p>
                    </CardContent>
                  </Card>
                );
              }

              // State 2: Day fully submitted
              if (todayLog.status === 'submitted') {
                return (
                  <Card className="border-2 border-green-300 bg-green-50">
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">✅</span>
                          <div>
                            <h3 className="font-semibold text-green-800">Day Complete</h3>
                            <p className="text-xs text-green-600">All sections submitted</p>
                          </div>
                        </div>
                        {todayLog.id && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowHistoryModal(true)}
                            className="text-xs"
                          >
                            <History className="h-3 w-3 mr-1" />
                            Audit Log
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              }

              // State 3: Some progress (show unified progress)
              return (
                <Card className="border border-primary-100">
                  <CardContent className="py-4">
                    {/* Header with progress */}
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-700">Today's Progress</h3>
                        <p className="text-xs text-gray-500">
                          {completedCount === 0
                            ? 'Logging in progress'
                            : `${completedCount}/4 sections submitted`}
                        </p>
                      </div>
                      {todayLog.id && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowHistoryModal(true)}
                          className="text-xs"
                        >
                          <History className="h-3 w-3 mr-1" />
                          Changes
                        </Button>
                      )}
                    </div>

                    {/* Compact section indicators */}
                    <div className="flex gap-1 mb-3">
                      {[
                        { key: 'morning', icon: '🌅' },
                        { key: 'afternoon', icon: '☀️' },
                        { key: 'evening', icon: '🌙' },
                        { key: 'dailySummary', icon: '📋' },
                      ].map((section) => {
                        const isComplete = !!todayLog.completedSections?.[section.key as keyof CompletedSections];
                        return (
                          <div
                            key={section.key}
                            className={`flex-1 h-2 rounded-full ${
                              isComplete ? 'bg-green-500' : 'bg-gray-200'
                            }`}
                            title={`${section.icon} ${isComplete ? 'Complete' : 'Pending'}`}
                          />
                        );
                      })}
                    </div>

                    {/* Show anytime data if sections not yet complete */}
                    {completedCount === 0 && hasAnytimeData && (
                      <div className="bg-blue-50 rounded-lg p-3 mt-2">
                        <p className="text-xs font-medium text-blue-800 mb-2">Live tracking:</p>
                        <div className="grid grid-cols-3 gap-2 text-center text-xs">
                          {todayLog.totalFluidIntake !== undefined && todayLog.totalFluidIntake > 0 && (
                            <div className="bg-white rounded p-2">
                              <span className="text-lg">💧</span>
                              <p className="font-medium text-blue-700">{todayLog.totalFluidIntake}ml</p>
                            </div>
                          )}
                          {(todayLog.bowelMovements || todayLog.urination) && (
                            <div className="bg-white rounded p-2">
                              <span className="text-lg">🚽</span>
                              <p className="font-medium text-purple-700">Logged</p>
                            </div>
                          )}
                          {(todayLog.morningExerciseSession || todayLog.afternoonExerciseSession) && (
                            <div className="bg-white rounded p-2">
                              <span className="text-lg">🏃</span>
                              <p className="font-medium text-green-700">Active</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })()}

            {/* Alerts */}
            {viewMode === 'today' && todayLog?.emergencyFlag && (
              <Card className="border-2 border-error bg-error/5">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🚨</span>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{todayLog.emergencyNote || 'Emergency flag raised'}</p>
                      <p className="text-sm text-gray-600">Emergency alert</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Consolidated Health Alerts & Warnings */}
            {viewMode === 'today' && todayLog && (() => {
              const alerts = [];

              // Low fluid intake warning
              if (todayLog.totalFluidIntake < 1000) {
                alerts.push({
                  id: 'low-fluid',
                  severity: 'warning',
                  icon: '💧',
                  title: 'Low fluid intake today',
                  description: `Current: ${todayLog.totalFluidIntake || 0}ml / Recommended: 1500-2000ml per day`,
                  details: 'Dehydration risk - encourage more fluids',
                });
              }

              // Swallowing issues alert
              if (todayLog.fluids?.some((f: FluidEntry) => f.swallowingIssues && f.swallowingIssues.length > 0)) {
                const swallowingDetails = todayLog.fluids
                  .filter((f: FluidEntry) => f.swallowingIssues && f.swallowingIssues.length > 0)
                  .map((f: FluidEntry) => `${f.time} - ${f.name}: ${f.swallowingIssues?.join(', ')}`)
                  .join('; ');
                alerts.push({
                  id: 'swallowing',
                  severity: 'critical',
                  icon: '⚠️',
                  title: 'Swallowing issues reported',
                  description: swallowingDetails,
                  details: 'Consider consulting with healthcare provider',
                });
              }

              // Poor sleep quality warning
              if (todayLog.nightSleep && (todayLog.nightSleep.quality === 'no_sleep' || todayLog.nightSleep.quality === 'restless')) {
                const sleepDetails = `Bedtime: ${todayLog.nightSleep.bedtime}${todayLog.nightSleep.wakings > 0 ? ` • Woke ${todayLog.nightSleep.wakings} ${todayLog.nightSleep.wakings === 1 ? 'time' : 'times'}` : ''}`;
                alerts.push({
                  id: 'poor-sleep',
                  severity: 'attention',
                  icon: '😔',
                  title: todayLog.nightSleep.quality === 'no_sleep' ? 'No sleep reported last night' : 'Restless sleep last night',
                  description: sleepDetails,
                  details: todayLog.nightSleep.wakingReasons?.length > 0 ? `Reasons: ${todayLog.nightSleep.wakingReasons.join(', ')}` : null,
                });
              }

              // Frequent night wakings alert
              if (todayLog.nightSleep?.wakings >= 3) {
                alerts.push({
                  id: 'frequent-wakings',
                  severity: 'warning',
                  icon: '⚠️',
                  title: 'Frequent night wakings',
                  description: `Woke ${todayLog.nightSleep.wakings} times during the night`,
                  details: todayLog.nightSleep.wakingReasons?.length > 0 ? todayLog.nightSleep.wakingReasons.map((r: string) => r.charAt(0).toUpperCase() + r.slice(1)).join(', ') : null,
                });
              }

              return alerts.length > 0 ? (
                <Card className="border-2 border-yellow-400">
                  <CardHeader className="rounded-t-lg bg-yellow-50">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-yellow-800">⚠️ Health Alerts</h3>
                      <span className="text-xs bg-yellow-200 text-yellow-800 px-2 py-1 rounded-full font-medium">
                        {alerts.length} {alerts.length === 1 ? 'alert' : 'alerts'}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <div className="divide-y divide-gray-200">
                      {alerts.map((alert) => (
                        <div key={alert.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                          <span className="text-2xl flex-shrink-0">{alert.icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className={`font-medium ${
                              alert.severity === 'critical'
                                ? 'text-red-800'
                                : alert.severity === 'attention'
                                ? 'text-orange-800'
                                : 'text-yellow-800'
                            }`}>
                              {alert.title}
                            </p>
                            <p className={`text-sm mt-1 ${
                              alert.severity === 'critical'
                                ? 'text-red-700'
                                : alert.severity === 'attention'
                                ? 'text-orange-700'
                                : 'text-yellow-700'
                            }`}>
                              {alert.description}
                            </p>
                            {alert.details && (
                              <p className={`text-xs mt-1 ${
                                alert.severity === 'critical'
                                  ? 'text-red-600'
                                  : alert.severity === 'attention'
                                  ? 'text-orange-600'
                                  : 'text-yellow-600'
                              }`}>
                                {alert.details}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : null;
            })()}

            {/* Week View - Trend Charts */}
            {viewMode === 'week' && (
              <div className="space-y-6">
                {weekLoading ? (
                  <Card>
                    <CardContent className="p-6 text-center">
                      <p className="text-gray-600">Loading week data...</p>
                    </CardContent>
                  </Card>
                ) : !weekLogs || weekLogs.length === 0 ? (
                  <Card>
                    <CardContent className="p-6 text-center">
                      <p className="text-gray-600">No data for this week</p>
                      <p className="text-sm text-gray-500 mt-2">Navigate to weeks with caregiver submissions</p>
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    {/* Blood Pressure */}
                    <Card>
                      <CardHeader>
                        <h3 className="font-semibold">📈 Blood Pressure</h3>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={250}>
                          <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" />
                            <YAxis domain={[60, 180]} />
                            <Tooltip />
                            <Legend />
                            <Line type="monotone" dataKey="systolic" stroke="#ef4444" name="Systolic" strokeWidth={2} />
                            <Line type="monotone" dataKey="diastolic" stroke="#3b82f6" name="Diastolic" strokeWidth={2} />
                          </LineChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    {/* Vitals Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <Card>
                        <CardHeader>
                          <h3 className="font-semibold">💓 Pulse & Oxygen</h3>
                        </CardHeader>
                        <CardContent>
                          <ResponsiveContainer width="100%" height={200}>
                            <LineChart data={chartData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="date" />
                              <YAxis yAxisId="left" domain={[50, 120]} />
                              <YAxis yAxisId="right" orientation="right" domain={[90, 100]} />
                              <Tooltip />
                              <Legend />
                              <Line yAxisId="left" type="monotone" dataKey="pulse" stroke="#10b981" name="Pulse" strokeWidth={2} />
                              <Line yAxisId="right" type="monotone" dataKey="oxygen" stroke="#06b6d4" name="O₂ %" strokeWidth={2} />
                            </LineChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <h3 className="font-semibold">🩸 Blood Sugar</h3>
                        </CardHeader>
                        <CardContent>
                          <ResponsiveContainer width="100%" height={200}>
                            <LineChart data={chartData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="date" />
                              <YAxis domain={[4, 10]} />
                              <Tooltip />
                              <Line type="monotone" dataKey="bloodSugar" stroke="#8b5cf6" name="mmol/L" strokeWidth={2} />
                            </LineChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Appetite & Meals */}
                    <Card>
                      <CardHeader>
                        <h3 className="font-semibold">🍽️ Appetite & Consumption</h3>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={250}>
                          <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" />
                            <YAxis yAxisId="left" domain={[0, 5]} />
                            <YAxis yAxisId="right" orientation="right" domain={[0, 100]} />
                            <Tooltip />
                            <Legend />
                            <Bar yAxisId="left" dataKey="appetite" fill="#f59e0b" name="Appetite (1-5)" />
                            <Bar yAxisId="right" dataKey="amountEaten" fill="#84cc16" name="Eaten %" />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    {/* Sprint 1: Fall Risk Assessment */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <Card>
                        <CardHeader>
                          <h3 className="font-semibold">⚖️ Balance Issues</h3>
                        </CardHeader>
                        <CardContent>
                          <ResponsiveContainer width="100%" height={200}>
                            <LineChart data={chartData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="date" />
                              <YAxis domain={[0, 5]} />
                              <Tooltip />
                              <Line type="monotone" dataKey="balanceIssues" stroke="#f59e0b" name="Balance (1-5)" strokeWidth={2} />
                            </LineChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <h3 className="font-semibold">⚠️ Falls Tracking</h3>
                        </CardHeader>
                        <CardContent>
                          <ResponsiveContainer width="100%" height={200}>
                            <LineChart data={chartData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="date" />
                              <YAxis domain={[0, 2]} ticks={[0, 1, 2]} />
                              <Tooltip formatter={(value: number) => {
                                if (value === 0) return 'None';
                                if (value === 1) return 'Once or twice / Minor';
                                if (value === 2) return 'Multiple / Major';
                                return value;
                              }} />
                              <Legend />
                              <Line type="monotone" dataKey="nearFalls" stroke="#facc15" name="Near Falls" strokeWidth={2} />
                              <Line type="monotone" dataKey="actualFalls" stroke="#ef4444" name="Actual Falls" strokeWidth={2} />
                            </LineChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Unaccompanied Time */}
                    <Card>
                      <CardHeader>
                        <h3 className="font-semibold">🕐 Unaccompanied Time</h3>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={200}>
                          <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" />
                            <YAxis />
                            <Tooltip formatter={(value: number) => `${value} minutes`} />
                            <Bar dataKey="unaccompaniedMinutes" fill="#06b6d4" name="Minutes Alone" />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                    {/* Sprint 2 Day 2: Fluid Intake Weekly Trend */}
                    <Card data-testid="fluid-intake-chart">
                      <CardHeader>
                        <h3 className="font-semibold">💧 Fluid Intake Trend</h3>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={250}>
                          <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" />
                            <YAxis domain={[0, 2500]} ticks={[0, 500, 1000, 1500, 2000, 2500]} />
                            <Tooltip formatter={(value: number) => `${value} ml`} />
                            <Bar dataKey="fluidIntake" fill="#3b82f6" name="Fluid Intake (ml)">
                              {chartData.map((entry, index) => (
                                <Cell
                                  key={`cell-${index}`}
                                  fill={entry.fluidIntake < 1000 ? '#fbbf24' : '#3b82f6'}
                                />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                        <div className="mt-3 text-xs text-gray-600 flex items-center justify-center gap-4">
                          <div className="flex items-center gap-1">
                            <div className="w-3 h-3 bg-blue-500 rounded"></div>
                            <span>≥1000ml (adequate)</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-3 h-3 bg-yellow-400 rounded"></div>
                            <span>&lt;1000ml (low)</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Sprint 2 Day 4: Medication Adherence Weekly Trend */}
                    <Card data-testid="medication-adherence-chart">
                      <CardHeader>
                        <h3 className="font-semibold">💊 Medication Adherence</h3>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={250}>
                          <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" />
                            <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} />
                            <Tooltip formatter={(value: number) => `${value}%`} />
                            <Bar dataKey="medicationAdherence" fill="#8b5cf6" name="Adherence %">
                              {chartData.map((entry, index) => (
                                <Cell
                                  key={`cell-${index}`}
                                  fill={
                                    entry.medicationAdherence === 100 ? '#22c55e' :
                                    entry.medicationAdherence >= 80 ? '#fbbf24' :
                                    entry.medicationAdherence > 0 ? '#ef4444' : '#d1d5db'
                                  }
                                />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                        <div className="mt-3 text-xs text-gray-600 flex items-center justify-center gap-4">
                          <div className="flex items-center gap-1">
                            <div className="w-3 h-3 bg-green-500 rounded"></div>
                            <span>100% (all given)</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-3 h-3 bg-yellow-400 rounded"></div>
                            <span>80-99% (mostly given)</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-3 h-3 bg-red-500 rounded"></div>
                            <span>&lt;80% (poor adherence)</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-3 h-3 bg-gray-300 rounded"></div>
                            <span>No data</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Sprint 2 Day 3: Sleep Quality Weekly Trend */}
                    <Card data-testid="sleep-quality-chart">
                      <CardHeader>
                        <h3 className="font-semibold">😴 Sleep Quality Trend</h3>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={250}>
                          <BarChart data={chartData.map((day: ChartDataItem) => {
                            // Convert sleep quality to numeric score for visualization
                            const afternoonScore = day.afternoonRest ? (
                              day.afternoonRest.quality === 'deep' ? 4 :
                              day.afternoonRest.quality === 'light' ? 3 :
                              day.afternoonRest.quality === 'restless' ? 2 : 1
                            ) : 0;
                            const nightScore = day.nightSleep ? (
                              day.nightSleep.quality === 'deep' ? 4 :
                              day.nightSleep.quality === 'light' ? 3 :
                              day.nightSleep.quality === 'restless' ? 2 : 1
                            ) : 0;
                            return {
                              ...day,
                              afternoonSleep: afternoonScore,
                              nightSleep: nightScore,
                              nightWakings: day.nightSleep?.wakings || 0,
                            };
                          })}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" />
                            <YAxis domain={[0, 4]} ticks={[0, 1, 2, 3, 4]} />
                            <Tooltip formatter={(value: number) => {
                              if (value === 4) return 'Deep Sleep';
                              if (value === 3) return 'Light Sleep';
                              if (value === 2) return 'Restless';
                              if (value === 1) return 'No Sleep';
                              return 'Not Recorded';
                            }} />
                            <Legend />
                            <Bar dataKey="afternoonSleep" fill="#60a5fa" name="Afternoon Rest">
                              {chartData.map((entry: ChartDataItem, index: number) => {
                                const quality = entry.afternoonRest?.quality;
                                const color = quality === 'deep' ? '#22c55e' :
                                             quality === 'light' ? '#60a5fa' :
                                             quality === 'restless' ? '#fbbf24' : '#ef4444';
                                return <Cell key={`afternoon-${index}`} fill={color} />;
                              })}
                            </Bar>
                            <Bar dataKey="nightSleep" fill="#8b5cf6" name="Night Sleep">
                              {chartData.map((entry: ChartDataItem, index: number) => {
                                const quality = entry.nightSleep?.quality;
                                const color = quality === 'deep' ? '#22c55e' :
                                             quality === 'light' ? '#8b5cf6' :
                                             quality === 'restless' ? '#fbbf24' : '#ef4444';
                                return <Cell key={`night-${index}`} fill={color} />;
                              })}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                        <div className="mt-3 text-xs text-gray-600 flex flex-wrap items-center justify-center gap-3">
                          <div className="flex items-center gap-1">
                            <div className="w-3 h-3 bg-green-500 rounded"></div>
                            <span>Deep</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-3 h-3 bg-blue-400 rounded"></div>
                            <span>Light (Afternoon)</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-3 h-3 bg-purple-500 rounded"></div>
                            <span>Light (Night)</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-3 h-3 bg-yellow-400 rounded"></div>
                            <span>Restless</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-3 h-3 bg-red-500 rounded"></div>
                            <span>No Sleep</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </>
                )}
              </div>
            )}

            {/* Today's Summary */}
            {viewMode === 'today' && (
              <>
                {isLoading ? (
                  <Card>
                    <CardContent className="p-6 text-center">
                      <p className="text-gray-600">Loading today's care log...</p>
                    </CardContent>
                  </Card>
                ) : !todayLog ? null : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Morning Routine */}
                <Card>
                  <CardHeader>
                    <h3 className="font-semibold">🌅 Morning Routine</h3>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Wake Time:</span>
                        <span className="font-medium">{todayLog.wakeTime || 'Not recorded'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Mood:</span>
                        <span className="font-medium capitalize">{todayLog.mood || 'Not recorded'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Shower:</span>
                        <span className="font-medium">{todayLog.showerTime || 'Not recorded'}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Sprint 2 Day 4: Medications with Adherence */}
                <Card data-testid="medication-card">
                  <CardHeader>
                    <h3 className="font-semibold">💊 Medications</h3>
                  </CardHeader>
                  <CardContent>
                    {/* Adherence Summary */}
                    {todayLog.medicationAdherence && todayLog.medicationAdherence.total > 0 && (
                      <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-700">Adherence</span>
                          <span className={`text-2xl font-bold ${
                            todayLog.medicationAdherence.percentage === 100 ? 'text-green-600' :
                            todayLog.medicationAdherence.percentage >= 80 ? 'text-yellow-600' :
                            'text-red-600'
                          }`}>
                            {todayLog.medicationAdherence.percentage}%
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-gray-600">
                          <span>✅ Given: {todayLog.medicationAdherence.given}</span>
                          {todayLog.medicationAdherence.missed > 0 && (
                            <span>❌ Missed: {todayLog.medicationAdherence.missed}</span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Medication List */}
                    {todayLog.medications && todayLog.medications.length > 0 ? (
                      <div className="space-y-2">
                        {todayLog.medications.map((med: MedicationEntry, idx: number) => (
                          <div key={idx} className="border-b pb-2 last:border-b-0">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-gray-700 font-medium">{med.name}</span>
                              {med.given ? (
                                <span className="text-success">✅ {med.time}</span>
                              ) : (
                                <span className="text-gray-400">⏺ Not given</span>
                              )}
                            </div>
                            {med.purpose && (
                              <p className="text-xs text-gray-600 mt-1">Purpose: {med.purpose}</p>
                            )}
                            {med.notes && (
                              <p className="text-xs text-orange-600 mt-1 italic">Note: {med.notes}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No medications recorded</p>
                    )}
                  </CardContent>
                </Card>

                {/* Vitals */}
                <Card>
                  <CardHeader>
                    <h3 className="font-semibold">❤️ Vital Signs</h3>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Blood Pressure:</span>
                        <span className="font-medium">{todayLog.bloodPressure || 'Not recorded'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Pulse:</span>
                        <span className="font-medium">{todayLog.pulseRate ? `${todayLog.pulseRate} bpm` : 'Not recorded'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">O₂ Level:</span>
                        <span className="font-medium">{todayLog.oxygenLevel ? `${todayLog.oxygenLevel}%` : 'Not recorded'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Blood Sugar:</span>
                        <span className="font-medium">{todayLog.bloodSugar ? `${todayLog.bloodSugar} mmol/L` : 'Not recorded'}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Meals */}
                <Card>
                  <CardHeader>
                    <h3 className="font-semibold">🍽️ Meals</h3>
                  </CardHeader>
                  <CardContent>
                    {todayLog.meals?.breakfast ? (
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Breakfast:</span>
                          <span className="font-medium">{todayLog.meals.breakfast.time}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Appetite:</span>
                          <span className="font-medium">{todayLog.meals.breakfast.appetite}/5</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Amount Eaten:</span>
                          <span className="font-medium">{todayLog.meals.breakfast.amountEaten}/5</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No meal data recorded</p>
                    )}
                  </CardContent>
                </Card>

                {/* Sprint 2 Day 2: Fluid Intake Summary Card */}
                <Card data-testid="fluid-intake-card"
                  className={todayLog.totalFluidIntake && todayLog.totalFluidIntake < 1000 ? 'border-2 border-yellow-300' : ''}>
                  <CardHeader>
                    <h3 className="font-semibold">💧 Fluid Intake</h3>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-baseline justify-between">
                        <span className="text-gray-600 text-sm">Today's total:</span>
                        <span
                          data-testid="fluid-intake-total"
                          className="text-3xl font-bold text-gray-900"
                        >
                          {todayLog.totalFluidIntake || 0} ml
                        </span>
                      </div>

                      {/* Status indicator */}
                      {todayLog.totalFluidIntake !== null && todayLog.totalFluidIntake !== undefined && (
                        <div className={`text-xs p-2 rounded ${
                          todayLog.totalFluidIntake < 1000
                            ? 'bg-yellow-50 text-yellow-800'
                            : 'bg-green-50 text-green-800'
                        }`}>
                          {todayLog.totalFluidIntake < 1000 ? (
                            <span>⚠️ Below recommended (1500-2000ml/day)</span>
                          ) : (
                            <span>✅ Adequate hydration</span>
                          )}
                        </div>
                      )}

                      {/* Expandable details */}
                      {todayLog.fluids && todayLog.fluids.length > 0 && (
                        <div>
                          <button
                            data-testid="fluid-details-toggle"
                            onClick={() => setShowFluidDetails(!showFluidDetails)}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                          >
                            {showFluidDetails ? '▼ Hide Details' : '▶ Show Details'}
                          </button>

                          {showFluidDetails && (
                            <div className="mt-3 space-y-2">
                              {todayLog.fluids.map((fluid: FluidEntry, idx: number) => (
                                <div
                                  key={idx}
                                  data-testid={`fluid-entry-${idx}`}
                                  className="flex justify-between items-center text-xs border-b pb-2"
                                >
                                  <div className="flex-1">
                                    <span className="font-medium text-gray-900">{fluid.name}</span>
                                    {fluid.swallowingIssues && fluid.swallowingIssues.length > 0 && (
                                      <span className="ml-2 text-red-600">⚠️</span>
                                    )}
                                  </div>
                                  <span className="text-gray-600 mx-2">{fluid.time}</span>
                                  <span className="font-bold text-gray-900">{fluid.amountMl} ml</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {(!todayLog.fluids || todayLog.fluids.length === 0) && (
                        <p className="text-sm text-gray-500">No fluid intake recorded</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Sprint 2 Day 3: Sleep Tracking Summary Card */}
                {(todayLog.afternoonRest || todayLog.nightSleep) && (
                  <Card data-testid="sleep-card">
                    <CardHeader>
                      <h3 className="font-semibold">😴 Rest & Sleep</h3>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {/* Afternoon Rest */}
                        {todayLog.afternoonRest && (
                          <div className="border-b pb-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium text-gray-700">Afternoon Rest</span>
                              <span className={`text-xs px-2 py-1 rounded ${
                                todayLog.afternoonRest.quality === 'deep' ? 'bg-green-100 text-green-800' :
                                todayLog.afternoonRest.quality === 'light' ? 'bg-blue-100 text-blue-800' :
                                todayLog.afternoonRest.quality === 'restless' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {todayLog.afternoonRest.quality === 'deep' ? '💤 Deep Sleep' :
                                 todayLog.afternoonRest.quality === 'light' ? '😌 Light Sleep' :
                                 todayLog.afternoonRest.quality === 'restless' ? '😟 Restless' :
                                 '😔 No Sleep'}
                              </span>
                            </div>
                            <div className="text-xs text-gray-600 flex items-center gap-2">
                              <span>{todayLog.afternoonRest.startTime} - {todayLog.afternoonRest.endTime}</span>
                              {todayLog.afternoonRest.notes && (
                                <span className="text-blue-600">ℹ️</span>
                              )}
                            </div>
                            {todayLog.afternoonRest.notes && showSleepDetails && (
                              <p className="text-xs text-gray-600 mt-2 italic">{todayLog.afternoonRest.notes}</p>
                            )}
                          </div>
                        )}

                        {/* Night Sleep */}
                        {todayLog.nightSleep && (
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium text-gray-700">Night Sleep</span>
                              <span className={`text-xs px-2 py-1 rounded ${
                                todayLog.nightSleep.quality === 'deep' ? 'bg-green-100 text-green-800' :
                                todayLog.nightSleep.quality === 'light' ? 'bg-blue-100 text-blue-800' :
                                todayLog.nightSleep.quality === 'restless' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {todayLog.nightSleep.quality === 'deep' ? '💤 Deep Sleep' :
                                 todayLog.nightSleep.quality === 'light' ? '😌 Light Sleep' :
                                 todayLog.nightSleep.quality === 'restless' ? '😟 Restless' :
                                 '😔 No Sleep'}
                              </span>
                            </div>
                            <div className="text-xs text-gray-600 space-y-1">
                              <div>Bedtime: {todayLog.nightSleep.bedtime}</div>
                              {todayLog.nightSleep.wakings > 0 && (
                                <div className="text-yellow-700">
                                  ⚠️ Woke {todayLog.nightSleep.wakings} {todayLog.nightSleep.wakings === 1 ? 'time' : 'times'}
                                </div>
                              )}
                            </div>

                            {/* Expandable details */}
                            {(todayLog.nightSleep.wakingReasons?.length > 0 || todayLog.nightSleep.behaviors?.length > 0 || todayLog.nightSleep.notes) && (
                              <div className="mt-2">
                                <button
                                  data-testid="sleep-details-toggle"
                                  onClick={() => setShowSleepDetails(!showSleepDetails)}
                                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                                >
                                  {showSleepDetails ? '▼ Hide Details' : '▶ Show Details'}
                                </button>

                                {showSleepDetails && (
                                  <div className="mt-3 space-y-2 text-xs">
                                    {todayLog.nightSleep.wakingReasons && todayLog.nightSleep.wakingReasons.length > 0 && (
                                      <div>
                                        <span className="font-medium">Waking reasons:</span>
                                        <div className="flex flex-wrap gap-1 mt-1">
                                          {todayLog.nightSleep.wakingReasons.map((reason: string, idx: number) => (
                                            <span key={idx} className="bg-yellow-50 text-yellow-800 px-2 py-1 rounded">
                                              {reason.charAt(0).toUpperCase() + reason.slice(1)}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {todayLog.nightSleep.behaviors && todayLog.nightSleep.behaviors.length > 0 && (
                                      <div>
                                        <span className="font-medium">Behaviors:</span>
                                        <div className="flex flex-wrap gap-1 mt-1">
                                          {todayLog.nightSleep.behaviors.map((behavior: string, idx: number) => (
                                            <span key={idx} className="bg-gray-100 text-gray-700 px-2 py-1 rounded">
                                              {behavior.charAt(0).toUpperCase() + behavior.slice(1)}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {todayLog.nightSleep.notes && (
                                      <p className="text-gray-600 italic">{todayLog.nightSleep.notes}</p>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Sprint 2 Day 5: Complete Toileting & Hygiene */}
                {(todayLog.bowelMovements || todayLog.urination) && (
                  <Card data-testid="toileting-card">
                    <CardHeader>
                      <h3 className="font-semibold">🚽 Toileting & Hygiene</h3>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {/* Bowel Movements */}
                        {todayLog.bowelMovements && (
                          <div className="border-b pb-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium text-gray-700">💩 Bowel Movements</span>
                              <span className="text-sm font-semibold">{todayLog.bowelMovements.frequency} times</span>
                            </div>
                            <div className="space-y-1 text-xs text-gray-600">
                              {todayLog.bowelMovements.timesUsedToilet !== undefined && (
                                <div className="flex justify-between">
                                  <span>Used toilet:</span>
                                  <span className="font-medium">{todayLog.bowelMovements.timesUsedToilet}</span>
                                </div>
                              )}
                              {todayLog.bowelMovements.diaperChanges !== undefined && (
                                <div className="flex justify-between">
                                  <span>Diaper changes:</span>
                                  <span className="font-medium">{todayLog.bowelMovements.diaperChanges}</span>
                                </div>
                              )}
                              {todayLog.bowelMovements.diaperStatus && (
                                <div className="flex justify-between">
                                  <span>Diaper status:</span>
                                  <span className={`font-medium px-2 py-0.5 rounded ${
                                    todayLog.bowelMovements.diaperStatus === 'dry' ? 'bg-green-100 text-green-800' :
                                    todayLog.bowelMovements.diaperStatus === 'wet' ? 'bg-blue-100 text-blue-800' :
                                    'bg-yellow-100 text-yellow-800'
                                  }`}>
                                    {todayLog.bowelMovements.diaperStatus === 'dry' ? '✨ Dry' :
                                     todayLog.bowelMovements.diaperStatus === 'wet' ? '💧 Wet' :
                                     '💩 Soiled'}
                                  </span>
                                </div>
                              )}
                              {todayLog.bowelMovements.consistency && (
                                <div className="flex justify-between">
                                  <span>Consistency:</span>
                                  <span className={`font-medium px-2 py-0.5 rounded ${
                                    todayLog.bowelMovements.consistency === 'normal' ? 'bg-green-100 text-green-800' :
                                    todayLog.bowelMovements.consistency === 'diarrhea' ? 'bg-red-100 text-red-800' :
                                    'bg-yellow-100 text-yellow-800'
                                  }`}>
                                    {todayLog.bowelMovements.consistency.charAt(0).toUpperCase() + todayLog.bowelMovements.consistency.slice(1)}
                                    {todayLog.bowelMovements.consistency === 'diarrhea' && ' 🚨'}
                                  </span>
                                </div>
                              )}
                              {todayLog.bowelMovements.accidents && todayLog.bowelMovements.accidents !== 'none' && (
                                <div className="flex justify-between">
                                  <span>Accidents:</span>
                                  <span className={`font-medium px-2 py-0.5 rounded ${
                                    todayLog.bowelMovements.accidents === 'minor' ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-red-100 text-red-800'
                                  }`}>
                                    {todayLog.bowelMovements.accidents.charAt(0).toUpperCase() + todayLog.bowelMovements.accidents.slice(1)}
                                  </span>
                                </div>
                              )}
                              {todayLog.bowelMovements.assistance && todayLog.bowelMovements.assistance !== 'none' && (
                                <div className="flex justify-between">
                                  <span>Assistance:</span>
                                  <span className="font-medium">{todayLog.bowelMovements.assistance.charAt(0).toUpperCase() + todayLog.bowelMovements.assistance.slice(1)}</span>
                                </div>
                              )}
                              {todayLog.bowelMovements.pain && todayLog.bowelMovements.pain !== 'no_pain' && (
                                <div className="flex justify-between">
                                  <span>Pain:</span>
                                  <span className={`font-medium px-2 py-0.5 rounded ${
                                    todayLog.bowelMovements.pain === 'some_pain' ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-red-100 text-red-800'
                                  }`}>
                                    {todayLog.bowelMovements.pain === 'some_pain' ? '😣 Some Pain' : '😫 Very Painful'}
                                  </span>
                                </div>
                              )}
                              {todayLog.bowelMovements.concerns && (
                                <div className="mt-2 p-2 bg-gray-50 rounded">
                                  <div className="font-medium text-gray-700 mb-1">Concerns:</div>
                                  <p className="text-gray-600 italic">{todayLog.bowelMovements.concerns}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Urination */}
                        {todayLog.urination && (
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium text-gray-700">💧 Urination</span>
                              <span className="text-sm font-semibold">{todayLog.urination.frequency} times</span>
                            </div>
                            <div className="space-y-1 text-xs text-gray-600">
                              {todayLog.urination.timesUsedToilet !== undefined && (
                                <div className="flex justify-between">
                                  <span>Used toilet:</span>
                                  <span className="font-medium">{todayLog.urination.timesUsedToilet}</span>
                                </div>
                              )}
                              {todayLog.urination.diaperChanges !== undefined && (
                                <div className="flex justify-between">
                                  <span>Diaper changes:</span>
                                  <span className="font-medium">{todayLog.urination.diaperChanges}</span>
                                </div>
                              )}
                              {todayLog.urination.diaperStatus && (
                                <div className="flex justify-between">
                                  <span>Diaper status:</span>
                                  <span className={`font-medium px-2 py-0.5 rounded ${
                                    todayLog.urination.diaperStatus === 'dry' ? 'bg-green-100 text-green-800' :
                                    todayLog.urination.diaperStatus === 'wet' ? 'bg-blue-100 text-blue-800' :
                                    'bg-yellow-100 text-yellow-800'
                                  }`}>
                                    {todayLog.urination.diaperStatus === 'dry' ? '✨ Dry' :
                                     todayLog.urination.diaperStatus === 'wet' ? '💧 Wet' :
                                     '💩 Soiled'}
                                  </span>
                                </div>
                              )}
                              {todayLog.urination.urineColor && (
                                <div className="flex justify-between">
                                  <span>Urine color:</span>
                                  <span className={`font-medium px-2 py-0.5 rounded ${
                                    todayLog.urination.urineColor === 'light_clear' ? 'bg-green-100 text-green-800' :
                                    todayLog.urination.urineColor === 'yellow' ? 'bg-green-100 text-green-800' :
                                    todayLog.urination.urineColor === 'dark_yellow' ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-red-100 text-red-800'
                                  }`}>
                                    {todayLog.urination.urineColor.split('_').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                                    {(todayLog.urination.urineColor === 'brown' || todayLog.urination.urineColor === 'dark') && ' 🚨'}
                                  </span>
                                </div>
                              )}
                              {todayLog.urination.accidents && todayLog.urination.accidents !== 'none' && (
                                <div className="flex justify-between">
                                  <span>Accidents:</span>
                                  <span className={`font-medium px-2 py-0.5 rounded ${
                                    todayLog.urination.accidents === 'minor' ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-red-100 text-red-800'
                                  }`}>
                                    {todayLog.urination.accidents.charAt(0).toUpperCase() + todayLog.urination.accidents.slice(1)}
                                  </span>
                                </div>
                              )}
                              {todayLog.urination.assistance && todayLog.urination.assistance !== 'none' && (
                                <div className="flex justify-between">
                                  <span>Assistance:</span>
                                  <span className="font-medium">{todayLog.urination.assistance.charAt(0).toUpperCase() + todayLog.urination.assistance.slice(1)}</span>
                                </div>
                              )}
                              {todayLog.urination.pain && todayLog.urination.pain !== 'no_pain' && (
                                <div className="flex justify-between">
                                  <span>Pain:</span>
                                  <span className={`font-medium px-2 py-0.5 rounded ${
                                    todayLog.urination.pain === 'some_pain' ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-red-100 text-red-800'
                                  }`}>
                                    {todayLog.urination.pain === 'some_pain' ? '😣 Some Pain' : '😫 Very Painful'}
                                  </span>
                                </div>
                              )}
                              {todayLog.urination.concerns && (
                                <div className="mt-2 p-2 bg-gray-50 rounded">
                                  <div className="font-medium text-gray-700 mb-1">Concerns:</div>
                                  <p className="text-gray-600 italic">{todayLog.urination.concerns}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Sprint 3 Day 1: Spiritual & Emotional Well-Being */}
                {todayLog.spiritualEmotional && (
                  <Card data-testid="spiritual-emotional-card">
                    <CardHeader>
                      <h3 className="font-semibold">🙏 Spiritual & Emotional Well-Being</h3>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3 text-sm">
                        {/* Prayer Time */}
                        {todayLog.spiritualEmotional.prayerTime && (
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600">Prayer Time:</span>
                            <span className="font-medium">
                              {todayLog.spiritualEmotional.prayerTime.start} - {todayLog.spiritualEmotional.prayerTime.end}
                            </span>
                          </div>
                        )}

                        {/* Prayer Expression */}
                        {todayLog.spiritualEmotional.prayerExpression && (
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600">Prayer Expression:</span>
                            <span className="font-medium capitalize">
                              {todayLog.spiritualEmotional.prayerExpression.replace(/_/g, ' ')}
                            </span>
                          </div>
                        )}

                        {/* Overall Mood */}
                        {todayLog.spiritualEmotional.overallMood && (
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600">Overall Mood:</span>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{todayLog.spiritualEmotional.overallMood}/5</span>
                              <span className={`px-2 py-0.5 rounded text-xs ${
                                todayLog.spiritualEmotional.overallMood >= 4 ? 'bg-green-100 text-green-800' :
                                todayLog.spiritualEmotional.overallMood >= 3 ? 'bg-blue-100 text-blue-800' :
                                'bg-yellow-100 text-yellow-800'
                              }`}>
                                {todayLog.spiritualEmotional.overallMood >= 4 ? '😊 Happy' :
                                 todayLog.spiritualEmotional.overallMood >= 3 ? '😐 Neutral' :
                                 '😔 Low'}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Communication Scale */}
                        {todayLog.spiritualEmotional.communicationScale && (
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600">Communication:</span>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{todayLog.spiritualEmotional.communicationScale}/5</span>
                              <span className={`px-2 py-0.5 rounded text-xs ${
                                todayLog.spiritualEmotional.communicationScale >= 4 ? 'bg-green-100 text-green-800' :
                                todayLog.spiritualEmotional.communicationScale >= 3 ? 'bg-blue-100 text-blue-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {todayLog.spiritualEmotional.communicationScale >= 4 ? '✅ Clear' :
                                 todayLog.spiritualEmotional.communicationScale >= 3 ? '➡️ Moderate' :
                                 '⚠️ Difficult'}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Social Interaction */}
                        {todayLog.spiritualEmotional.socialInteraction && (
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600">Social Interaction:</span>
                            <span className={`font-medium px-2 py-0.5 rounded capitalize ${
                              todayLog.spiritualEmotional.socialInteraction === 'engaged' ? 'bg-green-100 text-green-800' :
                              todayLog.spiritualEmotional.socialInteraction === 'responsive' ? 'bg-blue-100 text-blue-800' :
                              todayLog.spiritualEmotional.socialInteraction === 'withdrawn' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {todayLog.spiritualEmotional.socialInteraction === 'aggressive_hostile'
                                ? '⚠️ Aggressive/Hostile'
                                : todayLog.spiritualEmotional.socialInteraction}
                            </span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Sprint 3 Day 2: Physical Activity & Exercise */}
                {todayLog.physicalActivity && (
                  <Card data-testid="physical-activity-card">
                    <CardHeader>
                      <h3 className="font-semibold">🏃 Physical Activity & Exercise</h3>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3 text-sm">
                        {/* Exercise Duration */}
                        {todayLog.physicalActivity.exerciseDuration && (
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600">Duration:</span>
                            <span className="font-medium">{todayLog.physicalActivity.exerciseDuration} minutes</span>
                          </div>
                        )}

                        {/* Exercise Type */}
                        {todayLog.physicalActivity.exerciseType && todayLog.physicalActivity.exerciseType.length > 0 && (
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600">Exercise Type:</span>
                            <span className="font-medium text-xs capitalize">
                              {todayLog.physicalActivity.exerciseType.join(', ').replace(/_/g, ' ')}
                            </span>
                          </div>
                        )}

                        {/* Walking Distance */}
                        {todayLog.physicalActivity.walkingDistance && (
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600">Walking:</span>
                            <span className="font-medium">{todayLog.physicalActivity.walkingDistance}</span>
                          </div>
                        )}

                        {/* Assistance Level */}
                        {todayLog.physicalActivity.assistanceLevel && (
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600">Assistance:</span>
                            <span className={`font-medium px-2 py-0.5 rounded capitalize ${
                              todayLog.physicalActivity.assistanceLevel === 'none' ? 'bg-green-100 text-green-800' :
                              todayLog.physicalActivity.assistanceLevel === 'minimal' ? 'bg-blue-100 text-blue-800' :
                              todayLog.physicalActivity.assistanceLevel === 'moderate' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {todayLog.physicalActivity.assistanceLevel}
                            </span>
                          </div>
                        )}

                        {/* Pain During Activity */}
                        {todayLog.physicalActivity.painDuringActivity && (
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600">Pain:</span>
                            <span className={`font-medium px-2 py-0.5 rounded capitalize ${
                              todayLog.physicalActivity.painDuringActivity === 'none' ? 'bg-green-100 text-green-800' :
                              todayLog.physicalActivity.painDuringActivity === 'mild' ? 'bg-yellow-100 text-yellow-800' :
                              todayLog.physicalActivity.painDuringActivity === 'moderate' ? 'bg-orange-100 text-orange-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {todayLog.physicalActivity.painDuringActivity}
                            </span>
                          </div>
                        )}

                        {/* Energy After Activity */}
                        {todayLog.physicalActivity.energyAfterActivity && (
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600">Energy After:</span>
                            <span className={`font-medium px-2 py-0.5 rounded capitalize ${
                              todayLog.physicalActivity.energyAfterActivity === 'energized' ? 'bg-green-100 text-green-800' :
                              todayLog.physicalActivity.energyAfterActivity === 'same' ? 'bg-blue-100 text-blue-800' :
                              todayLog.physicalActivity.energyAfterActivity === 'tired' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {todayLog.physicalActivity.energyAfterActivity}
                            </span>
                          </div>
                        )}

                        {/* Participation Willingness */}
                        {todayLog.physicalActivity.participationWillingness && (
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600">Willingness:</span>
                            <span className={`font-medium px-2 py-0.5 rounded capitalize ${
                              todayLog.physicalActivity.participationWillingness === 'enthusiastic' ? 'bg-green-100 text-green-800' :
                              todayLog.physicalActivity.participationWillingness === 'willing' ? 'bg-blue-100 text-blue-800' :
                              todayLog.physicalActivity.participationWillingness === 'reluctant' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {todayLog.physicalActivity.participationWillingness}
                            </span>
                          </div>
                        )}

                        {/* Equipment Used */}
                        {todayLog.physicalActivity.equipmentUsed && todayLog.physicalActivity.equipmentUsed.length > 0 && (
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600">Equipment:</span>
                            <span className="font-medium text-xs capitalize">
                              {todayLog.physicalActivity.equipmentUsed.join(', ')}
                            </span>
                          </div>
                        )}

                        {/* Mobility Notes */}
                        {todayLog.physicalActivity.mobilityNotes && (
                          <div className="mt-3 pt-3 border-t border-gray-200">
                            <span className="text-gray-600 text-xs font-medium">Notes:</span>
                            <p className="text-gray-700 mt-1">{todayLog.physicalActivity.mobilityNotes}</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Sprint 3 Day 4: Detailed Exercise Sessions */}
                {(todayLog.morningExerciseSession || todayLog.afternoonExerciseSession) && (
                  <Card data-testid="exercise-sessions-card">
                    <CardHeader>
                      <h3 className="font-semibold">Exercise Sessions</h3>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {/* Morning Session */}
                        {todayLog.morningExerciseSession && (
                          <div className="bg-gray-50 p-3 rounded">
                            <div className="flex justify-between items-center mb-2">
                              <span className="font-medium text-sm">Morning: {todayLog.morningExerciseSession.startTime} - {todayLog.morningExerciseSession.endTime}</span>
                            </div>
                            {todayLog.morningExerciseSession.exercises && todayLog.morningExerciseSession.exercises.length > 0 && (
                              <div className="space-y-1 text-xs">
                                {todayLog.morningExerciseSession.exercises.map((exercise: ExerciseEntry, idx: number) => (
                                  <div key={idx} className="flex justify-between">
                                    <span>{exercise.type} ({exercise.duration} min)</span>
                                    <span className="text-gray-600">Participation: {exercise.participation}/5</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            {todayLog.morningExerciseSession.notes && (
                              <p className="text-xs text-gray-600 mt-2">{todayLog.morningExerciseSession.notes}</p>
                            )}
                          </div>
                        )}

                        {/* Afternoon Session */}
                        {todayLog.afternoonExerciseSession && (
                          <div className="bg-gray-50 p-3 rounded">
                            <div className="flex justify-between items-center mb-2">
                              <span className="font-medium text-sm">Afternoon: {todayLog.afternoonExerciseSession.startTime} - {todayLog.afternoonExerciseSession.endTime}</span>
                            </div>
                            {todayLog.afternoonExerciseSession.exercises && todayLog.afternoonExerciseSession.exercises.length > 0 && (
                              <div className="space-y-1 text-xs">
                                {todayLog.afternoonExerciseSession.exercises.map((exercise: ExerciseEntry, idx: number) => (
                                  <div key={idx} className="flex justify-between">
                                    <span>{exercise.type} ({exercise.duration} min)</span>
                                    <span className="text-gray-600">Participation: {exercise.participation}/5</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            {todayLog.afternoonExerciseSession.notes && (
                              <p className="text-xs text-gray-600 mt-2">{todayLog.afternoonExerciseSession.notes}</p>
                            )}
                          </div>
                        )}

                        {/* Participation Summary */}
                        {(todayLog.morningExerciseSession || todayLog.afternoonExerciseSession) && (
                          <div className="text-sm">
                            <span className="text-gray-600">Overall Participation: </span>
                            <span className={`font-medium ${
                              (() => {
                                const allExercises = [
                                  ...(todayLog.morningExerciseSession?.exercises || []),
                                  ...(todayLog.afternoonExerciseSession?.exercises || [])
                                ];
                                if (allExercises.length === 0) return '';
                                const avgParticipation = allExercises.reduce((sum: number, ex: ExerciseEntry) => sum + (ex.participation || 0), 0) / allExercises.length;
                                return avgParticipation >= 4 ? 'text-green-600' : avgParticipation >= 3 ? 'text-yellow-600' : 'text-red-600';
                              })()
                            }`}>
                              {(() => {
                                const allExercises = [
                                  ...(todayLog.morningExerciseSession?.exercises || []),
                                  ...(todayLog.afternoonExerciseSession?.exercises || [])
                                ];
                                if (allExercises.length === 0) return 'No exercises';
                                const avgParticipation = allExercises.reduce((sum: number, ex: ExerciseEntry) => sum + (ex.participation || 0), 0) / allExercises.length;
                                return avgParticipation >= 4 ? 'Good' : avgParticipation >= 3 ? 'Fair' : 'Poor';
                              })()}
                            </span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Movement Difficulties Assessment */}
                {todayLog.movementDifficulties && Object.keys(todayLog.movementDifficulties).length > 0 && (
                  <Card data-testid="movement-difficulties-card">
                    <CardHeader>
                      <h3 className="font-semibold">🚶 Movement Difficulties</h3>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        {(Object.entries(todayLog.movementDifficulties) as [string, MovementDifficultyData][]).map(([activity, data]) => (
                          <div key={activity} className="flex justify-between items-center">
                            <span className="text-gray-600 text-xs">
                              {activity.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim()}:
                            </span>
                            <div className="flex items-center gap-2">
                              <span className={`font-medium px-2 py-0.5 rounded text-xs ${
                                data.level === 'canDoAlone' ? 'bg-green-100 text-green-800' :
                                data.level === 'needsSomeHelp' ? 'bg-yellow-100 text-yellow-800' :
                                data.level === 'needsFullHelp' ? 'bg-orange-100 text-orange-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {data.level === 'canDoAlone' ? '✓ Independent' :
                                 data.level === 'needsSomeHelp' ? 'Some Help' :
                                 data.level === 'needsFullHelp' ? 'Full Help' :
                                 '⚠️ Falls/Drops'}
                              </span>
                              {data.notes && (
                                <span className="text-gray-500 text-xs">({data.notes})</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Sprint 3 Day 3: Oral Care & Hygiene */}
                {todayLog.oralCare && (
                  <Card data-testid="oral-care-card">
                    <CardHeader>
                      <h3 className="font-semibold">🦷 Oral Care & Hygiene</h3>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3 text-sm">
                        {/* Teeth Brushed */}
                        {todayLog.oralCare.teethBrushed && (
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600">Teeth Brushed:</span>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {todayLog.oralCare.timesBrushed ? `${todayLog.oralCare.timesBrushed}x` : 'Yes'}
                              </span>
                              <span className="text-green-600">✓</span>
                            </div>
                          </div>
                        )}

                        {/* Dentures Cleaned */}
                        {todayLog.oralCare.denturesCleaned && (
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600">Dentures Cleaned:</span>
                            <span className="font-medium text-green-600">✓ Yes</span>
                          </div>
                        )}

                        {/* Mouth Rinsed */}
                        {todayLog.oralCare.mouthRinsed && (
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600">Mouth Rinsed:</span>
                            <span className="font-medium text-green-600">✓ Yes</span>
                          </div>
                        )}

                        {/* Assistance Level */}
                        {todayLog.oralCare.assistanceLevel && (
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600">Assistance:</span>
                            <span className={`font-medium px-2 py-0.5 rounded capitalize ${
                              todayLog.oralCare.assistanceLevel === 'none' ? 'bg-green-100 text-green-800' :
                              todayLog.oralCare.assistanceLevel === 'minimal' ? 'bg-blue-100 text-blue-800' :
                              todayLog.oralCare.assistanceLevel === 'moderate' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {todayLog.oralCare.assistanceLevel}
                            </span>
                          </div>
                        )}

                        {/* Oral Health Issues */}
                        {todayLog.oralCare.oralHealthIssues && todayLog.oralCare.oralHealthIssues.length > 0 && !todayLog.oralCare.oralHealthIssues.includes('none') && (
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600">Health Issues:</span>
                            <span className="font-medium text-xs text-orange-600 capitalize">
                              {todayLog.oralCare.oralHealthIssues.filter((i: string) => i !== 'none').join(', ').replace(/_/g, ' ')}
                            </span>
                          </div>
                        )}

                        {/* Pain or Bleeding */}
                        {todayLog.oralCare.painOrBleeding && (
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600">Pain/Bleeding:</span>
                            <span className="font-medium px-2 py-0.5 rounded bg-red-100 text-red-800">
                              ⚠️ Yes
                            </span>
                          </div>
                        )}

                        {/* Notes */}
                        {todayLog.oralCare.notes && (
                          <div className="mt-3 pt-3 border-t border-gray-200">
                            <span className="text-gray-600 text-xs font-medium">Notes:</span>
                            <p className="text-gray-700 mt-1">{todayLog.oralCare.notes}</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Sprint 3 Day 3: Caregiver Notes */}
                {todayLog.caregiverNotes && (
                  <Card data-testid="caregiver-notes-card">
                    <CardHeader>
                      <h3 className="font-semibold">📋 Caregiver Daily Summary</h3>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4 text-sm">
                        {/* What Went Well */}
                        {todayLog.caregiverNotes.whatWentWell && (
                          <div>
                            <span className="text-gray-600 font-medium">What Went Well:</span>
                            <p className="text-gray-800 mt-1 bg-green-50 p-2 rounded">{todayLog.caregiverNotes.whatWentWell}</p>
                          </div>
                        )}

                        {/* Challenges Faced */}
                        {todayLog.caregiverNotes.challengesFaced && (
                          <div>
                            <span className="text-gray-600 font-medium">Challenges Faced:</span>
                            <p className="text-gray-800 mt-1 bg-yellow-50 p-2 rounded">{todayLog.caregiverNotes.challengesFaced}</p>
                          </div>
                        )}

                        {/* Recommendations for Tomorrow */}
                        {todayLog.caregiverNotes.recommendationsForTomorrow && (
                          <div>
                            <span className="text-gray-600 font-medium">Recommendations for Tomorrow:</span>
                            <p className="text-gray-800 mt-1 bg-blue-50 p-2 rounded">{todayLog.caregiverNotes.recommendationsForTomorrow}</p>
                          </div>
                        )}

                        {/* Important Info for Family */}
                        {todayLog.caregiverNotes.importantInfoForFamily && (
                          <div>
                            <span className="text-gray-600 font-medium">Important Info for Family:</span>
                            <p className="text-gray-800 mt-1 bg-purple-50 p-2 rounded border-l-4 border-purple-400">{todayLog.caregiverNotes.importantInfoForFamily}</p>
                          </div>
                        )}

                        {/* Caregiver Signature */}
                        {todayLog.caregiverNotes.caregiverSignature && (
                          <div className="pt-3 border-t border-gray-200">
                            <span className="text-gray-600">Signed by:</span>
                            <span className="font-medium ml-2">{todayLog.caregiverNotes.caregiverSignature}</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Sprint 3 Day 4: Activities & Social Interaction */}
                {todayLog.activities && (
                  <Card data-testid="activities-card">
                    <CardHeader>
                      <h3 className="font-semibold">📱 Activities & Social</h3>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3 text-sm">
                        {/* Phone Activities */}
                        {todayLog.activities.phoneActivities && todayLog.activities.phoneActivities.length > 0 && (
                          <div>
                            <span className="text-gray-600 font-medium">Phone Activities:</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {todayLog.activities.phoneActivities.map((activity: string) => (
                                <span key={activity} className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs">
                                  {activity === 'youtube' ? '📺 YouTube' :
                                   activity === 'texting' ? '💬 Texting' :
                                   activity === 'calls' ? '📞 Calls' : '❌ None'}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Engagement Level */}
                        {todayLog.activities.engagementLevel && (
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600 font-medium">Engagement Level:</span>
                            <div className="flex items-center gap-1">
                              {[1, 2, 3, 4, 5].map((level) => (
                                <span
                                  key={level}
                                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                                    level <= todayLog.activities.engagementLevel
                                      ? 'bg-primary-500 text-white'
                                      : 'bg-gray-200'
                                  }`}
                                >
                                  {level}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Other Activities */}
                        {todayLog.activities.otherActivities && todayLog.activities.otherActivities.length > 0 && (
                          <div>
                            <span className="text-gray-600 font-medium">Other Activities:</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {todayLog.activities.otherActivities.map((activity: string) => (
                                <span key={activity} className="px-2 py-1 bg-green-50 text-green-700 rounded text-xs">
                                  {activity === 'conversation' ? '💬 Conversation' :
                                   activity === 'prayer' ? '🙏 Prayer' :
                                   activity === 'reading' ? '📖 Reading' :
                                   activity === 'watching_tv' ? '📺 TV' :
                                   activity === 'listening_music' ? '🎵 Music' :
                                   activity === 'games' ? '🎮 Games' : '❌ None'}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Relaxation Periods */}
                        {todayLog.activities.relaxationPeriods && todayLog.activities.relaxationPeriods.length > 0 && (
                          <div>
                            <span className="text-gray-600 font-medium">Relaxation Periods:</span>
                            <div className="space-y-2 mt-1">
                              {todayLog.activities.relaxationPeriods.map((period: { startTime: string; endTime: string; activity: string; mood: string }, index: number) => (
                                <div key={index} className="bg-purple-50 p-2 rounded text-xs">
                                  <div className="flex justify-between">
                                    <span>{period.startTime} - {period.endTime}</span>
                                    <span className="capitalize">{period.activity.replace(/_/g, ' ')}</span>
                                  </div>
                                  <div className="text-gray-500 mt-1">
                                    Mood: {period.mood === 'happy' ? '😊' : period.mood === 'calm' ? '😌' : period.mood === 'restless' ? '😟' : period.mood === 'bored' ? '😐' : '🤗'} {period.mood}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Sprint 1: Fall Risk Assessment */}
                {(todayLog.balanceIssues || todayLog.nearFalls || todayLog.actualFalls || todayLog.freezingEpisodes || todayLog.totalUnaccompaniedMinutes > 0) && (
                  <Card className={todayLog.actualFalls === 'major' ? 'border-2 border-red-400' : ''}>
                    <CardHeader>
                      <h3 className="font-semibold">⚠️ Fall Risk & Movement</h3>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        {todayLog.balanceIssues && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Balance:</span>
                            <span className={`font-medium ${todayLog.balanceIssues >= 4 ? 'text-orange-600' : ''}`}>
                              Level {todayLog.balanceIssues}/5
                            </span>
                          </div>
                        )}
                        {todayLog.nearFalls && todayLog.nearFalls !== 'none' && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Near Falls:</span>
                            <span className="font-medium text-yellow-600 capitalize">
                              {todayLog.nearFalls.replace(/_/g, ' ')}
                            </span>
                          </div>
                        )}
                        {todayLog.actualFalls && todayLog.actualFalls !== 'none' && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Actual Falls:</span>
                            <span className={`font-medium ${todayLog.actualFalls === 'major' ? 'text-red-600' : 'text-orange-600'}`}>
                              {todayLog.actualFalls === 'major' ? '🚨 MAJOR' : 'Minor'}
                            </span>
                          </div>
                        )}
                        {todayLog.walkingPattern && todayLog.walkingPattern.length > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Walking:</span>
                            <span className="font-medium text-xs">
                              {todayLog.walkingPattern.join(', ').replace(/_/g, ' ')}
                            </span>
                          </div>
                        )}
                        {todayLog.freezingEpisodes && todayLog.freezingEpisodes !== 'none' && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Freezing:</span>
                            <span className={`font-medium capitalize ${todayLog.freezingEpisodes === 'severe' ? 'text-red-600' : 'text-yellow-600'}`}>
                              {todayLog.freezingEpisodes}
                            </span>
                          </div>
                        )}
                        {todayLog.totalUnaccompaniedMinutes > 0 && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Time Alone:</span>
                            <span className={`font-medium ${todayLog.totalUnaccompaniedMinutes > 60 ? 'text-yellow-600' : 'text-gray-900'}`}>
                              {todayLog.totalUnaccompaniedMinutes} min
                              {todayLog.totalUnaccompaniedMinutes > 60 && ' ⚠️'}
                            </span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* Notes & Alerts */}
            {todayLog?.emergencyFlag && (
              <Card className="border-2 border-error">
                <CardHeader className="bg-error/10">
                  <h3 className="font-semibold text-error">⚠️ Emergency Alert</h3>
                </CardHeader>
                <CardContent className="pt-4">
                  <p className="text-gray-900">{todayLog.emergencyNote}</p>
                </CardContent>
              </Card>
            )}

            {/* Sprint 1: Fall Risk Alerts */}
            {todayLog?.actualFalls === 'major' && (
              <Card className="border-2 border-red-500">
                <CardHeader className="bg-red-50">
                  <h3 className="font-semibold text-red-800 flex items-center gap-2">
                    🚨 MAJOR FALL REPORTED
                  </h3>
                </CardHeader>
                <CardContent className="pt-4 space-y-2">
                  {todayLog.walkingPattern && todayLog.walkingPattern.length > 0 && (
                    <p className="text-sm text-red-700">
                      <strong>Walking pattern:</strong> {todayLog.walkingPattern.join(', ')}
                    </p>
                  )}
                  {todayLog.balanceIssues && (
                    <p className="text-sm text-red-700">
                      <strong>Balance level:</strong> {todayLog.balanceIssues}/5
                    </p>
                  )}
                  {todayLog.createdAt && (
                    <p className="text-xs text-red-600 mt-2">
                      Reported: {format(new Date(todayLog.createdAt), 'h:mm a')}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Balance Issues Warning */}
            {todayLog?.balanceIssues >= 4 && todayLog?.actualFalls !== 'major' && (
              <Card className="border-2 border-orange-300">
                <CardHeader className="bg-orange-50">
                  <h3 className="font-semibold text-orange-800">⚠️ Balance Concern</h3>
                </CardHeader>
                <CardContent className="pt-4">
                  <p className="text-sm text-orange-800">
                    Severe balance problems reported (Level {todayLog.balanceIssues}/5)
                  </p>
                  {todayLog.walkingPattern && todayLog.walkingPattern.length > 0 && (
                    <p className="text-sm text-orange-700 mt-2">
                      <strong>Walking pattern:</strong> {todayLog.walkingPattern.join(', ')}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Near Falls Warning */}
            {todayLog?.nearFalls === 'multiple' && (
              <Card className="border border-yellow-400">
                <CardHeader className="bg-yellow-50">
                  <h3 className="font-semibold text-yellow-800">⚠️ Multiple Near Falls</h3>
                </CardHeader>
                <CardContent className="pt-4">
                  <p className="text-sm text-yellow-800">
                    Multiple near falls reported today. Increased monitoring recommended.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Sprint 1 Day 2: Unaccompanied Time Warning */}
            {todayLog?.totalUnaccompaniedMinutes > 60 && (
              <Card className="border-2 border-yellow-300">
                <CardHeader className="bg-yellow-50">
                  <h3 className="font-semibold text-yellow-800">⏱️ Extended Unaccompanied Time</h3>
                </CardHeader>
                <CardContent className="pt-4">
                  <p className="text-sm text-yellow-800 font-medium">
                    {todayLog.totalUnaccompaniedMinutes} minutes unaccompanied today
                    ({Math.floor(todayLog.totalUnaccompaniedMinutes / 60)} hour{todayLog.totalUnaccompaniedMinutes >= 120 ? 's' : ''} {todayLog.totalUnaccompaniedMinutes % 60} min)
                  </p>
                  {todayLog.unaccompaniedIncidents && (
                    <div className="mt-3 p-3 bg-white border border-yellow-200 rounded">
                      <p className="text-xs font-semibold text-gray-700 mb-1">Incidents reported:</p>
                      <p className="text-sm text-gray-800">{todayLog.unaccompaniedIncidents}</p>
                    </div>
                  )}
                  {todayLog.unaccompaniedTime && todayLog.unaccompaniedTime.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <p className="text-xs font-semibold text-gray-700">Time periods:</p>
                      {todayLog.unaccompaniedTime.map((period: UnaccompaniedPeriod, index: number) => (
                        <div key={index} className="text-xs text-gray-700 bg-white p-2 rounded border border-yellow-200">
                          <span className="font-medium">{period.startTime} - {period.endTime}</span>
                          {period.reason && <span className="ml-2">({period.reason})</span>}
                          {period.replacementPerson && (
                            <span className="block text-gray-600 mt-1">
                              Replacement: {period.replacementPerson}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Sprint 1 Day 3: Safety Status */}
            {todayLog?.safetyChecks && (
              <Card className={
                (Object.values(todayLog.safetyChecks) as SafetyCheckItem[]).filter((c) => c.checked).length === 6
                  ? 'border-2 border-green-300'
                  : 'border border-yellow-400'
              }>
                <CardHeader className={`rounded-t-lg ${
                  (Object.values(todayLog.safetyChecks) as SafetyCheckItem[]).filter((c) => c.checked).length === 6
                    ? 'bg-green-50'
                    : 'bg-yellow-50'
                }`}>
                  <h3 className={`font-semibold ${
                    (Object.values(todayLog.safetyChecks) as SafetyCheckItem[]).filter((c) => c.checked).length === 6
                      ? 'text-green-800'
                      : 'text-yellow-800'
                  }`}>
                    🔒 Safety Status
                  </h3>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="mb-3">
                    <p className="text-sm font-medium text-gray-700">
                      Safety Checks: {(Object.values(todayLog.safetyChecks) as SafetyCheckItem[]).filter((c) => c.checked).length}/6 Complete
                      ({Math.round(((Object.values(todayLog.safetyChecks) as SafetyCheckItem[]).filter((c) => c.checked).length / 6) * 100)}%)
                    </p>
                    {(Object.values(todayLog.safetyChecks) as SafetyCheckItem[]).filter((c) => c.checked).length < 6 && (
                      <p className="text-xs text-yellow-700 mt-1">
                        ⚠️ Not all safety checks completed today
                      </p>
                    )}
                  </div>

                  {/* List completed checks */}
                  <div className="space-y-2">
                    {(Object.entries(todayLog.safetyChecks) as [string, SafetyCheckItem][]).map(([key, value]) => {
                      if (!value.checked) return null;

                      const labels: Record<string, string> = {
                        tripHazards: 'Trip Hazards',
                        cables: 'Cables & Cords',
                        sandals: 'Proper Footwear',
                        slipHazards: 'Slip Hazards',
                        mobilityAids: 'Mobility Aids',
                        emergencyEquipment: 'Emergency Equipment',
                      };

                      return (
                        <div key={key} className="text-xs bg-white p-2 rounded border">
                          <span className="font-medium text-gray-900">✓ {labels[key]}</span>
                          {value.action && (
                            <span className="text-gray-600 ml-2">- {value.action}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Sprint 1 Day 3: Emergency Preparedness */}
            {todayLog?.emergencyPrep && (
              <Card>
                <CardHeader>
                  <h3 className="font-semibold">🚑 Emergency Preparedness</h3>
                </CardHeader>
                <CardContent>
                  <p className="text-sm font-medium text-gray-700 mb-3">
                    Equipment Available: {Object.values(todayLog.emergencyPrep).filter((v) => v).length}/7
                    ({Math.round((Object.values(todayLog.emergencyPrep).filter((v) => v).length / 7) * 100)}%)
                  </p>

                  <div className="grid grid-cols-2 gap-2">
                    {(Object.entries(todayLog.emergencyPrep) as [string, boolean][]).map(([key, available]) => {
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
                        <div
                          key={key}
                          className={`text-xs p-2 rounded border ${
                            available
                              ? 'bg-green-50 border-green-200 text-green-800'
                              : 'bg-gray-50 border-gray-200 text-gray-500'
                          }`}
                        >
                          <span>{available ? '✓' : '○'}</span> {labels[key]}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Room Maintenance */}
            {todayLog?.roomMaintenance && (todayLog.roomMaintenance.cleaningStatus || todayLog.roomMaintenance.roomComfort) && (
              <Card>
                <CardHeader>
                  <h3 className="font-semibold">🏠 Room Maintenance</h3>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    {todayLog.roomMaintenance.cleaningStatus && (
                      <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                        <span className="text-gray-700">Cleaning Status:</span>
                        <span className="font-medium text-gray-900">
                          {todayLog.roomMaintenance.cleaningStatus === 'completed_by_maid' && '✅ Completed by maid'}
                          {todayLog.roomMaintenance.cleaningStatus === 'caregiver_assisted' && '👤 Caregiver assisted'}
                          {todayLog.roomMaintenance.cleaningStatus === 'not_done' && '⏳ Not done'}
                        </span>
                      </div>
                    )}
                    {todayLog.roomMaintenance.roomComfort && (
                      <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
                        <span className="text-gray-700">Room Comfort:</span>
                        <span className="font-medium text-gray-900">
                          {todayLog.roomMaintenance.roomComfort === 'good_temperature' && '🌡️ Good temperature'}
                          {todayLog.roomMaintenance.roomComfort === 'too_hot' && '🔥 Too hot'}
                          {todayLog.roomMaintenance.roomComfort === 'too_cold' && '❄️ Too cold'}
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Personal Items Check */}
            {todayLog?.personalItemsCheck && (Object.values(todayLog.personalItemsCheck) as PersonalItemCheckItem[]).some((item) => item.checked) && (
              <Card>
                <CardHeader>
                  <h3 className="font-semibold">👓 Personal Items Check</h3>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {todayLog.personalItemsCheck.spectaclesCleaned?.checked && (
                      <div className="text-xs p-2 bg-purple-50 border border-purple-200 rounded">
                        <span className="font-medium text-purple-900">✓ Spectacles:</span>
                        <span className="text-purple-700 ml-2">
                          {todayLog.personalItemsCheck.spectaclesCleaned.status === 'clean' ? 'Clean' : 'Need cleaning'}
                        </span>
                      </div>
                    )}
                    {todayLog.personalItemsCheck.jewelryAccountedFor?.checked && (
                      <div className="text-xs p-2 bg-purple-50 border border-purple-200 rounded">
                        <span className="font-medium text-purple-900">✓ Jewelry:</span>
                        <span className="text-purple-700 ml-2">
                          {todayLog.personalItemsCheck.jewelryAccountedFor.status === 'all_present'
                            ? 'All present'
                            : `Missing item${todayLog.personalItemsCheck.jewelryAccountedFor.notes ? `: ${todayLog.personalItemsCheck.jewelryAccountedFor.notes}` : ''}`}
                        </span>
                      </div>
                    )}
                    {todayLog.personalItemsCheck.handbagOrganized?.checked && (
                      <div className="text-xs p-2 bg-purple-50 border border-purple-200 rounded">
                        <span className="font-medium text-purple-900">✓ Handbag:</span>
                        <span className="text-purple-700 ml-2">
                          {todayLog.personalItemsCheck.handbagOrganized.status === 'organized' ? 'Organized' : 'Need organizing'}
                        </span>
                      </div>
                    )}
                    <p className="text-xs text-gray-600 mt-2">
                      {(Object.values(todayLog.personalItemsCheck) as PersonalItemCheckItem[]).filter((item) => item.checked).length}/3 items checked
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Hospital Bag Status */}
            {todayLog?.hospitalBagStatus && todayLog.hospitalBagStatus.lastChecked && (
              <Card className={
                todayLog.hospitalBagStatus.bagReady
                  ? 'border-2 border-green-300'
                  : 'border border-yellow-400'
              }>
                <CardHeader className={`rounded-t-lg ${
                  todayLog.hospitalBagStatus.bagReady
                    ? 'bg-green-50'
                    : 'bg-yellow-50'
                }`}>
                  <h3 className={`font-semibold ${
                    todayLog.hospitalBagStatus.bagReady
                      ? 'text-green-800'
                      : 'text-yellow-800'
                  }`}>
                    🏥 Hospital Emergency Bag
                  </h3>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="space-y-3">
                    <div className={`text-sm p-3 rounded-lg ${
                      todayLog.hospitalBagStatus.bagReady
                        ? 'bg-green-100 text-green-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {todayLog.hospitalBagStatus.bagReady
                        ? '✅ Bag is fully packed and ready'
                        : '⚠️ Bag not ready - attention needed'}
                    </div>
                    {todayLog.hospitalBagStatus.location && (
                      <div className="text-xs p-2 bg-gray-50 rounded border">
                        <span className="font-medium text-gray-700">📍 Location:</span>
                        <span className="text-gray-600 ml-2">{todayLog.hospitalBagStatus.location}</span>
                      </div>
                    )}
                    {todayLog.hospitalBagStatus.notes && (
                      <div className="text-xs p-2 bg-blue-50 rounded border border-blue-200">
                        <span className="font-medium text-blue-900">📝 Notes:</span>
                        <span className="text-blue-700 ml-2">{todayLog.hospitalBagStatus.notes}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {todayLog?.notes && (
              <Card>
                <CardHeader>
                  <h3 className="font-semibold">📝 Notes</h3>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-700">{todayLog.notes}</p>
                </CardContent>
              </Card>
            )}
              </>
            )}

            {/* Activity View - Audit History & Trends */}
            {viewMode === 'activity' && (
              <>
                {/* Link to Trends */}
                <Card className="border-2 border-primary-200 bg-gradient-to-r from-primary-50 to-accent-50">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                          <span className="text-xl">📈</span>
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">View Trends & Insights</h3>
                          <p className="text-sm text-gray-600">See patterns over days, weeks, and months</p>
                        </div>
                      </div>
                      <Link to="/family/trends" className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition-colors">
                        View Trends →
                      </Link>
                    </div>
                  </CardContent>
                </Card>

                {/* Today's Audit History */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <History className="h-5 w-5 text-primary-600" />
                      <h3 className="font-semibold text-gray-900">Today's Activity Log</h3>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {!todayLog ? (
                      <div className="text-center py-8">
                        <p className="text-gray-500">No care log for today yet</p>
                      </div>
                    ) : historyLoading ? (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-2"></div>
                        <p className="text-gray-500 text-sm">Loading activity...</p>
                      </div>
                    ) : !auditHistory || auditHistory.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-gray-500">No changes recorded yet</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {auditHistory.map((entry) => {
                          const actionLabels: Record<string, { label: string; color: string; icon: string }> = {
                            create: { label: 'Created', color: 'bg-green-100 text-green-800', icon: '📝' },
                            update: { label: 'Updated', color: 'bg-blue-100 text-blue-800', icon: '✏️' },
                            submit: { label: 'Day Submitted', color: 'bg-purple-100 text-purple-800', icon: '✅' },
                            submit_section: { label: 'Section Submitted', color: 'bg-indigo-100 text-indigo-800', icon: '📋' },
                          };
                          const actionInfo = actionLabels[entry.action] || { label: entry.action, color: 'bg-gray-100 text-gray-800', icon: '•' };

                          // Get section name if submit_section
                          let sectionName = '';
                          if (entry.action === 'submit_section' && entry.snapshot) {
                            const section = (entry.snapshot as Record<string, unknown>).section as string;
                            if (section === 'morning') sectionName = '🌅 Morning';
                            else if (section === 'afternoon') sectionName = '☀️ Afternoon';
                            else if (section === 'evening') sectionName = '🌙 Evening';
                            else if (section === 'dailySummary') sectionName = '📋 Daily Summary';
                          }

                          return (
                            <div key={entry.id} className="border rounded-lg p-3 bg-gray-50">
                              <div className="flex items-start justify-between mb-2">
                                <div>
                                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${actionInfo.color}`}>
                                    <span>{actionInfo.icon}</span>
                                    {actionInfo.label}
                                  </span>
                                  {sectionName && (
                                    <span className="ml-2 text-sm text-gray-600">{sectionName}</span>
                                  )}
                                </div>
                                <span className="text-xs text-gray-500">
                                  {new Date(entry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>

                              {/* Show changes for update actions */}
                              {entry.changes && Object.keys(entry.changes).length > 0 && (
                                <div className="mt-2 space-y-1">
                                  {Object.entries(entry.changes).slice(0, 3).map(([field, change]) => {
                                    const typedChange = change as { old: unknown; new: unknown };
                                    const fieldLabel = field
                                      .replace(/([A-Z])/g, ' $1')
                                      .replace(/^./, (str) => str.toUpperCase())
                                      .trim();

                                    return (
                                      <div key={field} className="text-xs bg-white rounded p-2 border">
                                        <span className="font-medium text-gray-700">{fieldLabel}:</span>
                                        <div className="flex items-center gap-2 mt-1">
                                          <span className="text-red-600 line-through truncate max-w-[100px]">
                                            {typedChange.old === null || typedChange.old === undefined
                                              ? '(empty)'
                                              : typeof typedChange.old === 'object'
                                                ? JSON.stringify(typedChange.old).slice(0, 20) + '...'
                                                : String(typedChange.old).slice(0, 20)}
                                          </span>
                                          <span className="text-gray-400">→</span>
                                          <span className="text-green-600 font-medium truncate max-w-[100px]">
                                            {typedChange.new === null || typedChange.new === undefined
                                              ? '(empty)'
                                              : typeof typedChange.new === 'object'
                                                ? JSON.stringify(typedChange.new).slice(0, 20) + '...'
                                                : String(typedChange.new).slice(0, 20)}
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                  {Object.keys(entry.changes).length > 3 && (
                                    <p className="text-xs text-gray-500 mt-1">
                                      +{Object.keys(entry.changes).length - 3} more changes
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Section Progression Summary */}
                <Card>
                  <CardHeader>
                    <h3 className="font-semibold text-gray-900">📊 Section Progression</h3>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {[
                        { key: 'morning', label: 'Morning', icon: '🌅', time: '6am - 12pm' },
                        { key: 'afternoon', label: 'Afternoon', icon: '☀️', time: '12pm - 6pm' },
                        { key: 'evening', label: 'Evening', icon: '🌙', time: '6pm - Bedtime' },
                        { key: 'dailySummary', label: 'Daily Summary', icon: '📋', time: 'End of day' },
                      ].map((section) => {
                        const sectionData = todayLog?.completedSections?.[section.key as keyof CompletedSections];
                        const isComplete = !!sectionData;
                        return (
                          <div
                            key={section.key}
                            className={`flex items-center justify-between p-3 rounded-lg border ${
                              isComplete ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-xl">{section.icon}</span>
                              <div>
                                <p className="font-medium text-gray-900">{section.label}</p>
                                <p className="text-xs text-gray-500">{section.time}</p>
                              </div>
                            </div>
                            {isComplete ? (
                              <div className="text-right">
                                <span className="inline-flex items-center gap-1 text-xs text-green-700 font-medium">
                                  ✅ Complete
                                </span>
                                <p className="text-xs text-gray-500">
                                  {new Date(sectionData.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400">Pending</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        )}
        </div>
      </div>

      {/* History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-primary-600" />
                <h2 className="text-lg font-semibold text-gray-900">Change History</h2>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="p-1 hover:bg-gray-200 rounded-full transition-colors"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-4 overflow-y-auto max-h-[60vh]">
              {historyLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-2"></div>
                  <p className="text-gray-500 text-sm">Loading history...</p>
                </div>
              ) : !auditHistory || auditHistory.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">No changes recorded yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {auditHistory.map((entry) => {
                    const actionLabels: Record<string, { label: string; color: string; icon: string }> = {
                      create: { label: 'Created', color: 'bg-green-100 text-green-800', icon: '📝' },
                      update: { label: 'Updated', color: 'bg-blue-100 text-blue-800', icon: '✏️' },
                      submit: { label: 'Submitted', color: 'bg-purple-100 text-purple-800', icon: '✅' },
                      submit_section: { label: 'Section Submitted', color: 'bg-indigo-100 text-indigo-800', icon: '📋' },
                    };
                    const actionInfo = actionLabels[entry.action] || { label: entry.action, color: 'bg-gray-100 text-gray-800', icon: '•' };

                    return (
                      <div key={entry.id} className="border rounded-lg p-3 bg-gray-50">
                        <div className="flex items-start justify-between mb-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${actionInfo.color}`}>
                            <span>{actionInfo.icon}</span>
                            {actionInfo.label}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(entry.createdAt).toLocaleString()}
                          </span>
                        </div>

                        {/* Show changes for update actions */}
                        {entry.changes && Object.keys(entry.changes).length > 0 && (
                          <div className="mt-2 space-y-1">
                            {Object.entries(entry.changes).map(([field, change]) => {
                              const typedChange = change as { old: unknown; new: unknown };
                              const fieldLabel = field
                                .replace(/([A-Z])/g, ' $1')
                                .replace(/^./, (str) => str.toUpperCase())
                                .trim();

                              return (
                                <div key={field} className="text-xs bg-white rounded p-2 border">
                                  <span className="font-medium text-gray-700">{fieldLabel}:</span>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="text-red-600 line-through">
                                      {typedChange.old === null || typedChange.old === undefined
                                        ? '(empty)'
                                        : typeof typedChange.old === 'object'
                                          ? JSON.stringify(typedChange.old)
                                          : String(typedChange.old)}
                                    </span>
                                    <span className="text-gray-400">→</span>
                                    <span className="text-green-600 font-medium">
                                      {typedChange.new === null || typedChange.new === undefined
                                        ? '(empty)'
                                        : typeof typedChange.new === 'object'
                                          ? JSON.stringify(typedChange.new)
                                          : String(typedChange.new)}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-4 py-3 border-t bg-gray-50">
              <Button
                onClick={() => setShowHistoryModal(false)}
                variant="outline"
                className="w-full"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </FamilyLayout>
  );
}
