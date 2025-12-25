import { createFileRoute, Link } from '@tanstack/react-router';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { apiCall } from '@/lib/api';
import { ArrowLeft, Mail, CheckCircle } from 'lucide-react';

export const Route = createFileRoute('/auth/forgot-password')({
  component: ForgotPasswordComponent,
});

function ForgotPasswordComponent() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const forgotPasswordMutation = useMutation({
    mutationFn: async (email: string) => {
      return apiCall<{ success: boolean; message: string }>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
    },
    onSuccess: () => {
      setSubmitted(true);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      forgotPasswordMutation.mutate(email.trim());
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-accent-50 px-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Check your email</h2>
            <p className="text-gray-600 mb-6">
              If an account exists with <span className="font-medium">{email}</span>,
              we've sent a password reset link.
            </p>
            <p className="text-sm text-gray-500 mb-6">
              The link will expire in 1 hour. Check your spam folder if you don't see it.
            </p>
            <Link to="/auth/login">
              <Button variant="outline" className="w-full">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Login
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-accent-50 px-4">
      <Card className="max-w-md w-full">
        <CardContent className="p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="h-8 w-8 text-primary-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Forgot your password?</h1>
            <p className="text-gray-600 text-sm">
              Enter your email address and we'll send you a link to reset your password.
            </p>
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

            {forgotPasswordMutation.isError && (
              <div className="bg-error/10 border border-error/20 text-error px-4 py-3 rounded-lg text-sm">
                Something went wrong. Please try again.
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full"
              isLoading={forgotPasswordMutation.isPending}
            >
              Send Reset Link
            </Button>

            <div className="text-center pt-4">
              <Link to="/auth/login" className="text-primary-600 hover:text-primary-700 font-medium text-sm inline-flex items-center gap-1">
                <ArrowLeft className="h-4 w-4" />
                Back to Login
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
