import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { Eye, EyeOff } from 'lucide-react';

export const Route = createFileRoute('/auth/login')({
  component: LoginComponent,
});

interface LoginData {
  email: string;
  password: string;
}

function LoginComponent() {
  const navigate = useNavigate();
  const { loginFamily } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const loginMutation = useMutation({
    mutationFn: async (data: LoginData) => {
      await loginFamily(data.email, data.password);
    },
    onSuccess: () => {
      navigate({ to: '/family/dashboard' });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate({ email, password });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-accent-50 px-4">
      <Card className="max-w-md w-full">
        <CardContent className="p-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-primary-700 mb-2">Anchor</h1>
            <p className="text-gray-600 italic text-sm">
              "Structure for Sanity, Connection for the Heart"
            </p>
            <h2 className="mt-6 text-2xl font-semibold text-gray-900">Family Login</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label="Email"
              name="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
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
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
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
            </div>

            {loginMutation.isError && (
              <div className="bg-error/10 border border-error/20 text-error px-4 py-3 rounded-lg text-sm">
                Invalid email or password
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full"
              isLoading={loginMutation.isPending}
            >
              Log in
            </Button>

            <div className="text-center text-sm pt-4">
              <span className="text-gray-600">Don't have an account? </span>
              <Link to="/auth/signup" className="text-primary-600 hover:text-primary-700 font-medium">
                Sign up
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
