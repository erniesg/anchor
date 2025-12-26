import { Link, useLocation, useNavigate } from '@tanstack/react-router';
import { Home, Settings, ChevronRight, User, LogOut } from 'lucide-react';
import { useEffect, useState, useRef } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';

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
  const { user, careRecipient, isLoading, logoutFamily } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Redirect to onboarding if no care recipient exists
  useEffect(() => {
    if (!isLoading && user && !careRecipient && !location.pathname.includes('/onboarding')) {
      navigate({ to: '/family/onboarding' });
    }
  }, [user, careRecipient, isLoading, navigate, location.pathname]);

  const handleLogout = () => {
    logoutFamily();
    window.location.href = '/auth/login';
  };

  // Show nothing while loading to avoid flash
  if (isLoading) {
    return null;
  }

  const getBreadcrumbs = (): BreadcrumbItem[] => {
    const path = location.pathname;

    // No breadcrumbs on dashboard - home icon is enough
    if (path === '/family/dashboard') {
      return [];
    }

    if (path.startsWith('/family/settings')) {
      const breadcrumbs: BreadcrumbItem[] = [
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

    return [];
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
            <div className="flex items-center gap-1">
              <Link to="/family/settings">
                <button className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
                  <Settings className="h-5 w-5" />
                  <span className="sr-only">Settings</span>
                </button>
              </Link>

              {/* User Menu */}
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                    <span className="text-primary-700 font-semibold text-sm">
                      {user?.name?.charAt(0).toUpperCase() || 'U'}
                    </span>
                  </div>
                  <span className="hidden sm:inline text-sm font-medium">{user?.name}</span>
                </button>

                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border py-1 z-50">
                    <div className="px-4 py-2 border-b">
                      <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                      <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                    </div>
                    <Link
                      to="/family/settings/profile"
                      onClick={() => setShowUserMenu(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <User className="h-4 w-4" />
                      Profile
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full text-left"
                    >
                      <LogOut className="h-4 w-4" />
                      Log out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Page Content */}
      <main>{children}</main>
    </div>
  );
}
