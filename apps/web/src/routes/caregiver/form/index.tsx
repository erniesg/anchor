import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
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
  Backpack,
  Droplets,
  Activity,
  AlertTriangle,
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
  const { token, careRecipient } = useAuth();
  const navigate = useNavigate();
  const caregiverToken = token;
  const [careLogId, setCareLogId] = useState<string | null>(null);

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

  // Quick actions for anytime entries
  const quickActions = [
    {
      id: 'toileting',
      label: 'Toileting',
      icon: '🚽',
      description: 'Log bathroom visit',
    },
    {
      id: 'fluid',
      label: 'Fluid',
      icon: '💧',
      description: 'Log drink intake',
    },
    {
      id: 'exercise',
      label: 'Exercise',
      icon: '🏃',
      description: 'Log activity session',
    },
    {
      id: 'incident',
      label: 'Incident',
      icon: '⚠️',
      description: 'Report concern',
    },
  ];

  const handleTimePeriodClick = (periodId: string) => {
    // Navigate to legacy form with section param
    // Morning: sections 1-3 (Morning Routine, Medications, Breakfast)
    // Afternoon: sections 3-6 (Lunch, Tea, Vitals, Rest)
    // Evening: sections 3, 6 (Dinner, Night Sleep)
    // Summary: sections 7-13 (Fall Risk, Unaccompanied, Safety, etc.)
    const sectionMap: Record<string, number> = {
      morning: 1,
      afternoon: 3, // Start at meals for lunch
      evening: 3, // Start at meals for dinner
      summary: 7, // Start at Fall Risk
    };
    const section = sectionMap[periodId] || 1;
    navigate({ to: '/caregiver/form-legacy', search: { section } });
  };

  const handleQuickAction = (actionId: string) => {
    // TODO: Open quick action modal/drawer
    console.log('Quick action:', actionId);
    // For now, navigate to legacy form based on action
    const sectionMap: Record<string, number> = {
      toileting: 5, // Toileting section
      fluid: 3, // Meals section has fluid intake
      exercise: 11, // Physical Activity section
      incident: 12, // Special Concerns section
    };
    const section = sectionMap[actionId] || 1;
    navigate({ to: '/caregiver/form-legacy', search: { section } });
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
              <h1 className="text-xl font-bold text-primary-700">Today's Care Log</h1>
              <p className="text-sm text-gray-600">
                {careRecipient?.name || 'Care Recipient'} - {new Date().toLocaleDateString()}
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
              >
                <Backpack className="h-4 w-4" />
              </Button>
            </div>
          </div>
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

      {/* Quick Actions Section */}
      <div className="max-w-lg mx-auto px-4">
        <div className="border-t pt-6">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4 flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Quick Actions (Anytime)
          </h2>
          <div className="grid grid-cols-4 gap-3">
            {quickActions.map((action) => (
              <button
                key={action.id}
                onClick={() => handleQuickAction(action.id)}
                className="flex flex-col items-center p-3 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-all"
              >
                <span className="text-2xl mb-1">{action.icon}</span>
                <span className="text-xs font-medium text-gray-700">{action.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

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
