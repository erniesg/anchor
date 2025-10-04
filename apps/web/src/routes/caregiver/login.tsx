import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';

export const Route = createFileRoute('/caregiver/login')({
  component: CaregiverLoginComponent,
});

function CaregiverLoginComponent() {
  const navigate = useNavigate();
  const [caregiverId, setCaregiverId] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const loginMutation = useMutation({
    mutationFn: async (data: { caregiverId: string; pin: string }) => {
      const response = await fetch('/api/auth/caregiver/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Login failed');
      }
      return response.json();
    },
    onSuccess: (data) => {
      localStorage.setItem('caregiverToken', data.token);
      localStorage.setItem('caregiver', JSON.stringify(data.caregiver));
      // Store care recipient info for form access
      localStorage.setItem('careRecipient', JSON.stringify({ id: data.caregiver.careRecipientId }));
      navigate({ to: '/caregiver/form' });
    },
    onError: (err: Error) => {
      setError(err.message || 'Invalid PIN. Please try again.');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length !== 6 || !/^\d{6}$/.test(pin)) {
      setError('PIN must be exactly 6 digits');
      return;
    }
    setError('');
    loginMutation.mutate({ caregiverId, pin });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-accent-50 flex items-center justify-center px-4">
      <Card className="max-w-md w-full">
        <CardContent className="p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-accent-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-accent-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-primary-700 mb-2">Caregiver Login</h1>
            <p className="text-gray-600">Enter your 6-digit PIN</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label="Caregiver ID"
              name="caregiverId"
              type="text"
              required
              value={caregiverId}
              onChange={(e) => setCaregiverId(e.target.value)}
              placeholder="Enter your caregiver ID"
            />

            <Input
              label="PIN"
              name="pin"
              type="password"
              inputMode="numeric"
              required
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="Enter 6-digit PIN"
            />

            {error && (
              <div className="bg-error/10 border border-error/20 text-error px-4 py-3 rounded-lg text-sm text-center">
                {error}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full"
              isLoading={loginMutation.isPending}
            >
              Login
            </Button>

            <div className="text-center text-sm text-gray-600">
              <p>Don't have a PIN?</p>
              <p className="mt-1">Ask your family member to create an account for you</p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
