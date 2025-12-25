import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PackList } from '@/components/PackList';
import type { PackListItem } from '@/components/PackList';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { authenticatedApiCall } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { useAuth } from '@/contexts/AuthContext';

export const Route = createFileRoute('/caregiver/pack-list')({
  component: CaregiverPackListComponent,
});

function CaregiverPackListComponent() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const { token, careRecipient } = useAuth();

  // Get care recipient info from auth context
  const careRecipientId = careRecipient?.id;
  const careRecipientName = careRecipient?.name;

  // Fetch pack list
  const { data: packListData, isLoading } = useQuery({
    queryKey: ['pack-list', careRecipientId],
    queryFn: async () => {
      if (!token) throw new Error('No authentication token');
      return authenticatedApiCall(`/pack-lists/recipient/${careRecipientId}`, token);
    },
    enabled: !!careRecipientId && !!token,
  });

  // Save pack list mutation
  const saveMutation = useMutation({
    mutationFn: async (items: PackListItem[]) => {
      if (!token) throw new Error('No authentication token');
      return authenticatedApiCall('/pack-lists', token, {
        method: 'POST',
        body: JSON.stringify({
          careRecipientId,
          items,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pack-list', careRecipientId] });
      addToast({
        type: 'success',
        message: 'Hospital bag saved successfully',
      });
    },
    onError: (error) => {
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to save hospital bag',
      });
    },
  });

  // Verify pack list mutation
  const verifyMutation = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error('No authentication token');
      return authenticatedApiCall(`/pack-lists/${careRecipientId}/verify`, token, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pack-list', careRecipientId] });
      addToast({
        type: 'success',
        message: 'Hospital bag verified successfully',
      });
    },
    onError: (error) => {
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to verify hospital bag',
      });
    },
  });

  const handleSave = async (items: PackListItem[]) => {
    await saveMutation.mutateAsync(items);
  };

  const handleVerify = async () => {
    await verifyMutation.mutateAsync();
  };

  if (!careRecipientId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center">
        <Card className="max-w-sm mx-4">
          <CardContent className="py-8 text-center">
            <p className="text-gray-600 mb-4">No care recipient information found.</p>
            <Button onClick={() => navigate({ to: '/caregiver/login' })}>
              Go to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-purple-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading hospital bag...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 pb-24">
      {/* Header - matching time-based form style */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate({ to: '/caregiver/form' })}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl">🎒</span>
                  <h1 className="text-lg font-bold text-gray-900">Hospital Bag</h1>
                </div>
                <p className="text-xs text-gray-500">
                  {careRecipientName ? `For ${careRecipientName}` : 'Manage pack list'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content - matching time-based form style */}
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Info Card */}
        <Card className="border-purple-200 bg-purple-50">
          <CardContent className="py-4">
            <p className="text-sm text-purple-800">
              Keep this list ready for emergency hospital visits. Check off items as you pack them.
            </p>
          </CardContent>
        </Card>

        {/* Pack List Component */}
        <PackList
          careRecipientId={careRecipientId}
          initialData={packListData}
          onSave={handleSave}
          onVerify={handleVerify}
        />
      </div>
    </div>
  );
}
