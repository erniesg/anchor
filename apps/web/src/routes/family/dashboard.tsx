import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Settings } from 'lucide-react';
import { authenticatedApiCall } from '@/lib/api';
import { FamilyLayout } from '@/components/FamilyLayout';
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
} from 'recharts';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, subWeeks } from 'date-fns';

export const Route = createFileRoute('/family/dashboard')({
  component: DashboardComponent,
});

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
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
  const [user, setUser] = useState<User | null>(null);
  const [careRecipient, setCareRecipient] = useState<any>(null);
  const [token, setToken] = useState<string>('');
  const [viewMode, setViewMode] = useState<'today' | 'week' | 'month'>('today');
  const [weekOffset, setWeekOffset] = useState(0); // 0 = this week, -1 = last week, etc.

  useEffect(() => {
    const userData = localStorage.getItem('user');
    const recipientData = localStorage.getItem('careRecipient');
    const tokenData = localStorage.getItem('token');
    if (userData) setUser(JSON.parse(userData));
    if (recipientData) setCareRecipient(JSON.parse(recipientData));
    if (tokenData) setToken(tokenData);
  }, []);

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
    enabled: !!careRecipient?.id && viewMode === 'week',
    refetchInterval: 60000,
  });

  // Transform week data for charts
  const chartData =
    weekLogs?.map((log: any) => ({
      date: format(new Date(log.logDate), 'MMM dd'),
      systolic: log.bloodPressure ? parseInt(log.bloodPressure.split('/')[0]) : null,
      diastolic: log.bloodPressure ? parseInt(log.bloodPressure.split('/')[1]) : null,
      pulse: log.pulseRate,
      oxygen: log.oxygenLevel,
      bloodSugar: log.bloodSugar,
      appetite: log.meals?.breakfast?.appetite || 0,
      amountEaten: log.meals?.breakfast?.amountEaten || 0,
    })) || [];

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('careRecipient');
    window.location.href = '/auth/login';
  };

  return (
    <FamilyLayout>
      <div className="bg-gradient-to-br from-primary-50 to-accent-50 min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* User Greeting */}
          {user && (
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-primary-700">Welcome back, {user.name}</h1>
              <div className="flex items-center gap-3 mt-2">
                <Button onClick={handleLogout} variant="ghost" size="sm">
                  Log out
                </Button>
              </div>
            </div>
          )}
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
            {/* Care Recipient Info + View Toggle */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">{careRecipient.name}</h2>
                    <p className="text-sm text-gray-600">{careRecipient.condition || 'No condition specified'}</p>
                  </div>
                </div>

                {/* View Mode Toggle */}
                <div className="flex items-center justify-between">
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
                      onClick={() => setViewMode('month')}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                        viewMode === 'month'
                          ? 'bg-white text-primary-700 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Month
                    </button>
                  </div>

                  {/* Week Navigation */}
                  {viewMode === 'week' && (
                    <div className="flex items-center gap-2">
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

                  {viewMode === 'today' && (
                    <div className="text-right">
                      {todayLog?.status && (
                        <div className="mb-2">
                          <StatusBadge status={todayLog.status} />
                        </div>
                      )}
                      <p className="text-sm text-gray-600">
                        Last updated: {todayLog ? new Date(todayLog.updatedAt).toLocaleTimeString() : 'No data'}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

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

            {/* Week View - Trend Charts */}
            {viewMode === 'week' && (
              <div className="space-y-6">
                {weekLoading ? (
                  <Card>
                    <CardContent className="p-6 text-center">
                      <p className="text-gray-600">Loading week data...</p>
                    </CardContent>
                  </Card>
                ) : chartData.length === 0 ? (
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
                ) : !todayLog ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <div className="py-8">
                    <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-gray-600 mb-2">No care log submitted today</p>
                    <p className="text-sm text-gray-500">Waiting for caregiver to submit daily report</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
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

                {/* Medications */}
                <Card>
                  <CardHeader>
                    <h3 className="font-semibold">💊 Medications</h3>
                  </CardHeader>
                  <CardContent>
                    {todayLog.medications && todayLog.medications.length > 0 ? (
                      <div className="space-y-2">
                        {todayLog.medications.map((med: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between text-sm">
                            <span className="text-gray-700">{med.name}</span>
                            {med.given ? (
                              <span className="text-success">✅ {med.time}</span>
                            ) : (
                              <span className="text-gray-400">⏺ Not given</span>
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
                          <span className="font-medium">{todayLog.meals.breakfast.amountEaten}%</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No meal data recorded</p>
                    )}
                  </CardContent>
                </Card>

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
                      {todayLog.unaccompaniedTime.map((period: any, index: number) => (
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

            {/* Month View - Coming Soon */}
            {viewMode === 'month' && (
              <Card>
                <CardContent className="p-6 text-center">
                  <p className="text-gray-600">Month view coming soon</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
        </div>
      </div>
    </FamilyLayout>
  );
}
