import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { apiCall } from '@/lib/api';

export const Route = createFileRoute('/family/onboarding/caregiver')({
  component: CaregiverOnboardingComponent,
});

interface CaregiverData {
  careRecipientId: string;
  name: string;
  phone?: string;
  language: string;
}

function CaregiverOnboardingComponent() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [language, setLanguage] = useState('en');
  const [generatedPin, setGeneratedPin] = useState<string | null>(null);

  const createCaregiverMutation = useMutation({
    mutationFn: async (data: CaregiverData) => {
      // Use apiCall helper for correct API URL in all environments
      return apiCall('/caregivers', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: (data) => {
      setGeneratedPin(data.pin);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const careRecipient = JSON.parse(localStorage.getItem('careRecipient') || '{}');

    if (!careRecipient.id) {
      alert('Care recipient information is missing. Please go back and complete the previous step.');
      return;
    }

    createCaregiverMutation.mutate({
      careRecipientId: careRecipient.id,
      name,
      phone: phone || undefined,
      language,
    });
  };

  const handleFinish = () => {
    navigate({ to: '/family/dashboard' });
  };

  if (generatedPin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-accent-50 py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <div className="text-center">
                <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Caregiver Account Created!</h2>
                <p className="text-gray-600">Share this PIN with your caregiver</p>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              <div className="bg-primary-50 border-2 border-primary-200 rounded-xl p-8 text-center">
                <p className="text-sm text-gray-600 mb-2">6-Digit PIN</p>
                <p className="text-5xl font-bold text-primary-700 tracking-widest font-mono">{generatedPin}</p>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex gap-3">
                  <svg className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <p className="font-medium text-yellow-900 text-sm">Important</p>
                    <p className="text-yellow-800 text-sm mt-1">
                      Write this PIN down and share it with <span className="font-semibold">{name}</span>.
                      They'll need it to log in and submit daily care reports.
                    </p>
                  </div>
                </div>
              </div>

              <Button onClick={handleFinish} variant="primary" size="lg" className="w-full">
                Go to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-accent-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary-700 mb-2">Almost Done!</h1>
          <p className="text-gray-600">Create an account for your caregiver</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 w-10 h-10 bg-accent-100 rounded-full flex items-center justify-center">
                <span className="text-accent-700 font-semibold">2</span>
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Create Caregiver Account</h2>
                <p className="text-sm text-gray-600">We'll generate a secure PIN for them</p>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Caregiver's Full Name *"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Maria Santos"
              />

              <Input
                label="Phone Number"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+65 9123 4567"
                helperText="Optional - for contact purposes"
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Preferred Language
                </label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="en">English</option>
                  <option value="zh">中文 (Chinese)</option>
                  <option value="ms">Bahasa Melayu</option>
                  <option value="ta">தமிழ் (Tamil)</option>
                  <option value="tl">Tagalog</option>
                </select>
              </div>

              {createCaregiverMutation.isError && (
                <div className="bg-error/10 border border-error/20 text-error px-4 py-3 rounded-lg text-sm">
                  {createCaregiverMutation.error?.message || 'Failed to create caregiver account. Please try again.'}
                </div>
              )}

              <div className="pt-4">
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="w-full"
                  isLoading={createCaregiverMutation.isPending}
                >
                  Generate PIN & Create Account
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
