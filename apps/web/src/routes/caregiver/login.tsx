import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export const Route = createFileRoute('/caregiver/login')({
  component: CaregiverLoginComponent,
});

function CaregiverLoginComponent() {
  const navigate = useNavigate();
  const [pin, setPin] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');

  const loginMutation = useMutation({
    mutationFn: async (pinCode: string) => {
      // For now, just validate PIN exists and navigate
      // TODO: Implement actual PIN verification against caregiver table
      if (pinCode.length !== 6 || !/^\d{6}$/.test(pinCode)) {
        throw new Error('Invalid PIN format');
      }

      // Store caregiver session (mock for now)
      localStorage.setItem('caregiverPin', pinCode);
      return { success: true };
    },
    onSuccess: () => {
      navigate({ to: '/caregiver/form' });
    },
    onError: (err: Error) => {
      setError(err.message || 'Invalid PIN. Please try again.');
    },
  });

  const handlePinChange = (index: number, value: string) => {
    if (value && !/^\d$/.test(value)) return; // Only allow single digits

    const newPin = [...pin];
    newPin[index] = value;
    setPin(newPin);

    // Auto-focus next input
    if (value && index < 5) {
      const nextInput = document.getElementById(`pin-${index + 1}`);
      nextInput?.focus();
    }

    // Auto-submit when all 6 digits are entered
    if (newPin.every(digit => digit !== '') && index === 5) {
      loginMutation.mutate(newPin.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      const prevInput = document.getElementById(`pin-${index - 1}`);
      prevInput?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, 6);
    if (/^\d{6}$/.test(pastedData)) {
      const newPin = pastedData.split('');
      setPin(newPin);
      loginMutation.mutate(pastedData);
    }
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

          <div className="space-y-6">
            <div className="flex justify-center gap-3" onPaste={handlePaste}>
              {pin.map((digit, index) => (
                <input
                  key={index}
                  id={`pin-${index}`}
                  type="tel"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handlePinChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  className="w-14 h-16 text-center text-2xl font-bold border-2 border-gray-300 rounded-lg focus:border-primary-500 focus:ring-2 focus:ring-primary-200 focus:outline-none transition-colors"
                  autoFocus={index === 0}
                />
              ))}
            </div>

            {error && (
              <div className="bg-error/10 border border-error/20 text-error px-4 py-3 rounded-lg text-sm text-center">
                {error}
              </div>
            )}

            <div className="text-center text-sm text-gray-600">
              <p>Don't have a PIN?</p>
              <p className="mt-1">Ask your family member to create an account for you</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
