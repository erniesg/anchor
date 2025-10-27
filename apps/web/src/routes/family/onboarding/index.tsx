import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { authenticatedApiCall } from '@/lib/api';

export const Route = createFileRoute('/family/onboarding/')({
  component: OnboardingComponent,
});

interface CareRecipientData {
  name: string;
  dateOfBirth?: string;
  condition?: string;
  location?: string;
  emergencyContact?: string;
}

function OnboardingComponent() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [condition, setCondition] = useState('');
  const [location, setLocation] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');

  // Check if user already has care recipients - if yes, redirect to dashboard
  const { data: existingRecipients } = useQuery({
    queryKey: ['care-recipients-check'],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      if (!token) return null;
      try {
        return await authenticatedApiCall('/care-recipients', token);
      } catch {
        return null;
      }
    },
  });

  // Redirect to dashboard if user already has care recipients
  useEffect(() => {
    if (existingRecipients && existingRecipients.length > 0) {
      navigate({ to: '/family/dashboard' });
    }
  }, [existingRecipients, navigate]);

  const createRecipientMutation = useMutation({
    mutationFn: async (data: CareRecipientData) => {
      const token = localStorage.getItem('token');

      // Guard: Check if user is authenticated
      if (!token) {
        throw new Error('User session expired. Please log in again.');
      }

      // Use authenticatedApiCall with JWT token
      return authenticatedApiCall('/care-recipients', token, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: (data) => {
      localStorage.setItem('careRecipient', JSON.stringify(data));
      navigate({ to: '/family/onboarding/caregiver' });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createRecipientMutation.mutate({
      name,
      dateOfBirth: dateOfBirth || undefined,
      condition: condition || undefined,
      location: location || undefined,
      emergencyContact: emergencyContact || undefined,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-accent-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary-700 mb-2">Welcome to Anchor</h1>
          <p className="text-gray-600">Let's set up your care recipient's profile</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                <span className="text-primary-700 font-semibold">1</span>
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Add Care Recipient</h2>
                <p className="text-sm text-gray-600">Tell us about your loved one</p>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Full Name *"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Sulochana Rao"
              />

              <Input
                label="Date of Birth"
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
              />

              <Input
                label="Condition/Diagnosis"
                type="text"
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                placeholder="e.g., Dementia, Parkinson's Disease"
                helperText="Optional - helps us customize care tracking"
              />

              <Input
                label="Location"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g., Singapore, Ang Mo Kio"
              />

              <Input
                label="Emergency Contact"
                type="tel"
                value={emergencyContact}
                onChange={(e) => setEmergencyContact(e.target.value)}
                placeholder="+65 9123 4567"
              />

              {createRecipientMutation.isError && (
                <div className="bg-error/10 border border-error/20 text-error px-4 py-3 rounded-lg text-sm">
                  {createRecipientMutation.error?.message || 'Failed to create care recipient. Please try again.'}
                </div>
              )}

              <div className="pt-4">
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="w-full"
                  isLoading={createRecipientMutation.isPending}
                >
                  Continue
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
