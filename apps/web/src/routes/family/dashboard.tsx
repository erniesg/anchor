import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
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

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
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
        <div className="grid gap-6">
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
                <Button variant="primary" size="lg">
                  Start Setup
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
