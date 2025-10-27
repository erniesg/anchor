import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { authenticatedApiCall } from '@/lib/api';
import { Copy, Check } from 'lucide-react';

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
  const [caregiverId, setCaregiverId] = useState<string | null>(null);
  const [copiedPin, setCopiedPin] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  const createCaregiverMutation = useMutation({
    mutationFn: async (data: CaregiverData) => {
      // Get token from localStorage
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication token not found. Please log in again.');
      }

      // Use authenticatedApiCall for JWT authentication
      return authenticatedApiCall('/caregivers', token, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: (data) => {
      setGeneratedPin(data.pin);
      setCaregiverId(data.id);
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

  const copyToClipboard = async (text: string, type: 'pin' | 'id') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'pin') {
        setCopiedPin(true);
        setTimeout(() => setCopiedPin(false), 2000);
      } else {
        setCopiedId(true);
        setTimeout(() => setCopiedId(false), 2000);
      }
    } catch (err) {
      console.error('Failed to copy:', err);
    }
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
                <p className="text-gray-600">Share these credentials with your caregiver</p>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Caregiver ID */}
              <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-blue-900">Caregiver ID</p>
                  <button
                    onClick={() => caregiverId && copyToClipboard(caregiverId, 'id')}
                    className="flex items-center gap-1 text-blue-600 hover:text-blue-700 text-sm font-medium"
                  >
                    {copiedId ? (
                      <>
                        <Check className="h-4 w-4" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        Copy
                      </>
                    )}
                  </button>
                </div>
                <p className="text-sm font-mono text-blue-900 break-all">{caregiverId}</p>
              </div>

              {/* PIN */}
              <div className="bg-primary-50 border-2 border-primary-200 rounded-xl p-6">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-primary-900">6-Digit PIN</p>
                  <button
                    onClick={() => generatedPin && copyToClipboard(generatedPin, 'pin')}
                    className="flex items-center gap-1 text-primary-600 hover:text-primary-700 text-sm font-medium"
                  >
                    {copiedPin ? (
                      <>
                        <Check className="h-4 w-4" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        Copy
                      </>
                    )}
                  </button>
                </div>
                <p className="text-5xl font-bold text-primary-700 tracking-widest font-mono text-center">{generatedPin}</p>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex gap-3">
                  <svg className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <p className="font-medium text-yellow-900 text-sm">Important - Share BOTH with {name}</p>
                    <p className="text-yellow-800 text-sm mt-1">
                      Your caregiver needs <span className="font-semibold">both the Caregiver ID and PIN</span> to log in at <span className="font-semibold">anchor-dev.erniesg.workers.dev/caregiver/login</span>
                    </p>
                    <p className="text-yellow-800 text-sm mt-2">
                      💡 Tip: Use the copy buttons above to easily share via WhatsApp or SMS
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
