import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { Eye, EyeOff } from 'lucide-react';

export const Route = createFileRoute('/caregiver/login')({
  component: CaregiverLoginComponent,
});

function CaregiverLoginComponent() {
  const navigate = useNavigate();
  const { loginCaregiver } = useAuth();
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState('');

  const loginMutation = useMutation({
    mutationFn: async (data: { username: string; pin: string }) => {
      await loginCaregiver(data.username, data.pin);
    },
    onSuccess: () => {
      navigate({ to: '/caregiver/form' });
    },
    onError: (err: Error) => {
      setError(err.message || 'Invalid username or PIN. Please try again.');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setError('Please enter your username');
      return;
    }
    if (pin.length !== 6 || !/^\d{6}$/.test(pin)) {
      setError('PIN must be exactly 6 digits');
      return;
    }
    setError('');
    loginMutation.mutate({ username: username.trim(), pin });
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
            <p className="text-gray-600">Enter your username and PIN</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5" autoComplete="on">
            <Input
              label="Username"
              name="username"
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. happy-panda-42"
              autoComplete="username"
            />

            <div>
              <label htmlFor="pin-input" className="block text-sm font-medium text-gray-700 mb-1">
                PIN *
              </label>
              <div className="relative">
                <input
                  id="pin-input"
                  name="pin"
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  pattern="\d{6}"
                  required
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="Enter 6-digit PIN"
                  autoComplete="current-password"
                  className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg
                    transition-colors
                    focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                    autofill:bg-blue-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none"
                  aria-label={showPin ? 'Hide PIN' : 'Show PIN'}
                  tabIndex={-1}
                >
                  {showPin ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

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
