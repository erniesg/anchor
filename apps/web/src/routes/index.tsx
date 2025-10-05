import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { apiCall } from '@/lib/api';

export const Route = createFileRoute('/')({
  component: HomeComponent,
});

function HomeComponent() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      return apiCall('/health');
    },
  });

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8">
      <div className="max-w-2xl text-center space-y-6">
        <h1 className="text-5xl font-bold text-gray-900">Anchor</h1>
        <p className="text-xl text-gray-600 italic">
          "Structure for Sanity, Connection for the Heart"
        </p>

        <div className="mt-8 p-6 bg-white rounded-lg shadow-md">
          <h2 className="text-2xl font-semibold mb-4">API Status</h2>
          {isLoading && <p className="text-gray-500">Checking API...</p>}
          {error && (
            <div className="text-red-600">
              <p className="font-semibold">❌ API Error</p>
              <p className="text-sm mt-2">Make sure the API is running: pnpm dev</p>
            </div>
          )}
          {data && (
            <div className="text-green-600">
              <p className="font-semibold">✅ API Connected</p>
              <p className="text-sm mt-2">Environment: {data.environment}</p>
              <p className="text-xs text-gray-500 mt-1">{data.timestamp}</p>
            </div>
          )}
        </div>

        <div className="mt-8 space-y-2 text-sm text-gray-600">
          <p>🏥 AI-Powered Caregiving Coordination Platform</p>
          <p>📱 Simple forms • 📊 Smart dashboards • 📈 Trend analysis</p>
        </div>
      </div>
    </div>
  );
}
