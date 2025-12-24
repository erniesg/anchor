import { createFileRoute, Link } from '@tanstack/react-router';
import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/lib/toast';
import { UserCog, ArrowLeft, Key, UserX, UserCheck, Copy, Check, Search, SlidersHorizontal, Edit, Plus, Heart, ExternalLink } from 'lucide-react';
import { FamilyLayout } from '@/components/FamilyLayout';
import { authenticatedApiCall } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

export const Route = createFileRoute('/family/settings/caregivers')({
  component: CaregiversSettingsComponent,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      recipientId: (search.recipientId as string) || undefined,
      action: (search.action as string) || undefined,
    };
  },
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


interface CareRecipient {
  id: string;
  name: string;
  condition?: string;
}

function CaregiversSettingsComponent() {
  const { recipientId, action } = Route.useSearch();
  const { user, token } = useAuth();
  const [selectedRecipientId, setSelectedRecipientId] = useState<string | null>(recipientId || null);
  const [selectedCaregiver, setSelectedCaregiver] = useState<Caregiver | null>(null);
  const [showResetPinModal, setShowResetPinModal] = useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [showReactivateModal, setShowReactivateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newPin, setNewPin] = useState<string | null>(null);
  const [newCaregiverId, setNewCaregiverId] = useState<string | null>(null);
  const [deactivationReason, setDeactivationReason] = useState('');
  const [copiedPin, setCopiedPin] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null); // Track which ID was copied
  const userRole = user?.role as 'family_admin' | 'family_member' | null;

  // Add caregiver form state
  const [addForm, setAddForm] = useState({
    name: '',
    phone: '',
    email: '',
    language: 'en',
  });

  // Edit form state
  const [editForm, setEditForm] = useState({
    name: '',
    phone: '',
    email: '',
  });

  // Search, filter, and sort state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'date'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Caregiver login URL copy state
  const [copiedLoginUrl, setCopiedLoginUrl] = useState(false);

  const queryClient = useQueryClient();
  const { addToast } = useToast();

  const caregiverLoginUrl = typeof window !== 'undefined' ? window.location.origin + '/caregiver/login' : '';

  const copyCaregiverLoginUrl = () => {
    navigator.clipboard.writeText(caregiverLoginUrl);
    setCopiedLoginUrl(true);
    setTimeout(() => setCopiedLoginUrl(false), 2000);
  };

  // Fetch all care recipients
  const { data: careRecipients, isLoading: recipientsLoading } = useQuery({
    queryKey: ['care-recipients'],
    queryFn: async () => {
      if (!token) throw new Error('Not authenticated');
      if (!token) throw new Error('No authentication token');
      return authenticatedApiCall<CareRecipient[]>('/care-recipients', token);
    },
  });

  // Auto-select care recipient (from URL or first available)
  useEffect(() => {
    if (!careRecipients || careRecipients.length === 0) return;

    // If recipientId from URL exists and is valid, use it
    if (recipientId && careRecipients.find(r => r.id === recipientId)) {
      setSelectedRecipientId(recipientId);
    }
    // Otherwise, auto-select first recipient if none selected
    else if (!selectedRecipientId) {
      setSelectedRecipientId(careRecipients[0].id);
    }
  }, [careRecipients, recipientId, selectedRecipientId]);

  // Auto-open Add Caregiver modal when action=add in URL
  useEffect(() => {
    if (action === 'add' && selectedRecipientId && userRole === 'family_admin') {
      setShowAddModal(true);
    }
  }, [action, selectedRecipientId, userRole]);

  // Fetch caregivers for selected recipient
  const { data: caregivers, isLoading: caregiversLoading } = useQuery({
    queryKey: ['caregivers', selectedRecipientId],
    queryFn: async () => {
      if (!selectedRecipientId) return [];
      if (!token) throw new Error('Not authenticated');
      if (!token) throw new Error('No authentication token');
      return authenticatedApiCall(`/caregivers/recipient/${selectedRecipientId}`, token);
    },
    enabled: !!selectedRecipientId,
  });

  const isLoading = recipientsLoading || caregiversLoading;
  const _selectedRecipient = careRecipients?.find(r => r.id === selectedRecipientId); void _selectedRecipient;

  // Reset PIN mutation
  const resetPinMutation = useMutation({
    mutationFn: async (caregiverId: string) => {
      if (!token) throw new Error('Not authenticated');
      if (!token) throw new Error('No authentication token');
      return authenticatedApiCall(`/caregivers/${caregiverId}/reset-pin`, token, {
        method: 'POST',
      });
    },
    onSuccess: (data) => {
      setNewPin(data.pin);
      queryClient.invalidateQueries({ queryKey: ['caregivers'] });
      addToast({
        type: 'success',
        message: 'PIN has been reset successfully. Make sure to save it securely!',
      });
    },
    onError: (error) => {
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to reset PIN. Please try again.',
      });
    },
  });

  // Deactivate mutation
  const deactivateMutation = useMutation({
    mutationFn: async ({ caregiverId, reason }: { caregiverId: string; reason: string }) => {
      if (!token) throw new Error('Not authenticated');
      if (!token) throw new Error('No authentication token');
      return authenticatedApiCall(`/caregivers/${caregiverId}/deactivate`, token, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
    },
    onSuccess: () => {
      setShowDeactivateModal(false);
      setSelectedCaregiver(null);
      setDeactivationReason('');
      queryClient.invalidateQueries({ queryKey: ['caregivers'] });
      addToast({
        type: 'success',
        message: 'Caregiver has been deactivated successfully.',
      });
    },
    onError: (error) => {
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to deactivate caregiver. Please try again.',
      });
    },
  });

  // Reactivate mutation
  const reactivateMutation = useMutation({
    mutationFn: async (caregiverId: string) => {
      if (!token) throw new Error('Not authenticated');
      if (!token) throw new Error('No authentication token');
      return authenticatedApiCall(`/caregivers/${caregiverId}/reactivate`, token, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      setShowReactivateModal(false);
      setSelectedCaregiver(null);
      queryClient.invalidateQueries({ queryKey: ['caregivers'] });
      addToast({
        type: 'success',
        message: 'Caregiver has been reactivated successfully.',
      });
    },
    onError: (error) => {
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to reactivate caregiver. Please try again.',
      });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ caregiverId, data }: { caregiverId: string; data: typeof editForm }) => {
      if (!token) throw new Error('Not authenticated');
      if (!token) throw new Error('No authentication token');
      return authenticatedApiCall(`/caregivers/${caregiverId}`, token, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      setShowEditModal(false);
      setSelectedCaregiver(null);
      queryClient.invalidateQueries({ queryKey: ['caregivers'] });
      addToast({
        type: 'success',
        message: 'Caregiver details updated successfully.',
      });
    },
    onError: (error) => {
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to update caregiver. Please try again.',
      });
    },
  });

  // Add caregiver mutation
  const addCaregiverMutation = useMutation({
    mutationFn: async (data: typeof addForm) => {
      if (!selectedRecipientId) throw new Error('No care recipient selected');
      if (!token) throw new Error('Not authenticated');
      if (!token) throw new Error('No authentication token');
      return authenticatedApiCall('/caregivers', token, {
        method: 'POST',
        body: JSON.stringify({
          careRecipientId: selectedRecipientId,
          name: data.name,
          phone: data.phone || undefined,
          email: data.email || undefined,
          language: data.language,
        }),
      });
    },
    onSuccess: (data) => {
      setNewPin(data.pin);
      setNewCaregiverId(data.id);
      setShowAddModal(false);
      setAddForm({
        name: '',
        phone: '',
        email: '',
        language: 'en',
      });
      queryClient.invalidateQueries({ queryKey: ['caregivers'] });
      addToast({
        type: 'success',
        message: 'Caregiver created successfully! Save the PIN and ID.',
      });
    },
    onError: (error) => {
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to add caregiver. Please try again.',
      });
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

  const handleEdit = (caregiver: Caregiver) => {
    setSelectedCaregiver(caregiver);
    setEditForm({
      name: caregiver.name,
      phone: caregiver.phone || '',
      email: caregiver.email || '',
    });
    setShowEditModal(true);
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

  const confirmEdit = () => {
    if (selectedCaregiver) {
      updateMutation.mutate({
        caregiverId: selectedCaregiver.id,
        data: editForm,
      });
    }
  };

  const copyPin = () => {
    if (newPin) {
      navigator.clipboard.writeText(newPin);
      setCopiedPin(true);
      setTimeout(() => setCopiedPin(false), 2000);
    }
  };

  const copyCaregiverId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const copyToClipboard = (text: string, type: 'pin' | 'id') => {
    navigator.clipboard.writeText(text);
    if (type === 'pin') {
      setCopiedPin(true);
      setTimeout(() => setCopiedPin(false), 2000);
    } else {
      setCopiedId(text);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  // Filter and sort caregivers
  const filteredAndSortedCaregivers = useMemo(() => {
    if (!caregivers) return [];

    let filtered = [...caregivers];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((c: Caregiver) =>
        c.name.toLowerCase().includes(query) ||
        c.email?.toLowerCase().includes(query) ||
        c.phone?.includes(query)
      );
    }

    // Apply status filter
    if (statusFilter === 'active') {
      filtered = filtered.filter((c: Caregiver) => c.active);
    } else if (statusFilter === 'inactive') {
      filtered = filtered.filter((c: Caregiver) => !c.active);
    }

    // Apply sorting
    filtered.sort((a: Caregiver, b: Caregiver) => {
      let comparison = 0;

      if (sortBy === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortBy === 'date') {
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [caregivers, searchQuery, statusFilter, sortBy, sortDirection]);

  const activeCaregivers = filteredAndSortedCaregivers.filter((c: Caregiver) => c.active);
  const inactiveCaregivers = filteredAndSortedCaregivers.filter((c: Caregiver) => !c.active);
  const isAdmin = userRole === 'family_admin';
  const isReadOnly = userRole !== null && userRole !== 'family_admin';

  return (
    <FamilyLayout>
      <div className="bg-gray-50 min-h-screen">
        {/* Page Header */}
        <div className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-4 py-6">

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <UserCog className="h-8 w-8 text-blue-600" />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold text-gray-900">Manage Caregivers</h1>
                  {isReadOnly && (
                    <span className="inline-flex items-center px-3 py-1 bg-amber-50 text-amber-700 text-xs font-semibold rounded-full border border-amber-200 shadow-sm">
                      <svg className="w-3 h-3 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                      </svg>
                      View Only
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  {isAdmin ? 'Reset PINs, deactivate, or reactivate caregivers' : 'View caregiver information'}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {isAdmin && (
                <Button onClick={() => setShowAddModal(true)} className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Caregiver
                </Button>
              )}
              <Link to="/family/settings" className="self-start sm:self-auto">
                <Button variant="outline">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Settings
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Caregiver Login Info Card */}
      <div className="max-w-7xl mx-auto px-4 pt-6">
        <Card className="border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                  <Heart className="h-5 w-5 text-white" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-blue-900 mb-2">
                  Where Caregivers Login
                </h3>
                <p className="text-sm text-gray-700 mb-3">
                  Share this URL with caregivers so they can submit daily care reports:
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <a
                    href={caregiverLoginUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center gap-2 bg-white border-2 border-blue-300 rounded-lg px-3 py-2 hover:bg-blue-50 transition-colors group"
                  >
                    <span className="text-blue-700 font-semibold text-sm break-all">
                      {caregiverLoginUrl}
                    </span>
                    <ExternalLink className="h-4 w-4 text-blue-600 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </a>
                  <button
                    onClick={copyCaregiverLoginUrl}
                    className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm"
                  >
                    {copiedLoginUrl ? (
                      <>
                        <Check className="h-4 w-4" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        <span>Copy URL</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-xs text-gray-600 mt-2">
                  💡 Each caregiver needs their unique Caregiver ID and PIN to login
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Care Recipient Selector */}
      {!recipientsLoading && careRecipients && careRecipients.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 pt-6">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex items-center gap-2">
                <Heart className="h-5 w-5 text-pink-600" />
                <label className="text-sm font-semibold text-gray-700">Viewing caregivers for:</label>
              </div>
              <select
                value={selectedRecipientId || ''}
                onChange={(e) => setSelectedRecipientId(e.target.value)}
                className="flex-1 sm:flex-initial sm:min-w-[300px] px-4 py-2 border-2 border-blue-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-medium"
              >
                {careRecipients.map((recipient) => (
                  <option key={recipient.id} value={recipient.id}>
                    {recipient.name} {recipient.condition ? `(${recipient.condition})` : ''}
                  </option>
                ))}
              </select>
              {careRecipients.length > 1 && (
                <span className="text-xs text-gray-600 bg-white px-3 py-1 rounded-full border border-gray-200">
                  {careRecipients.length} care recipients
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* No Care Recipients Message */}
      {!recipientsLoading && (!careRecipients || careRecipients.length === 0) && (
        <div className="max-w-7xl mx-auto px-4 py-12">
          <Card>
            <CardContent className="py-12 text-center">
              <Heart className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Care Recipients Yet</h3>
              <p className="text-gray-600 mb-6">
                You need to add a care recipient before you can manage caregivers
              </p>
              <Link to="/family/settings/care-recipients">
                <Button className="bg-pink-600 hover:bg-pink-700">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Care Recipient
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search, Filter, and Sort Controls */}
      {selectedRecipientId && (
      <>
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="bg-white rounded-lg border p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search caregivers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Filter by Status */}
            <div className="flex gap-2">
              <Button
                variant={statusFilter === 'all' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('all')}
              >
                All
              </Button>
              <Button
                variant={statusFilter === 'active' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('active')}
              >
                Active
              </Button>
              <Button
                variant={statusFilter === 'inactive' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('inactive')}
              >
                Inactive
              </Button>
            </div>

            {/* Sort */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (sortBy === 'name') {
                    setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                  } else {
                    setSortBy('name');
                    setSortDirection('asc');
                  }
                }}
              >
                <SlidersHorizontal className="h-4 w-4 mr-2" />
                Sort: {sortBy === 'name' ? 'Name' : 'Date'} ({sortDirection === 'asc' ? 'A-Z' : 'Z-A'})
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Caregivers List */}
      <div className="max-w-7xl mx-auto px-4 pb-8">
        {isLoading ? (
          <p className="text-center text-gray-600">Loading caregivers...</p>
        ) : (
          <>
            {/* Active Caregivers */}
            {(statusFilter === 'all' || statusFilter === 'active') && (
              <div className="mb-8" data-testid="caregiver-list" data-caregiver-status="active">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Active Caregivers ({activeCaregivers.length})</h2>
                <div className="space-y-4">
                  {activeCaregivers.length === 0 ? (
                    <p className="text-gray-600">
                      {searchQuery ? 'No matching active caregivers' : 'No active caregivers'}
                    </p>
                  ) : (
                    activeCaregivers.map((caregiver: Caregiver) => (
                      <Card key={caregiver.id} data-testid="caregiver-item">
                        <CardContent className="p-6">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div className="flex-1">
                              <h3 className="font-semibold text-lg text-gray-900">{caregiver.name}</h3>
                            <div className="mt-2 space-y-1">
                              {/* Caregiver ID with copy button */}
                              <div className="flex items-center gap-2">
                                <p className="text-sm text-gray-600">
                                  <span className="font-medium">Caregiver ID:</span>
                                  <code className="ml-1 text-xs bg-gray-100 px-2 py-1 rounded font-mono">{caregiver.id}</code>
                                </p>
                                <button
                                  onClick={() => copyCaregiverId(caregiver.id)}
                                  className="text-blue-600 hover:text-blue-700 transition-colors"
                                  title="Copy Caregiver ID"
                                >
                                  {copiedId === caregiver.id ? (
                                    <Check className="h-4 w-4 text-green-600" />
                                  ) : (
                                    <Copy className="h-4 w-4" />
                                  )}
                                </button>
                              </div>
                              {caregiver.phone && <p className="text-sm text-gray-600">Phone: {caregiver.phone}</p>}
                              {caregiver.email && <p className="text-sm text-gray-600">Email: {caregiver.email}</p>}
                              <p className="text-xs text-gray-500">
                                Created: {new Date(caregiver.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          {isAdmin && (
                            <div className="flex flex-col sm:flex-row gap-2">
                              <Button
                                onClick={() => handleEdit(caregiver)}
                                variant="outline"
                                size="sm"
                                className="text-gray-700 border-gray-200 hover:bg-gray-50"
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </Button>
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
                          )}
                        </div>
                      </CardContent>
                    </Card>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Inactive Caregivers */}
            {(statusFilter === 'all' || statusFilter === 'inactive') && inactiveCaregivers.length > 0 && (
              <div data-caregiver-status="inactive">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Inactive Caregivers ({inactiveCaregivers.length})</h2>
                <div className="space-y-4">
                  {inactiveCaregivers.map((caregiver: Caregiver) => (
                    <Card key={caregiver.id} className="opacity-60" data-testid="caregiver-item">
                      <CardContent className="p-6">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg text-gray-900">{caregiver.name}</h3>
                            <div className="mt-2 space-y-1">
                              {/* Caregiver ID with copy button */}
                              <div className="flex items-center gap-2">
                                <p className="text-sm text-gray-600">
                                  <span className="font-medium">Caregiver ID:</span>
                                  <code className="ml-1 text-xs bg-gray-100 px-2 py-1 rounded font-mono">{caregiver.id}</code>
                                </p>
                                <button
                                  onClick={() => copyCaregiverId(caregiver.id)}
                                  className="text-blue-600 hover:text-blue-700 transition-colors"
                                  title="Copy Caregiver ID"
                                >
                                  {copiedId === caregiver.id ? (
                                    <Check className="h-4 w-4 text-green-600" />
                                  ) : (
                                    <Copy className="h-4 w-4" />
                                  )}
                                </button>
                              </div>
                              {caregiver.phone && <p className="text-sm text-gray-600">Phone: {caregiver.phone}</p>}
                              {caregiver.email && <p className="text-sm text-gray-600">Email: {caregiver.email}</p>}
                              <p className="text-xs text-red-600 font-medium">
                                Deactivated: {caregiver.deactivatedAt ? new Date(caregiver.deactivatedAt).toLocaleDateString() : 'N/A'}
                              </p>
                            </div>
                          </div>
                          {isAdmin && (
                            <Button
                              onClick={() => handleReactivate(caregiver)}
                              variant="outline"
                              size="sm"
                              className="text-green-600 border-green-200 hover:bg-green-50"
                            >
                              <UserCheck className="h-4 w-4 mr-2" />
                              Reactivate
                            </Button>
                          )}
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

      {/* Edit Caregiver Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <h3 className="text-lg font-semibold text-gray-900">Edit Caregiver Details</h3>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <Input
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    placeholder="Caregiver name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <Input
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    placeholder="Phone number (optional)"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <Input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    placeholder="Email address (optional)"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedCaregiver(null);
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={confirmEdit}
                  disabled={!editForm.name.trim() || updateMutation.isPending}
                  className="flex-1"
                >
                  {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      </>
      )}

      {/* Add Caregiver Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
            <CardHeader className="border-b">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <UserCog className="h-5 w-5 text-blue-600" />
                Add New Caregiver
              </h2>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <Input
                  label="Name *"
                  type="text"
                  value={addForm.name}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                  placeholder="Enter caregiver's full name"
                  required
                />
                <Input
                  label="Phone"
                  type="tel"
                  value={addForm.phone}
                  onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                  placeholder="+65 9123 4567"
                />
                <Input
                  label="Email"
                  type="email"
                  value={addForm.email}
                  onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                  placeholder="caregiver@example.com"
                />
                <div>
                  <label htmlFor="language-select" className="block text-sm font-medium text-gray-700 mb-1">
                    Preferred Language
                  </label>
                  <select
                    id="language-select"
                    value={addForm.language}
                    onChange={(e) => setAddForm({ ...addForm, language: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="en">English</option>
                    <option value="zh">中文 (Chinese)</option>
                    <option value="ms">Bahasa Melayu (Malay)</option>
                    <option value="ta">தமிழ் (Tamil)</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowAddModal(false);
                    setAddForm({
                      name: '',
                      phone: '',
                      email: '',
                      language: 'en',
                    });
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (!addForm.name.trim()) {
                      addToast({
                        type: 'error',
                        message: 'Name is required',
                      });
                      return;
                    }
                    addCaregiverMutation.mutate(addForm);
                  }}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                  disabled={addCaregiverMutation.isPending}
                >
                  {addCaregiverMutation.isPending ? 'Creating...' : 'Create Caregiver'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Show Credentials Modal after successful caregiver creation */}
      {newPin && newCaregiverId && !showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="border-b bg-green-50">
              <h2 className="text-xl font-bold flex items-center gap-2 text-green-700">
                <Check className="h-5 w-5" />
                Caregiver Created Successfully!
              </h2>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-4">
                  <p className="text-sm font-semibold text-yellow-900 mb-2">⚠️ Save These Credentials</p>
                  <p className="text-xs text-yellow-800">
                    The caregiver will need both the PIN and ID to login. Make sure to save them securely!
                  </p>
                </div>

                <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-blue-900">6-Digit PIN</p>
                    <button
                      onClick={() => {
                        copyToClipboard(newPin, 'pin');
                      }}
                      className="flex items-center gap-1 text-blue-600 hover:text-blue-700 text-sm font-medium"
                    >
                      {copiedPin ? (
                        <>
                          <Check className="h-4 w-4" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" />
                          Copy
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-2xl font-mono font-bold text-blue-900 tracking-widest">{newPin}</p>
                </div>

                <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-blue-900">Caregiver ID</p>
                    <button
                      onClick={() => {
                        copyToClipboard(newCaregiverId, 'id');
                      }}
                      className="flex items-center gap-1 text-blue-600 hover:text-blue-700 text-sm font-medium"
                    >
                      {copiedId === newCaregiverId ? (
                        <>
                          <Check className="h-4 w-4" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" />
                          Copy
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-sm font-mono text-blue-900 break-all">{newCaregiverId}</p>
                </div>

                <div className="bg-blue-50 border-2 border-blue-300 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <svg className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <div className="flex-1">
                      <p className="font-bold text-blue-900 text-base mb-2">Where Caregivers Login</p>
                      <a
                        href="https://anchor-dev.erniesg.workers.dev/caregiver/login"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block bg-white border-2 border-blue-400 rounded-lg px-4 py-3 text-center hover:bg-blue-50 transition-colors"
                      >
                        <p className="text-blue-700 font-bold text-lg">
                          anchor-dev.erniesg.workers.dev/caregiver/login
                        </p>
                        <p className="text-blue-600 text-xs mt-1">Click to open login page →</p>
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <Button
                  onClick={() => {
                    setNewPin(null);
                    setNewCaregiverId(null);
                  }}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  Done
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
