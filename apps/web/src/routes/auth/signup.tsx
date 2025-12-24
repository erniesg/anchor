import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { Eye, EyeOff } from 'lucide-react';

export const Route = createFileRoute('/auth/signup')({
  component: SignupComponent,
});

interface SignupData {
  email: string;
  name: string;
  password: string;
  phone?: string;
}

function SignupComponent() {
  const navigate = useNavigate();
  const { signup } = useAuth();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  const signupMutation = useMutation({
    mutationFn: async (data: SignupData) => {
      await signup(data.email, data.name, data.password, data.phone);
    },
    onSuccess: () => {
      navigate({ to: '/family/onboarding' });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate password confirmation
    if (password !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    setPasswordError('');
    signupMutation.mutate({ email, name, password, phone: phone || undefined });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-accent-50 px-4 py-12">
      <Card className="max-w-md w-full">
        <CardContent className="p-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-primary-700 mb-2">Anchor</h1>
            <p className="text-gray-600 italic text-sm">
              "Structure for Sanity, Connection for the Heart"
            </p>
            <h2 className="mt-6 text-2xl font-semibold text-gray-900">Create Family Account</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Full Name"
              name="name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Doe"
            />

            <Input
              label="Email"
              name="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />

            <Input
              label="Phone (optional)"
              name="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+65 9123 4567"
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password *
              </label>
              <div className="relative">
                <input
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">Minimum 8 characters</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirm Password *
              </label>
              <div className="relative">
                <input
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your password"
                  className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {passwordError && (
              <div className="bg-error/10 border border-error/20 text-error px-4 py-3 rounded-lg text-sm">
                {passwordError}
              </div>
            )}

            {signupMutation.isError && (
              <div className="bg-error/10 border border-error/20 text-error px-4 py-3 rounded-lg text-sm">
                {signupMutation.error.message}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full mt-6"
              isLoading={signupMutation.isPending}
            >
              Create Account
            </Button>

            <div className="text-center text-sm pt-4">
              <span className="text-gray-600">Already have an account? </span>
              <Link to="/auth/login" className="text-primary-600 hover:text-primary-700 font-medium">
                Log in
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
