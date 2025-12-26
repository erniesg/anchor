import { createFileRoute, Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { Heart, Users, Shield } from 'lucide-react';

export const Route = createFileRoute('/')({
  component: HomeComponent,
});

function HomeComponent() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-pink-50">
      {/* Hero Section */}
      <div className="max-w-5xl mx-auto px-4 py-20 sm:px-6 lg:px-8">
        <div className="text-center">
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
              <Heart className="h-10 w-10 text-white" fill="white" />
            </div>
          </div>

          <h1 className="text-5xl sm:text-6xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent mb-4">
            Anchor
          </h1>
          <p className="text-lg text-gray-500 italic mb-12">
            Structure for Sanity, Connection for the Heart
          </p>

          {/* Main CTA */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
            <Link to="/auth/signup">
              <Button size="lg" className="w-56 h-14 text-base bg-blue-600 hover:bg-blue-700 rounded-xl shadow-lg shadow-blue-200">
                <Users className="h-5 w-5 mr-2" />
                Family Sign Up
              </Button>
            </Link>
            <Link to="/caregiver/login">
              <Button size="lg" variant="outline" className="w-56 h-14 text-base border-2 border-pink-300 text-pink-600 hover:bg-pink-50 rounded-xl">
                <Heart className="h-5 w-5 mr-2" />
                Caregiver Login
              </Button>
            </Link>
          </div>

          <Link to="/auth/login" className="text-sm text-gray-500 hover:text-blue-600 transition-colors">
            Already have an account? <span className="font-semibold">Log in</span>
          </Link>
        </div>

        {/* Spacer */}
        <div className="my-16"></div>

        {/* Value Props - Minimal */}
        <div className="grid sm:grid-cols-3 gap-8 max-w-3xl mx-auto">
          <div className="text-center">
            <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">Simple Daily Logs</h3>
            <p className="text-sm text-gray-500">Quick mobile forms for caregivers</p>
          </div>

          <div className="text-center">
            <div className="w-14 h-14 bg-pink-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-pink-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">Health Insights</h3>
            <p className="text-sm text-gray-500">Track trends over time</p>
          </div>

          <div className="text-center">
            <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">Stay Connected</h3>
            <p className="text-sm text-gray-500">Real-time family updates</p>
          </div>
        </div>

        {/* Trust Badge */}
        <div className="mt-20 flex items-center justify-center gap-2 text-gray-400">
          <Shield className="h-4 w-4" />
          <span className="text-xs">Secure & Private</span>
        </div>
      </div>
    </div>
  );
}
