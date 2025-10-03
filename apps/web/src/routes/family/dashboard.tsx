import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export const Route = createFileRoute('/family/dashboard')({
  component: DashboardComponent,
});

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

function DashboardComponent() {
  const [user, setUser] = useState<User | null>(null);
  const [careRecipient, setCareRecipient] = useState<any>(null);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    const recipientData = localStorage.getItem('careRecipient');
    if (userData) setUser(JSON.parse(userData));
    if (recipientData) setCareRecipient(JSON.parse(recipientData));
  }, []);

  // Fetch today's care log
  const { data: todayLog, isLoading } = useQuery({
    queryKey: ['care-log-today', careRecipient?.id],
    queryFn: async () => {
      if (!careRecipient?.id) return null;
      const response = await fetch(`/api/care-logs/recipient/${careRecipient.id}/today`);
      if (!response.ok) return null;
      return response.json();
    },
    enabled: !!careRecipient?.id,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('careRecipient');
    window.location.href = '/auth/login';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-accent-50">
      <header className="bg-white shadow-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-primary-700">Anchor</h1>
            {user && <p className="text-sm text-gray-600 mt-1">Welcome back, {user.name}</p>}
          </div>
          <Button onClick={handleLogout} variant="ghost" size="sm">
            Log out
          </Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
            {/* Care Recipient Info */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">{careRecipient.name}</h2>
                    <p className="text-sm text-gray-600">{careRecipient.condition || 'No condition specified'}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <Button
                      onClick={() => (window.location.href = '/family/trends')}
                      variant="ghost"
                      size="sm"
                    >
                      📊 View 7-Day Trends
                    </Button>
                    <div className="text-right text-sm text-gray-600">
                      <p>Last updated: {todayLog ? new Date(todayLog.updatedAt).toLocaleTimeString() : 'No data'}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Alerts */}
            {todayLog?.emergencyFlag && (
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

            {/* Today's Summary */}
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
          </div>
        )}
      </main>
    </div>
  );
}
