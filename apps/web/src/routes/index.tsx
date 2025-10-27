import { createFileRoute, Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Heart, Users, BarChart3, Clock, Shield, Smartphone } from 'lucide-react';

export const Route = createFileRoute('/')({
  component: HomeComponent,
});

function HomeComponent() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-accent-50">
      {/* Hero Section */}
      <div className="max-w-7xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-6xl font-bold text-primary-700 mb-4">Anchor</h1>
          <p className="text-2xl text-gray-600 italic mb-8">
            "Structure for Sanity, Connection for the Heart"
          </p>
          <p className="text-xl text-gray-700 max-w-3xl mx-auto mb-12">
            AI-powered caregiving coordination platform connecting families, caregivers, and care recipients with real-time insights and seamless communication.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
            <Link to="/auth/signup">
              <Button size="lg" variant="primary" className="w-64 text-lg py-6">
                <Users className="h-6 w-6 mr-2" />
                Get Started for Families
              </Button>
            </Link>
            <Link to="/caregiver/login">
              <Button size="lg" variant="secondary" className="w-64 text-lg py-6">
                <Heart className="h-6 w-6 mr-2" />
                Caregiver Login
              </Button>
            </Link>
          </div>

          {/* Login Links for Existing Users */}
          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center text-sm mb-16">
            <p className="text-gray-600">Already have an account?</p>
            <Link to="/auth/login" className="text-primary-600 hover:text-primary-700 font-semibold underline">
              Family Member Login →
            </Link>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-6 mt-16">
            <Card className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6 text-center">
                <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Smartphone className="h-8 w-8 text-primary-700" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Simple Mobile Forms</h3>
                <p className="text-gray-600">
                  Caregivers submit daily reports in minutes with intuitive, mobile-friendly forms designed for ease of use.
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6 text-center">
                <div className="w-16 h-16 bg-accent-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <BarChart3 className="h-8 w-8 text-accent-700" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Smart Dashboards</h3>
                <p className="text-gray-600">
                  Family members access real-time health trends, vitals tracking, and comprehensive care logs from anywhere.
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6 text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Clock className="h-8 w-8 text-green-700" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Real-Time Updates</h3>
                <p className="text-gray-600">
                  Stay connected with instant notifications and live updates on your loved one's care and wellbeing.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* How It Works */}
          <div className="mt-20">
            <h2 className="text-3xl font-bold text-gray-900 mb-8">How It Works</h2>
            <div className="max-w-4xl mx-auto">
              <div className="grid md:grid-cols-3 gap-8">
                <div className="text-center">
                  <div className="w-12 h-12 bg-primary-600 text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                    1
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Family Signs Up</h3>
                  <p className="text-gray-600">
                    Create your account, add your loved one's information, and set up caregiver accounts.
                  </p>
                </div>

                <div className="text-center">
                  <div className="w-12 h-12 bg-accent-600 text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                    2
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Caregivers Log In</h3>
                  <p className="text-gray-600">
                    Caregivers receive a secure PIN and submit daily care reports through simple mobile forms.
                  </p>
                </div>

                <div className="text-center">
                  <div className="w-12 h-12 bg-green-600 text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                    3
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Monitor & Connect</h3>
                  <p className="text-gray-600">
                    View comprehensive dashboards, track health trends, and stay connected with your care team.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Security Badge */}
          <div className="mt-16 flex items-center justify-center gap-2 text-gray-600">
            <Shield className="h-5 w-5 text-green-600" />
            <span className="text-sm">Secure, private, and compliant with healthcare standards</span>
          </div>

          {/* Footer CTA */}
          <div className="mt-12 pt-12 border-t border-gray-200">
            <p className="text-lg text-gray-700 mb-4">Ready to get started?</p>
            <Link to="/auth/signup">
              <Button size="lg" variant="primary" className="px-8">
                Sign Up Now - It's Free
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
