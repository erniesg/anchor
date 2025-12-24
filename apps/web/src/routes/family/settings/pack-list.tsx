import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PackList } from '@/components/PackList';
import type { PackListItem } from '@/components/PackList';
import { FamilyLayout } from '@/components/FamilyLayout';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { ArrowLeft, Backpack } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { authenticatedApiCall } from '@/lib/api';
import { useToast } from '@/lib/toast';

export const Route = createFileRoute('/family/settings/pack-list')({
  component: PackListManagementComponent,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      recipientId: (search.recipientId as string) || '',
      recipientName: (search.recipientName as string) || '',
    };
  },
});

function PackListManagementComponent() {
  const navigate = useNavigate();
  const { recipientId, recipientName } = Route.useSearch();
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  // Fetch pack list
  const { data: packListData, isLoading } = useQuery({
    queryKey: ['pack-list', recipientId],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No authentication token');
      return authenticatedApiCall(`/pack-lists/recipient/${recipientId}`, token);
    },
    enabled: !!recipientId,
  });

  // Save pack list mutation
  const saveMutation = useMutation({
    mutationFn: async (items: PackListItem[]) => {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No authentication token');
      return authenticatedApiCall('/pack-lists', token, {
        method: 'POST',
        body: JSON.stringify({
          careRecipientId: recipientId,
          items,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pack-list', recipientId] });
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
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No authentication token');
      return authenticatedApiCall(`/pack-lists/${recipientId}/verify`, token, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pack-list', recipientId] });
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

  if (!recipientId) {
    return (
      <FamilyLayout>
        <div className="bg-gray-50 min-h-screen">
          <div className="max-w-4xl mx-auto px-4 py-8">
            <div className="text-center py-12">
              <p className="text-gray-600">No care recipient selected.</p>
              <Button
                onClick={() => navigate({ to: '/family/settings/care-recipients' })}
                className="mt-4"
              >
                Go to Care Recipients
              </Button>
            </div>
          </div>
        </div>
      </FamilyLayout>
    );
  }

  return (
    <FamilyLayout>
      <div className="bg-gray-50 min-h-screen">
        {/* Page Header */}
        <div className="bg-white border-b">
          <div className="max-w-4xl mx-auto px-4 py-6">
            <Breadcrumb
              items={[
                { label: 'Settings', href: '/family/settings' },
                { label: 'Care Recipients', href: '/family/settings/care-recipients' },
                { label: 'Hospital Bag', href: '/family/settings/pack-list' },
              ]}
            />
            <div className="flex items-center justify-between mt-4">
              <div className="flex items-center gap-3">
                <Backpack className="h-8 w-8 text-blue-600" />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Hospital Bag Preparedness</h1>
                  <p className="text-sm text-gray-600">
                    {recipientName ? `For ${recipientName}` : 'Manage pack list items'}
                  </p>
                </div>
              </div>
              <Button
                onClick={() => navigate({ to: '/family/settings/care-recipients' })}
                variant="outline"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </div>
          </div>
        </div>

        {/* Pack List Content */}
        <div className="max-w-4xl mx-auto px-4 py-8">
          {isLoading ? (
            <div className="text-center py-12 text-gray-500">Loading pack list...</div>
          ) : (
            <PackList
              careRecipientId={recipientId}
              initialData={packListData}
              onSave={handleSave}
              onVerify={handleVerify}
            />
          )}
        </div>
      </div>
    </FamilyLayout>
  );
}
