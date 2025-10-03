import { createFileRoute, Link } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { UserCog, ArrowLeft, Key, UserX, UserCheck, Copy, Check } from 'lucide-react';

export const Route = createFileRoute('/family/settings/caregivers')({
  component: CaregiversSettingsComponent,
});

interface Caregiver {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  active: boolean;
  createdAt: string;
  deactivatedAt?: string | null;
}

function CaregiversSettingsComponent() {
  const [careRecipient, setCareRecipient] = useState<any>(null);
  const [selectedCaregiver, setSelectedCaregiver] = useState<Caregiver | null>(null);
  const [showResetPinModal, setShowResetPinModal] = useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [showReactivateModal, setShowReactivateModal] = useState(false);
  const [newPin, setNewPin] = useState<string | null>(null);
  const [deactivationReason, setDeactivationReason] = useState('');
  const [copiedPin, setCopiedPin] = useState(false);

  const queryClient = useQueryClient();

  useEffect(() => {
    const recipientData = localStorage.getItem('careRecipient');
    if (recipientData) setCareRecipient(JSON.parse(recipientData));
  }, []);

  // Fetch caregivers
  const { data: caregivers, isLoading } = useQuery({
    queryKey: ['caregivers', careRecipient?.id],
    queryFn: async () => {
      if (!careRecipient?.id) return [];
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/caregivers/recipient/${careRecipient.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch caregivers');
      return response.json();
    },
    enabled: !!careRecipient?.id,
  });

  // Reset PIN mutation
  const resetPinMutation = useMutation({
    mutationFn: async (caregiverId: string) => {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/caregivers/${caregiverId}/reset-pin`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) throw new Error('Failed to reset PIN');
      return response.json();
    },
    onSuccess: (data) => {
      setNewPin(data.pin);
      queryClient.invalidateQueries({ queryKey: ['caregivers'] });
    },
  });

  // Deactivate mutation
  const deactivateMutation = useMutation({
    mutationFn: async ({ caregiverId, reason }: { caregiverId: string; reason: string }) => {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/caregivers/${caregiverId}/deactivate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason }),
      });
      if (!response.ok) throw new Error('Failed to deactivate caregiver');
      return response.json();
    },
    onSuccess: () => {
      setShowDeactivateModal(false);
      setSelectedCaregiver(null);
      setDeactivationReason('');
      queryClient.invalidateQueries({ queryKey: ['caregivers'] });
    },
  });

  // Reactivate mutation
  const reactivateMutation = useMutation({
    mutationFn: async (caregiverId: string) => {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/caregivers/${caregiverId}/reactivate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) throw new Error('Failed to reactivate caregiver');
      return response.json();
    },
    onSuccess: () => {
      setShowReactivateModal(false);
      setSelectedCaregiver(null);
      queryClient.invalidateQueries({ queryKey: ['caregivers'] });
    },
  });

  const handleResetPin = (caregiver: Caregiver) => {
    setSelectedCaregiver(caregiver);
    setShowResetPinModal(true);
    resetPinMutation.mutate(caregiver.id);
  };

  const handleDeactivate = (caregiver: Caregiver) => {
    setSelectedCaregiver(caregiver);
    setShowDeactivateModal(true);
  };

  const handleReactivate = (caregiver: Caregiver) => {
    setSelectedCaregiver(caregiver);
    setShowReactivateModal(true);
  };

  const confirmDeactivate = () => {
    if (selectedCaregiver && deactivationReason.trim()) {
      deactivateMutation.mutate({
        caregiverId: selectedCaregiver.id,
        reason: deactivationReason,
      });
    }
  };

  const confirmReactivate = () => {
    if (selectedCaregiver) {
      reactivateMutation.mutate(selectedCaregiver.id);
    }
  };

  const copyPin = () => {
    if (newPin) {
      navigator.clipboard.writeText(newPin);
      setCopiedPin(true);
      setTimeout(() => setCopiedPin(false), 2000);
    }
  };

  const activeCaregivers = caregivers?.filter((c: Caregiver) => c.active) || [];
  const inactiveCaregivers = caregivers?.filter((c: Caregiver) => !c.active) || [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <UserCog className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Manage Caregivers</h1>
                <p className="text-sm text-gray-600">Reset PINs, deactivate, or reactivate caregivers</p>
              </div>
            </div>
            <Link to="/family/settings">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Settings
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Caregivers List */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {isLoading ? (
          <p className="text-center text-gray-600">Loading caregivers...</p>
        ) : (
          <>
            {/* Active Caregivers */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Active Caregivers ({activeCaregivers.length})</h2>
              <div className="space-y-4">
                {activeCaregivers.length === 0 ? (
                  <p className="text-gray-600">No active caregivers</p>
                ) : (
                  activeCaregivers.map((caregiver: Caregiver) => (
                    <Card key={caregiver.id}>
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg text-gray-900">{caregiver.name}</h3>
                            <div className="mt-1 space-y-1">
                              {caregiver.phone && <p className="text-sm text-gray-600">Phone: {caregiver.phone}</p>}
                              {caregiver.email && <p className="text-sm text-gray-600">Email: {caregiver.email}</p>}
                              <p className="text-xs text-gray-500">
                                Created: {new Date(caregiver.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              onClick={() => handleResetPin(caregiver)}
                              variant="outline"
                              size="sm"
                              className="text-blue-600 border-blue-200 hover:bg-blue-50"
                            >
                              <Key className="h-4 w-4 mr-2" />
                              Reset PIN
                            </Button>
                            <Button
                              onClick={() => handleDeactivate(caregiver)}
                              variant="outline"
                              size="sm"
                              className="text-red-600 border-red-200 hover:bg-red-50"
                            >
                              <UserX className="h-4 w-4 mr-2" />
                              Deactivate
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>

            {/* Inactive Caregivers */}
            {inactiveCaregivers.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Inactive Caregivers ({inactiveCaregivers.length})</h2>
                <div className="space-y-4">
                  {inactiveCaregivers.map((caregiver: Caregiver) => (
                    <Card key={caregiver.id} className="opacity-60">
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg text-gray-900">{caregiver.name}</h3>
                            <div className="mt-1 space-y-1">
                              {caregiver.phone && <p className="text-sm text-gray-600">Phone: {caregiver.phone}</p>}
                              {caregiver.email && <p className="text-sm text-gray-600">Email: {caregiver.email}</p>}
                              <p className="text-xs text-red-600 font-medium">
                                Deactivated: {caregiver.deactivatedAt ? new Date(caregiver.deactivatedAt).toLocaleDateString() : 'N/A'}
                              </p>
                            </div>
                          </div>
                          <Button
                            onClick={() => handleReactivate(caregiver)}
                            variant="outline"
                            size="sm"
                            className="text-green-600 border-green-200 hover:bg-green-50"
                          >
                            <UserCheck className="h-4 w-4 mr-2" />
                            Reactivate
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Reset PIN Modal */}
      {showResetPinModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <h3 className="text-lg font-semibold text-gray-900">PIN Reset Successful</h3>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">
                New PIN for <span className="font-semibold">{selectedCaregiver?.name}</span>:
              </p>
              <div className="flex items-center gap-2 mb-6">
                <Input value={newPin || 'Generating...'} readOnly className="text-2xl font-mono text-center" />
                <Button onClick={copyPin} variant="outline" size="sm">
                  {copiedPin ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-gray-500 mb-4">
                ⚠️ Save this PIN securely. It will not be shown again.
              </p>
              <Button
                onClick={() => {
                  setShowResetPinModal(false);
                  setNewPin(null);
                  setSelectedCaregiver(null);
                }}
                className="w-full"
              >
                Done
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Deactivate Modal */}
      {showDeactivateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <h3 className="text-lg font-semibold text-red-600">Deactivate Caregiver</h3>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">
                Are you sure you want to deactivate <span className="font-semibold">{selectedCaregiver?.name}</span>?
              </p>
              <label className="block text-sm font-medium text-gray-700 mb-2">Reason</label>
              <Input
                value={deactivationReason}
                onChange={(e) => setDeactivationReason(e.target.value)}
                placeholder="e.g., Resigned, Replaced, etc."
                className="mb-4"
              />
              <p className="text-xs text-gray-500 mb-4">
                ⚠️ This will prevent future access but preserve historical logs.
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    setShowDeactivateModal(false);
                    setDeactivationReason('');
                    setSelectedCaregiver(null);
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={confirmDeactivate}
                  disabled={!deactivationReason.trim() || deactivateMutation.isPending}
                  className="flex-1 bg-red-600 hover:bg-red-700"
                >
                  {deactivateMutation.isPending ? 'Deactivating...' : 'Deactivate'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Reactivate Modal */}
      {showReactivateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <h3 className="text-lg font-semibold text-green-600">Reactivate Caregiver</h3>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">
                Are you sure you want to reactivate <span className="font-semibold">{selectedCaregiver?.name}</span>?
              </p>
              <p className="text-xs text-gray-500 mb-4">
                This will restore their access to submit care logs.
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    setShowReactivateModal(false);
                    setSelectedCaregiver(null);
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={confirmReactivate}
                  disabled={reactivateMutation.isPending}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  {reactivateMutation.isPending ? 'Reactivating...' : 'Reactivate'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
