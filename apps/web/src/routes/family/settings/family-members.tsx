import { createFileRoute, Link } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Users, ArrowLeft, UserPlus, Shield, ShieldOff, Trash2, Mail } from 'lucide-react';

export const Route = createFileRoute('/family/settings/family-members')({
  component: FamilyMembersSettingsComponent,
});

interface FamilyMember {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: 'family_admin' | 'family_member';
  active: boolean;
  createdAt: string;
}

interface CareRecipient {
  id: string;
  name: string;
}

function FamilyMembersSettingsComponent() {
  const [careRecipient, setCareRecipient] = useState<CareRecipient | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(false);

  const queryClient = useQueryClient();

  useEffect(() => {
    const recipientData = localStorage.getItem('careRecipient');
    if (recipientData) setCareRecipient(JSON.parse(recipientData));
  }, []);

  // Fetch family members
  const { data: members, isLoading } = useQuery({
    queryKey: ['family-members'],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/family-members', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch family members');
      return response.json() as Promise<FamilyMember[]>;
    },
  });

  // Invite family member mutation
  const inviteMutation = useMutation({
    mutationFn: async (data: { email: string; name: string }) => {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/family-members/invite', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to invite member');
      }
      return response.json();
    },
    onSuccess: () => {
      setShowInviteModal(false);
      setInviteEmail('');
      setInviteName('');
      queryClient.invalidateQueries({ queryKey: ['family-members'] });
    },
  });

  // Grant access mutation
  const grantAccessMutation = useMutation({
    mutationFn: async ({ userId, careRecipientId }: { userId: string; careRecipientId: string }) => {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/family-members/grant-access', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, careRecipientId }),
      });
      if (!response.ok) throw new Error('Failed to grant access');
      return response.json();
    },
    onSuccess: () => {
      setShowAccessModal(false);
      setSelectedMember(null);
    },
  });

  // Revoke access mutation
  const revokeAccessMutation = useMutation({
    mutationFn: async ({ userId, careRecipientId }: { userId: string; careRecipientId: string }) => {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/family-members/revoke-access', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, careRecipientId }),
      });
      if (!response.ok) throw new Error('Failed to revoke access');
      return response.json();
    },
  });

  // Remove member mutation
  const removeMutation = useMutation({
    mutationFn: async (userId: string) => {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/family-members/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to remove member');
      return response.json();
    },
    onSuccess: () => {
      setShowRemoveModal(false);
      setSelectedMember(null);
      queryClient.invalidateQueries({ queryKey: ['family-members'] });
    },
  });

  const handleInvite = () => {
    if (inviteEmail.trim() && inviteName.trim()) {
      inviteMutation.mutate({ email: inviteEmail, name: inviteName });
    }
  };

  const handleGrantAccess = (member: FamilyMember) => {
    if (careRecipient) {
      grantAccessMutation.mutate({
        userId: member.id,
        careRecipientId: careRecipient.id,
      });
    }
  };

  const handleRevokeAccess = (member: FamilyMember) => {
    if (careRecipient) {
      revokeAccessMutation.mutate({
        userId: member.id,
        careRecipientId: careRecipient.id,
      });
    }
  };

  const handleRemove = (member: FamilyMember) => {
    setSelectedMember(member);
    setShowRemoveModal(true);
  };

  const confirmRemove = () => {
    if (selectedMember) {
      removeMutation.mutate(selectedMember.id);
    }
  };

  const admins = members?.filter((m) => m.role === 'family_admin') || [];
  const regularMembers = members?.filter((m) => m.role === 'family_member') || [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-green-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Family Members</h1>
                <p className="text-sm text-gray-600">Invite and manage family member access</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button onClick={() => setShowInviteModal(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Invite Member
              </Button>
              <Link to="/family/settings">
                <Button variant="outline">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Family Members List */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {isLoading ? (
          <p className="text-center text-gray-600">Loading family members...</p>
        ) : (
          <>
            {/* Admins */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Family Admins ({admins.length})
              </h2>
              <div className="space-y-4">
                {admins.map((member) => (
                  <Card key={member.id}>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-lg text-gray-900">{member.name}</h3>
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                              Admin
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">{member.email}</p>
                          {member.phone && <p className="text-sm text-gray-600">Phone: {member.phone}</p>}
                          <p className="text-xs text-gray-500 mt-1">
                            Joined: {new Date(member.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-sm text-gray-500">Full Access</div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Regular Members */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Family Members ({regularMembers.length})
              </h2>
              <div className="space-y-4">
                {regularMembers.length === 0 ? (
                  <p className="text-gray-600">No family members yet. Invite someone to start collaborating!</p>
                ) : (
                  regularMembers.map((member) => (
                    <Card key={member.id}>
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-lg text-gray-900">{member.name}</h3>
                              <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded">
                                Member
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 mt-1">{member.email}</p>
                            {member.phone && <p className="text-sm text-gray-600">Phone: {member.phone}</p>}
                            <p className="text-xs text-gray-500 mt-1">
                              Joined: {new Date(member.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              onClick={() => handleGrantAccess(member)}
                              variant="outline"
                              size="sm"
                              className="text-green-600 border-green-200 hover:bg-green-50"
                              disabled={!careRecipient}
                            >
                              <Shield className="h-4 w-4 mr-2" />
                              Grant Access
                            </Button>
                            <Button
                              onClick={() => handleRevokeAccess(member)}
                              variant="outline"
                              size="sm"
                              className="text-orange-600 border-orange-200 hover:bg-orange-50"
                              disabled={!careRecipient}
                            >
                              <ShieldOff className="h-4 w-4 mr-2" />
                              Revoke
                            </Button>
                            <Button
                              onClick={() => handleRemove(member)}
                              variant="outline"
                              size="sm"
                              className="text-red-600 border-red-200 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Remove
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Mail className="h-6 w-6 text-green-600" />
                <h3 className="text-lg font-semibold text-gray-900">Invite Family Member</h3>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                  <Input
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                  <Input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="john@example.com"
                  />
                </div>
                <p className="text-xs text-gray-500">
                  An invitation email will be sent with instructions to join.
                </p>
                <div className="flex gap-2 mt-6">
                  <Button
                    onClick={() => {
                      setShowInviteModal(false);
                      setInviteEmail('');
                      setInviteName('');
                    }}
                    variant="outline"
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleInvite}
                    disabled={!inviteEmail.trim() || !inviteName.trim() || inviteMutation.isPending}
                    className="flex-1"
                  >
                    {inviteMutation.isPending ? 'Sending...' : 'Send Invite'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Remove Member Modal */}
      {showRemoveModal && selectedMember && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <h3 className="text-lg font-semibold text-red-600">Remove Family Member</h3>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">
                Are you sure you want to remove <span className="font-semibold">{selectedMember.name}</span>?
              </p>
              <p className="text-xs text-gray-500 mb-4">
                ⚠️ This will revoke all their access. They can be re-invited later if needed.
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    setShowRemoveModal(false);
                    setSelectedMember(null);
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={confirmRemove}
                  disabled={removeMutation.isPending}
                  className="flex-1 bg-red-600 hover:bg-red-700"
                >
                  {removeMutation.isPending ? 'Removing...' : 'Remove'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
