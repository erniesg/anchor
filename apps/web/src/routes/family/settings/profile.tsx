import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { User, Save, Lock } from 'lucide-react';
import { FamilyLayout } from '@/components/FamilyLayout';
import { useAuth } from '@/contexts/AuthContext';

export const Route = createFileRoute('/family/settings/profile')({
  component: ProfileSettingsComponent,
});

interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  timezone: string;
  emailNotifications: boolean;
  smsNotifications: boolean;
}

const timezones = [
  'Asia/Singapore',
  'America/New_York',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Asia/Tokyo',
  'Australia/Sydney',
];

function ProfileSettingsComponent() {
  const { user: authUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [timezone, setTimezone] = useState('Asia/Singapore');
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(false);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Initialize form from AuthContext user
  useEffect(() => {
    if (authUser) {
      setName(authUser.name || '');
      setEmail(authUser.email || '');
      setPhone(authUser.phone || '');
      setTimezone(authUser.timezone || 'Asia/Singapore');
      setEmailNotifications(authUser.emailNotifications ?? true);
      setSmsNotifications(authUser.smsNotifications ?? false);
    }
  }, [authUser]);

  // Profile loading state (using AuthContext now)
  const isLoading = !authUser;

  // Update profile mutation (disabled - using localStorage for now)
  const updateMutation = useMutation({
    mutationFn: async (data: Partial<UserProfile>) => {
      // TODO: Implement users API endpoint
      // For now, just update localStorage
      const user = localStorage.getItem('user');
      if (user) {
        const parsed = JSON.parse(user);
        const updated = { ...parsed, ...data };
        localStorage.setItem('user', JSON.stringify(updated));
      }
      return data;
    },
    onSuccess: () => {
      setIsEditing(false);
      alert('Profile updated successfully! (Changes saved locally only)');
    },
  });

  // Change password mutation (disabled - no API endpoint yet)
  const changePasswordMutation = useMutation({
    mutationFn: async (_data: { currentPassword: string; newPassword: string }) => {
      // TODO: Implement users API endpoint for password change
      throw new Error('Password change is not yet implemented. Please contact support.');
    },
    onSuccess: () => {
      setShowPasswordModal(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordError('');
    },
    onError: (error: Error) => {
      setPasswordError(error.message);
    },
  });

  const handleSave = () => {
    updateMutation.mutate({
      name,
      email,
      phone: phone || undefined,
      timezone,
      emailNotifications,
      smsNotifications,
    });
  };

  const handleCancel = () => {
    if (authUser) {
      setName(authUser.name || '');
      setEmail(authUser.email || '');
      setPhone(authUser.phone || '');
      setTimezone(authUser.timezone || 'Asia/Singapore');
      setEmailNotifications(authUser.emailNotifications ?? true);
      setSmsNotifications(authUser.smsNotifications ?? false);
    }
    setIsEditing(false);
  };

  const handleChangePassword = () => {
    setPasswordError('');

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      return;
    }

    changePasswordMutation.mutate({ currentPassword, newPassword });
  };

  return (
    <FamilyLayout>
      <div className="bg-gray-50 min-h-screen">
        {/* Page Header */}
        <div className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-4 py-6">
            <div className="flex items-center gap-3">
              <User className="h-8 w-8 text-purple-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Profile Settings</h1>
                <p className="text-sm text-gray-600">Manage your profile and preferences</p>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {isLoading ? (
          <p className="text-center text-gray-600">Loading profile...</p>
        ) : (
          <>
            {/* Profile Information */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Profile Information</h3>
                  {!isEditing && (
                    <Button onClick={() => setIsEditing(true)} size="sm">
                      Edit
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={!isEditing}
                    placeholder="Your name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={!isEditing}
                    placeholder="your@email.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                  <Input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    disabled={!isEditing}
                    placeholder="+65 9123 4567"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Timezone</label>
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    disabled={!isEditing}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    {timezones.map((tz) => (
                      <option key={tz} value={tz}>
                        {tz}
                      </option>
                    ))}
                  </select>
                </div>

                {isEditing && (
                  <div className="flex gap-2 pt-4">
                    <Button onClick={handleCancel} variant="outline" className="flex-1">
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSave}
                      disabled={updateMutation.isPending}
                      className="flex-1"
                    >
                      {updateMutation.isPending ? (
                        'Saving...'
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Save Changes
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Notification Preferences */}
            <Card>
              <CardHeader>
                <h3 className="text-lg font-semibold text-gray-900">Notification Preferences</h3>
              </CardHeader>
              <CardContent className="space-y-4">
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <div className="font-medium text-gray-900">Email Notifications</div>
                    <div className="text-sm text-gray-500">Receive care log updates via email</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={emailNotifications}
                    onChange={(e) => {
                      setEmailNotifications(e.target.checked);
                      if (!isEditing) {
                        updateMutation.mutate({ emailNotifications: e.target.checked });
                      }
                    }}
                    className="h-5 w-5 text-purple-600 rounded focus:ring-purple-500"
                  />
                </label>

                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <div className="font-medium text-gray-900">SMS Notifications</div>
                    <div className="text-sm text-gray-500">Receive emergency alerts via SMS</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={smsNotifications}
                    onChange={(e) => {
                      setSmsNotifications(e.target.checked);
                      if (!isEditing) {
                        updateMutation.mutate({ smsNotifications: e.target.checked });
                      }
                    }}
                    className="h-5 w-5 text-purple-600 rounded focus:ring-purple-500"
                  />
                </label>
              </CardContent>
            </Card>

            {/* Security */}
            <Card>
              <CardHeader>
                <h3 className="text-lg font-semibold text-gray-900">Security</h3>
              </CardHeader>
              <CardContent>
                <Button onClick={() => setShowPasswordModal(true)} variant="outline">
                  <Lock className="h-4 w-4 mr-2" />
                  Change Password
                </Button>
              </CardContent>
            </Card>
          </>
        )}
        </div>
      </div>

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <h3 className="text-lg font-semibold text-gray-900">Change Password</h3>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Current Password
                </label>
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm New Password
                </label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                />
              </div>

              {passwordError && (
                <p className="text-sm text-red-600">{passwordError}</p>
              )}

              <div className="flex gap-2 pt-4">
                <Button
                  onClick={() => {
                    setShowPasswordModal(false);
                    setCurrentPassword('');
                    setNewPassword('');
                    setConfirmPassword('');
                    setPasswordError('');
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleChangePassword}
                  disabled={
                    !currentPassword ||
                    !newPassword ||
                    !confirmPassword ||
                    changePasswordMutation.isPending
                  }
                  className="flex-1"
                >
                  {changePasswordMutation.isPending ? 'Changing...' : 'Change Password'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </FamilyLayout>
  );
}
