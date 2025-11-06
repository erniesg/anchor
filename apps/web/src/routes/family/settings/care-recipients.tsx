import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/toast';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { Heart, ArrowLeft, Plus, Edit2, UserCog, Backpack } from 'lucide-react';
import { FamilyLayout } from '@/components/FamilyLayout';
import { authenticatedApiCall, apiCall } from '@/lib/api';

export const Route = createFileRoute('/family/settings/care-recipients')({
  component: CareRecipientsSettingsComponent,
});

interface Caregiver {
  id: string;
  name: string;
  active: boolean;
}

interface CareRecipient {
  id: string;
  name: string;
  dateOfBirth?: string;
  condition?: string;
  location?: string;
  emergencyContact?: string;
  createdAt: string;
  caregivers?: Caregiver[];
}

function CareRecipientsSettingsComponent() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState<CareRecipient | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    dateOfBirth: '',
    condition: '',
    location: '',
    emergencyContact: '',
  });

  const queryClient = useQueryClient();
  const { addToast } = useToast();

  // Fetch care recipients
  const { data: careRecipients, isLoading } = useQuery({
    queryKey: ['care-recipients'],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No authentication token');
      return authenticatedApiCall('/care-recipients', token);
    },
  });

  // Create care recipient mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('No authentication token');
      return authenticatedApiCall('/care-recipients', token, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      setShowAddModal(false);
      setFormData({
        name: '',
        dateOfBirth: '',
        condition: '',
        location: '',
        emergencyContact: '',
      });
      queryClient.invalidateQueries({ queryKey: ['care-recipients'] });
      addToast({
        type: 'success',
        message: 'Care recipient has been added successfully.',
      });
    },
    onError: (error) => {
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to add care recipient. Please try again.',
      });
    },
  });

  const handleAdd = () => {
    if (!formData.name) {
      addToast({
        type: 'error',
        message: 'Name is required',
      });
      return;
    }
    createMutation.mutate(formData);
  };

  const handleEdit = (recipient: CareRecipient) => {
    setSelectedRecipient(recipient);
    setFormData({
      name: recipient.name,
      dateOfBirth: recipient.dateOfBirth || '',
      condition: recipient.condition || '',
      location: recipient.location || '',
      emergencyContact: recipient.emergencyContact || '',
    });
    setShowEditModal(true);
  };

  return (
    <FamilyLayout>
      <div className="bg-gray-50 min-h-screen">
        {/* Page Header */}
        <div className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-4 py-6">
            <Breadcrumb
              items={[
                { label: 'Settings', href: '/family/settings' },
                { label: 'Care Recipients', href: '/family/settings/care-recipients' },
              ]}
            />
            <div className="flex items-center justify-between mt-4">
              <div className="flex items-center gap-3">
                <Heart className="h-8 w-8 text-pink-600" />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Care Recipients</h1>
                  <p className="text-sm text-gray-600">Manage the people you are caring for</p>
                </div>
              </div>
              <Button onClick={() => setShowAddModal(true)} className="bg-pink-600 hover:bg-pink-700">
                <Plus className="h-4 w-4 mr-2" />
                Add Care Recipient
              </Button>
            </div>
          </div>
        </div>

        {/* Care Recipients List */}
        <div className="max-w-7xl mx-auto px-4 py-8">
          {isLoading ? (
            <div className="text-center py-12 text-gray-500">Loading...</div>
          ) : !careRecipients || careRecipients.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Heart className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Care Recipients Yet</h3>
                <p className="text-gray-600 mb-6">Add a care recipient to get started with care logging</p>
                <Button onClick={() => setShowAddModal(true)} className="bg-pink-600 hover:bg-pink-700">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Care Recipient
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {careRecipients.map((recipient: CareRecipient) => (
                <Card key={recipient.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4 flex-1">
                        <div className="p-3 rounded-lg bg-pink-50">
                          <Heart className="h-6 w-6 text-pink-600" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg text-gray-900">{recipient.name}</h3>
                          {recipient.condition && (
                            <p className="text-sm text-gray-600 mt-1">{recipient.condition}</p>
                          )}
                        </div>
                      </div>
                      <Button
                        onClick={() => handleEdit(recipient)}
                        variant="ghost"
                        size="sm"
                        className="text-gray-500 hover:text-gray-700"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      {recipient.dateOfBirth && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Date of Birth:</span>
                          <span className="font-medium">
                            {new Date(recipient.dateOfBirth).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                      {recipient.location && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Location:</span>
                          <span className="font-medium">{recipient.location}</span>
                        </div>
                      )}
                      {recipient.emergencyContact && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Emergency Contact:</span>
                          <span className="font-medium">{recipient.emergencyContact}</span>
                        </div>
                      )}
                      {/* Caregivers Section */}
                      <div className="pt-3 border-t mt-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-700">Assigned Caregivers</span>
                          <span className="text-xs text-gray-500">
                            {recipient.caregivers?.filter(c => c.active).length || 0} active
                          </span>
                        </div>

                        {recipient.caregivers && recipient.caregivers.length > 0 ? (
                          <>
                            <div className="space-y-1 mb-3">
                              {recipient.caregivers.slice(0, 3).map((caregiver) => (
                                <div key={caregiver.id} className="flex items-center gap-2 text-sm">
                                  <div className={`h-2 w-2 rounded-full ${caregiver.active ? 'bg-green-500' : 'bg-gray-400'}`} />
                                  <span className="text-gray-700">{caregiver.name}</span>
                                  {!caregiver.active && (
                                    <span className="text-xs text-gray-500">(Inactive)</span>
                                  )}
                                </div>
                              ))}
                              {recipient.caregivers.length > 3 && (
                                <p className="text-xs text-gray-500 pl-4">
                                  +{recipient.caregivers.length - 3} more
                                </p>
                              )}
                            </div>
                            <Link
                              to="/family/settings/caregivers"
                              search={{ recipientId: recipient.id }}
                              className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium"
                            >
                              <UserCog className="h-4 w-4" />
                              Manage Caregivers →
                            </Link>
                          </>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-sm text-gray-500 italic">No caregivers assigned yet</p>
                            <Link
                              to="/family/settings/caregivers"
                              search={{ recipientId: recipient.id, action: 'add' }}
                              className="inline-flex items-center gap-1 text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition-colors"
                            >
                              <Plus className="h-4 w-4" />
                              Add Caregiver
                            </Link>
                          </div>
                        )}
                      </div>

                      {/* Pack List Section */}
                      <div className="pt-3 border-t mt-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-700">Hospital Emergency Bag</span>
                        </div>
                        <Link
                          to="/family/settings/pack-list"
                          search={{ recipientId: recipient.id, recipientName: recipient.name }}
                          className="text-sm text-purple-600 hover:text-purple-700 flex items-center gap-1 font-medium"
                        >
                          <Backpack className="h-4 w-4" />
                          Manage Pack List →
                        </Link>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Add Care Recipient Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
              <CardHeader className="border-b">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Heart className="h-5 w-5 text-pink-600" />
                  Add Care Recipient
                </h2>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <Input
                    label="Name *"
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Enter full name"
                    required
                  />
                  <Input
                    label="Date of Birth"
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                  />
                  <Input
                    label="Condition/Diagnosis"
                    type="text"
                    value={formData.condition}
                    onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
                    placeholder="e.g., Alzheimer's, Parkinson's"
                  />
                  <Input
                    label="Location"
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="e.g., Home, Nursing Home"
                  />
                  <Input
                    label="Emergency Contact"
                    type="text"
                    value={formData.emergencyContact}
                    onChange={(e) => setFormData({ ...formData, emergencyContact: e.target.value })}
                    placeholder="e.g., +65 9123 4567"
                  />
                </div>
                <div className="flex gap-3 mt-6">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setShowAddModal(false);
                      setFormData({
                        name: '',
                        dateOfBirth: '',
                        condition: '',
                        location: '',
                        emergencyContact: '',
                      });
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAdd}
                    className="flex-1 bg-pink-600 hover:bg-pink-700"
                    disabled={createMutation.isPending}
                  >
                    {createMutation.isPending ? 'Adding...' : 'Add Care Recipient'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Edit Modal - Similar structure, would implement update mutation */}
        {showEditModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
              <CardHeader className="border-b">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Heart className="h-5 w-5 text-pink-600" />
                  Edit Care Recipient
                </h2>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <Input
                    label="Name *"
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Enter full name"
                    required
                  />
                  <Input
                    label="Date of Birth"
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                  />
                  <Input
                    label="Condition/Diagnosis"
                    type="text"
                    value={formData.condition}
                    onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
                    placeholder="e.g., Alzheimer's, Parkinson's"
                  />
                  <Input
                    label="Location"
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="e.g., Home, Nursing Home"
                  />
                  <Input
                    label="Emergency Contact"
                    type="text"
                    value={formData.emergencyContact}
                    onChange={(e) => setFormData({ ...formData, emergencyContact: e.target.value })}
                    placeholder="e.g., +65 9123 4567"
                  />
                </div>
                <div className="flex gap-3 mt-6">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setShowEditModal(false);
                      setSelectedRecipient(null);
                      setFormData({
                        name: '',
                        dateOfBirth: '',
                        condition: '',
                        location: '',
                        emergencyContact: '',
                      });
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      addToast({
                        type: 'info',
                        message: 'Edit functionality coming soon!',
                      });
                    }}
                    className="flex-1 bg-pink-600 hover:bg-pink-700"
                  >
                    Save Changes
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </FamilyLayout>
  );
}
