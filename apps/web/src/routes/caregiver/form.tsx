import { createFileRoute, Outlet, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export const Route = createFileRoute('/caregiver/form')({
  component: FormLayoutComponent,
});

function FormLayoutComponent() {
  const { isCaregiver, token, isLoading } = useAuth();
  const navigate = useNavigate();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    if (isLoading) return;

    // Check if caregiver is logged in
    if (!isCaregiver || !token) {
      navigate({ to: '/caregiver/login' });
    } else {
      setIsChecking(false);
    }
  }, [isCaregiver, token, isLoading, navigate]);

  if (isLoading || isChecking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-accent-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
