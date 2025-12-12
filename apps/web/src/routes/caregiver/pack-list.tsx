import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PackList } from '@/components/PackList';
import type { PackListItem } from '@/components/PackList';
import { ArrowLeft, Backpack } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { authenticatedApiCall } from '@/lib/api';
import { useToast } from '@/lib/toast';

export const Route = createFileRoute('/caregiver/pack-list')({
  component: CaregiverPackListComponent,
});

function CaregiverPackListComponent() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  // Get caregiver info from localStorage
  const careRecipientId = localStorage.getItem('careRecipientId');
  const careRecipientName = localStorage.getItem('careRecipientName');

  // Fetch pack list
  const { data: packListData, isLoading } = useQuery({
    queryKey: ['pack-list', careRecipientId],
    queryFn: async () => {
      const token = localStorage.getItem('caregiverToken');
      if (!token) throw new Error('No authentication token');
      return authenticatedApiCall(`/pack-lists/recipient/${careRecipientId}`, token);
    },
    enabled: !!careRecipientId,
  });

  // Save pack list mutation
  const saveMutation = useMutation({
    mutationFn: async (items: PackListItem[]) => {
      const token = localStorage.getItem('caregiverToken');
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
        message: 'Pack list saved successfully',
      });
    },
    onError: (error) => {
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to save pack list',
      });
    },
  });

  // Verify pack list mutation
  const verifyMutation = useMutation({
    mutationFn: async () => {
      const token = localStorage.getItem('caregiverToken');
      if (!token) throw new Error('No authentication token');
      return authenticatedApiCall(`/pack-lists/${careRecipientId}/verify`, token, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pack-list', careRecipientId] });
      addToast({
        type: 'success',
        message: 'Pack list verified successfully',
      });
    },
    onError: (error) => {
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to verify pack list',
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
      <div className="bg-gray-50 min-h-screen">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="text-center py-12">
            <p className="text-gray-600">No care recipient information found.</p>
            <Button
              onClick={() => navigate({ to: '/caregiver/login' })}
              className="mt-4"
            >
              Go to Login
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Page Header */}
      <div className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Backpack className="h-7 w-7 text-purple-600" />
              <div>
                <h1 className="text-xl font-bold text-gray-900">Hospital Emergency Bag</h1>
                <p className="text-sm text-gray-600">
                  {careRecipientName ? `For ${careRecipientName}` : 'Manage pack list items'}
                </p>
              </div>
            </div>
            <Button
              onClick={() => navigate({ to: '/caregiver/form' })}
              variant="outline"
              size="sm"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Form
            </Button>
          </div>
        </div>
      </div>

      {/* Pack List Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {isLoading ? (
          <div className="text-center py-12 text-gray-500">Loading pack list...</div>
        ) : (
          <>
            {/* Info Banner */}
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-semibold text-blue-900 mb-1 flex items-center gap-2">
                <Backpack className="h-5 w-5" />
                Quick Reference: Hospital Emergency Bag
              </h3>
              <p className="text-sm text-blue-800">
                This is the master list of items to bring in case of emergency hospital visits.
                Check off items as you pack them, and update the list if items change.
              </p>
            </div>

            <PackList
              careRecipientId={careRecipientId}
              initialData={packListData}
              onSave={handleSave}
              onVerify={handleVerify}
            />
          </>
        )}
      </div>
    </div>
  );
}
