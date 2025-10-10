import { Link, useLocation, useNavigate } from '@tanstack/react-router';
import { Home, Settings, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface FamilyLayoutProps {
  children: ReactNode;
}

export function FamilyLayout({ children }: FamilyLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [careRecipient, setCareRecipient] = useState<any>(null);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    const recipientData = localStorage.getItem('careRecipient');
    if (userData) setUser(JSON.parse(userData));
    if (recipientData) setCareRecipient(JSON.parse(recipientData));
    setIsChecking(false);
  }, []);

  // Redirect to onboarding if no care recipient exists
  useEffect(() => {
    if (!isChecking && user && !careRecipient && !location.pathname.includes('/onboarding')) {
      navigate({ to: '/family/onboarding' });
    }
  }, [user, careRecipient, isChecking, navigate, location.pathname]);

  // Show nothing while checking to avoid flash
  if (isChecking) {
    return null;
  }

  const getBreadcrumbs = (): BreadcrumbItem[] => {
    const path = location.pathname;

    if (path === '/family/dashboard') {
      return [{ label: 'Dashboard' }];
    }

    if (path.startsWith('/family/settings')) {
      const breadcrumbs: BreadcrumbItem[] = [
        { label: 'Dashboard', href: '/family/dashboard' },
        { label: 'Settings', href: '/family/settings' }
      ];

      if (path.includes('/caregivers')) {
        breadcrumbs.push({ label: 'Caregivers' });
      } else if (path.includes('/family-members')) {
        breadcrumbs.push({ label: 'Family Members' });
      } else if (path.includes('/profile')) {
        breadcrumbs.push({ label: 'Profile' });
      }

      return breadcrumbs;
    }

    return [{ label: 'Dashboard', href: '/family/dashboard' }];
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation Bar */}
      <nav className="bg-white border-b sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo & Breadcrumbs */}
            <div className="flex items-center gap-4">
              <Link to="/family/dashboard" className="flex items-center gap-2 text-primary-600 hover:text-primary-700">
                <Home className="h-5 w-5" />
                <span className="font-bold text-lg hidden sm:inline">Anchor</span>
              </Link>

              {/* Breadcrumbs */}
              <div className="flex items-center gap-2 text-sm">
                {breadcrumbs.map((crumb, index) => (
                  <div key={index} className="flex items-center gap-2">
                    {index > 0 && <ChevronRight className="h-4 w-4 text-gray-400" />}
                    {crumb.href ? (
                      <Link
                        to={crumb.href}
                        className="text-gray-600 hover:text-gray-900 transition-colors"
                      >
                        {crumb.label}
                      </Link>
                    ) : (
                      <span className="text-gray-900 font-medium">{crumb.label}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-3">
              <Link to="/family/dashboard">
                <button className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
                  <Home className="h-5 w-5" />
                  <span className="sr-only">Dashboard</span>
                </button>
              </Link>
              <Link to="/family/settings">
                <button className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
                  <Settings className="h-5 w-5" />
                  <span className="sr-only">Settings</span>
                </button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Page Content */}
      <main>{children}</main>
    </div>
  );
}
