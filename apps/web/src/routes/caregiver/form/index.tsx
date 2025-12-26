import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { authenticatedApiCall } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { QuickActionFAB } from '@/components/caregiver/QuickActionFAB';
import {
  Sun,
  Cloud,
  Moon,
  FileText,
  CheckCircle,
  Clock,
  Droplets,
  Activity,
  AlertTriangle,
  LogOut,
  CheckCircle2,
} from 'lucide-react';

export const Route = createFileRoute('/caregiver/form/')({
  component: FormDashboardComponent,
});

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

interface TodayResponse {
  id: string;
  status: 'draft' | 'submitted' | 'invalidated';
  completedSections?: CompletedSections;
  careRecipientId: string;
  logDate: string;
}

function FormDashboardComponent() {
  const { token, careRecipient, logoutCaregiver, caregiver } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const caregiverToken = token;
  const [careLogId, setCareLogId] = useState<string | null>(null);

  const handleLogout = () => {
    logoutCaregiver();
    navigate({ to: '/caregiver/login' });
  };

  // Fetch today's care log
  const { data: todayLog, isLoading } = useQuery({
    queryKey: ['caregiver-today-log'],
    queryFn: async () => {
      if (!caregiverToken) return null;
      try {
        const response = await authenticatedApiCall<TodayResponse>(
          '/care-logs/caregiver/today',
          caregiverToken
        );
        return response;
      } catch {
        // No log exists yet, that's ok
        return null;
      }
    },
    enabled: !!caregiverToken,
  });

  const completedSections = todayLog?.completedSections || {};
  const logStatus = todayLog?.status || 'draft';

  // Mutation to complete the day (final submit)
  const completeDayMutation = useMutation({
    mutationFn: async () => {
      if (!caregiverToken || !todayLog?.id) {
        throw new Error('No care log to submit');
      }
      return authenticatedApiCall(
        `/care-logs/${todayLog.id}/submit`,
        caregiverToken,
        { method: 'POST' }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caregiver-today-log'] });
    },
  });

  // Sync careLogId with fetched log
  if (todayLog?.id && careLogId !== todayLog.id) {
    setCareLogId(todayLog.id);
  }

  // Time period configuration
  const timePeriods = [
    {
      id: 'morning',
      title: 'Morning',
      icon: Sun,
      timeRange: '6am - 12pm',
      description: 'Wake up, shower, breakfast, AM medications',
      color: 'amber',
      completed: !!completedSections.morning,
      submittedAt: completedSections.morning?.submittedAt,
    },
    {
      id: 'afternoon',
      title: 'Afternoon',
      icon: Cloud,
      timeRange: '12pm - 6pm',
      description: 'Lunch, PM medications, rest period',
      color: 'sky',
      completed: !!completedSections.afternoon,
      submittedAt: completedSections.afternoon?.submittedAt,
    },
    {
      id: 'evening',
      title: 'Evening',
      icon: Moon,
      timeRange: '6pm - 10pm',
      description: 'Dinner, evening medications, bedtime prep',
      color: 'indigo',
      completed: !!completedSections.evening,
      submittedAt: completedSections.evening?.submittedAt,
    },
    {
      id: 'summary',
      title: 'Daily Summary',
      icon: FileText,
      timeRange: 'End of day',
      description: 'Safety checks, notes, final review',
      color: 'emerald',
      completed: !!completedSections.dailySummary,
      submittedAt: completedSections.dailySummary?.submittedAt,
    },
  ];


  const handleTimePeriodClick = (periodId: string) => {
    // Navigate to new time-based forms
    const routeMap: Record<string, string> = {
      morning: '/caregiver/form/morning',
      afternoon: '/caregiver/form/afternoon',
      evening: '/caregiver/form/evening',
      summary: '/caregiver/form/summary',
    };
    const route = routeMap[periodId];
    if (route) {
      navigate({ to: route });
    }
  };


  const formatSubmittedTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-accent-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  const completedCount = Object.keys(completedSections).length;
  const totalSections = 4;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-accent-50 pb-24">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Care Log for</p>
              <h1 className="text-2xl font-bold text-primary-700">
                {careRecipient?.name || 'Care Recipient'}
              </h1>
              <p className="text-sm text-gray-600 font-medium">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {logStatus === 'submitted' ? (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                  <CheckCircle className="h-4 w-4" />
                  Submitted
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-sm font-medium">
                  <Clock className="h-4 w-4" />
                  {completedCount}/{totalSections} sections
                </span>
              )}
              <Button
                onClick={() => navigate({ to: '/caregiver/pack-list' })}
                variant="outline"
                size="sm"
                title="Hospital Bag"
                className="text-lg"
              >
                🎒
              </Button>
              <Button
                onClick={handleLogout}
                variant="ghost"
                size="sm"
                className="text-gray-500 hover:text-red-600"
                title="Logout"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {/* Show logged in as info */}
          {caregiver?.username && (
            <p className="text-xs text-gray-400 mt-1">
              Logged in as: {caregiver.username}
            </p>
          )}
        </div>
      </div>

      {/* Time Period Cards */}
      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="grid grid-cols-2 gap-4">
          {timePeriods.map((period) => {
            const Icon = period.icon;
            const bgColors: Record<string, string> = {
              amber: period.completed ? 'bg-amber-50 border-amber-300' : 'bg-white border-gray-200',
              sky: period.completed ? 'bg-sky-50 border-sky-300' : 'bg-white border-gray-200',
              indigo: period.completed ? 'bg-indigo-50 border-indigo-300' : 'bg-white border-gray-200',
              emerald: period.completed ? 'bg-emerald-50 border-emerald-300' : 'bg-white border-gray-200',
            };
            const iconColors: Record<string, string> = {
              amber: 'text-amber-500',
              sky: 'text-sky-500',
              indigo: 'text-indigo-500',
              emerald: 'text-emerald-500',
            };

            return (
              <button
                key={period.id}
                onClick={() => handleTimePeriodClick(period.id)}
                className={`relative p-4 rounded-xl border-2 transition-all hover:shadow-md text-left ${bgColors[period.color]}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <Icon className={`h-8 w-8 ${iconColors[period.color]}`} />
                  {period.completed && (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  )}
                </div>
                <h3 className="font-semibold text-gray-900">{period.title}</h3>
                <p className="text-xs text-gray-500 mt-1">{period.timeRange}</p>
                {period.completed && period.submittedAt && (
                  <p className="text-xs text-green-600 mt-2">
                    Done at {formatSubmittedTime(period.submittedAt)}
                  </p>
                )}
                {!period.completed && (
                  <p className="text-xs text-gray-400 mt-2">{period.description}</p>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Complete Day Button - shows when all sections done but not yet submitted */}
      {completedCount === totalSections && logStatus === 'draft' && todayLog?.id && (
        <div className="max-w-lg mx-auto px-4 mt-6">
          <Card className="border-2 border-green-300 bg-green-50">
            <CardContent className="py-4">
              <div className="text-center mb-3">
                <CheckCircle2 className="h-10 w-10 text-green-600 mx-auto mb-2" />
                <h3 className="text-lg font-semibold text-green-800">All Sections Complete!</h3>
                <p className="text-sm text-green-700 mt-1">
                  Ready to submit today's care log to the family
                </p>
              </div>
              <Button
                onClick={() => completeDayMutation.mutate()}
                disabled={completeDayMutation.isPending}
                variant="primary"
                size="lg"
                className="w-full bg-green-600 hover:bg-green-700"
              >
                {completeDayMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-5 w-5 mr-2" />
                    Complete Day & Submit
                  </>
                )}
              </Button>
              <p className="text-xs text-green-600 text-center mt-2">
                You can still make edits after submission if needed
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Day Already Submitted */}
      {logStatus === 'submitted' && (
        <div className="max-w-lg mx-auto px-4 mt-6">
          <Card className="border-2 border-green-400 bg-green-100">
            <CardContent className="py-4 text-center">
              <CheckCircle className="h-10 w-10 text-green-600 mx-auto mb-2" />
              <h3 className="text-lg font-semibold text-green-800">Day Complete!</h3>
              <p className="text-sm text-green-700 mt-1">
                Today's care log has been submitted to the family
              </p>
              <p className="text-xs text-green-600 mt-2">
                You can still make edits - changes will be tracked in the audit log
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Go to Full Form Link */}
      <div className="max-w-lg mx-auto px-4 mt-8">
        <Button
          onClick={() => navigate({ to: '/caregiver/form-legacy', search: { section: 1 } })}
          variant="outline"
          className="w-full"
        >
          Open Full Form (All Sections)
        </Button>
      </div>

      {/* Today's Stats (if data exists) */}
      {todayLog && (
        <div className="max-w-lg mx-auto px-4 mt-6">
          <Card>
            <CardContent className="py-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Today's Progress</h3>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-gray-600">
                  <Droplets className="h-4 w-4 text-blue-500" />
                  <span>Fluids logged</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <Activity className="h-4 w-4 text-green-500" />
                  <span>Exercise sessions</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <span>Incidents</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Quick Action FAB */}
      <QuickActionFAB
        careLogId={careLogId}
        careRecipientId={careRecipient?.id || null}
        onLogCreated={setCareLogId}
      />
    </div>
  );
}
