import { createFileRoute, Link } from '@tanstack/react-router';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Settings, Users, UserCog, User, LogOut } from 'lucide-react';

export const Route = createFileRoute('/family/settings/')({
  component: SettingsIndexComponent,
});

function SettingsIndexComponent() {
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('careRecipient');
    window.location.href = '/auth/login';
  };

  const settingsSections = [
    {
      title: 'Caregivers',
      description: 'Manage caregivers, reset PINs, and deactivate accounts',
      icon: UserCog,
      href: '/family/settings/caregivers',
      color: 'text-blue-600',
    },
    {
      title: 'Family Members',
      description: 'Invite family members and manage access permissions',
      icon: Users,
      href: '/family/settings/family-members',
      color: 'text-green-600',
    },
    {
      title: 'Profile',
      description: 'Edit your profile, timezone, and notification preferences',
      icon: User,
      href: '/family/settings/profile',
      color: 'text-purple-600',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Settings className="h-8 w-8 text-gray-700" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
                <p className="text-sm text-gray-600">Manage your account and preferences</p>
              </div>
            </div>
            <Link to="/family/dashboard">
              <Button variant="outline">Back to Dashboard</Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Settings Grid */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {settingsSections.map((section) => {
            const Icon = section.icon;
            return (
              <Link key={section.href} to={section.href} className="block">
                <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                  <CardHeader className="pb-4">
                    <div className="flex items-start gap-4">
                      <div className={`p-3 rounded-lg bg-gray-50 ${section.color}`}>
                        <Icon className="h-6 w-6" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg text-gray-900">{section.title}</h3>
                        <p className="text-sm text-gray-600 mt-1">{section.description}</p>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              </Link>
            );
          })}
        </div>

        {/* Danger Zone */}
        <Card className="mt-8 border-red-200">
          <CardHeader>
            <h3 className="text-lg font-semibold text-red-600">Danger Zone</h3>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Log Out</p>
                <p className="text-sm text-gray-600">Sign out of your account</p>
              </div>
              <Button onClick={handleLogout} variant="outline" className="text-red-600 border-red-200 hover:bg-red-50">
                <LogOut className="h-4 w-4 mr-2" />
                Log Out
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
