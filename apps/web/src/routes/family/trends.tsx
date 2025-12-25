import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
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
} from 'recharts';
import { format, subDays } from 'date-fns';

export const Route = createFileRoute('/family/trends')({
  component: TrendsComponent,
});

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface CareRecipient {
  id: string;
  name: string;
  condition?: string;
}

interface TrendLog {
  logDate: string;
  bloodPressure?: string;
  pulseRate?: number;
  oxygenLevel?: number;
  bloodSugar?: number;
  meals?: {
    breakfast?: {
      appetite?: number;
      amountEaten?: number;
    };
  };
}

function TrendsComponent() {
  const navigate = useNavigate();
  const { user, careRecipient, logoutFamily } = useAuth();

  // Redirect to onboarding if no care recipient exists
  useEffect(() => {
    if (user && !careRecipient) {
      navigate({ to: '/family/onboarding' });
    }
  }, [user, careRecipient, navigate]);

  // Fetch 7-day historical data for trends
  const { data: weekLogs, isLoading: weekLoading } = useQuery({
    queryKey: ['care-logs-week', careRecipient?.id],
    queryFn: async () => {
      if (!careRecipient?.id) return [];
      const promises = [];
      for (let i = 6; i >= 0; i--) {
        const date = format(subDays(new Date(), i), 'yyyy-MM-dd');
        promises.push(
          fetch(`/api/care-logs/recipient/${careRecipient.id}/date/${date}`)
            .then((res) => (res.ok ? res.json() : null))
            .catch(() => null)
        );
      }
      const results = await Promise.all(promises);
      return results.filter(Boolean);
    },
    enabled: !!careRecipient?.id,
    refetchInterval: 60000, // Refresh every minute
  });

  const handleLogout = () => {
    logoutFamily();
    navigate({ to: '/auth/login' });
  };

  // Transform week data for charts
  const chartData =
    weekLogs?.map((log: TrendLog) => ({
      date: format(new Date(log.logDate), 'MMM dd'),
      systolic: log.bloodPressure ? parseInt(log.bloodPressure.split('/')[0]) : null,
      diastolic: log.bloodPressure ? parseInt(log.bloodPressure.split('/')[1]) : null,
      pulse: log.pulseRate,
      oxygen: log.oxygenLevel,
      bloodSugar: log.bloodSugar,
      appetite: log.meals?.breakfast?.appetite || 0,
      amountEaten: log.meals?.breakfast?.amountEaten || 0,
    })) || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-accent-50">
      <header className="bg-white shadow-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-primary-700">Anchor</h1>
            {user && <p className="text-sm text-gray-600 mt-1">Welcome back, {user.name}</p>}
          </div>
          <div className="flex items-center gap-4">
            <Button onClick={() => (window.location.href = '/family/dashboard')} variant="ghost" size="sm">
              ← Dashboard
            </Button>
            <Button onClick={handleLogout} variant="ghost" size="sm">
              Log out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!careRecipient ? (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-gray-600">No care recipient selected</p>
              <Button onClick={() => (window.location.href = '/family/dashboard')} className="mt-4">
                Go to Dashboard
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Header */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">7-Day Health Trends</h2>
                    <p className="text-sm text-gray-600">{careRecipient.name}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Trends */}
            {weekLoading ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <p className="text-gray-600">Loading trend data...</p>
                </CardContent>
              </Card>
            ) : chartData.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <p className="text-gray-600">No data available for the past 7 days</p>
                  <p className="text-sm text-gray-500 mt-2">
                    Trend charts will appear once caregivers start submitting daily reports
                  </p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Blood Pressure Trends */}
                <Card>
                  <CardHeader>
                    <h3 className="font-semibold">📈 Blood Pressure Trends (7 Days)</h3>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis domain={[60, 180]} />
                        <Tooltip />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="systolic"
                          stroke="#ef4444"
                          name="Systolic"
                          strokeWidth={2}
                        />
                        <Line
                          type="monotone"
                          dataKey="diastolic"
                          stroke="#3b82f6"
                          name="Diastolic"
                          strokeWidth={2}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Pulse & Oxygen */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <h3 className="font-semibold">💓 Pulse Rate</h3>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={250}>
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis domain={[50, 120]} />
                          <Tooltip />
                          <Line type="monotone" dataKey="pulse" stroke="#10b981" name="BPM" strokeWidth={2} />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <h3 className="font-semibold">🫁 Oxygen Level</h3>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={250}>
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis domain={[90, 100]} />
                          <Tooltip />
                          <Line
                            type="monotone"
                            dataKey="oxygen"
                            stroke="#06b6d4"
                            name="SpO₂ %"
                            strokeWidth={2}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>

                {/* Blood Sugar & Appetite */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <h3 className="font-semibold">🩸 Blood Sugar</h3>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={250}>
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis domain={[4, 10]} />
                          <Tooltip />
                          <Line
                            type="monotone"
                            dataKey="bloodSugar"
                            stroke="#8b5cf6"
                            name="mmol/L"
                            strokeWidth={2}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <h3 className="font-semibold">🍽️ Appetite & Meal Consumption</h3>
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
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
