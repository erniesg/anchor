import { createFileRoute, Link } from '@tanstack/react-router';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { User, ArrowLeft, Construction } from 'lucide-react';

export const Route = createFileRoute('/family/settings/profile')({
  component: ProfileSettingsComponent,
});

function ProfileSettingsComponent() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <User className="h-8 w-8 text-purple-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Profile Settings</h1>
                <p className="text-sm text-gray-600">Manage your profile and preferences</p>
              </div>
            </div>
            <Link to="/family/settings">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Settings
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Construction className="h-6 w-6 text-yellow-600" />
              <h3 className="text-lg font-semibold text-gray-900">Coming Soon</h3>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">
              Profile settings are currently under development.
            </p>
            <p className="text-sm text-gray-500 mt-2">
              This feature will allow you to:
            </p>
            <ul className="list-disc list-inside text-sm text-gray-500 mt-2 space-y-1">
              <li>Edit your name and email</li>
              <li>Update your phone number</li>
              <li>Set your timezone preference</li>
              <li>Configure email and SMS notifications</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
