import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { ArrowLeft, Clock3, Edit2, Pill, Plus, Trash2 } from 'lucide-react';
import { FamilyLayout } from '@/components/FamilyLayout';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authenticatedApiCall } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { useAuth } from '@/contexts/AuthContext';

const DAY_OPTIONS = [
  { value: 'mon', label: 'Mon' },
  { value: 'tue', label: 'Tue' },
  { value: 'wed', label: 'Wed' },
  { value: 'thu', label: 'Thu' },
  { value: 'fri', label: 'Fri' },
  { value: 'sat', label: 'Sat' },
  { value: 'sun', label: 'Sun' },
] as const;

const TIME_SLOT_OPTIONS = [
  { value: 'before_breakfast', label: 'Before breakfast' },
  { value: 'after_breakfast', label: 'After breakfast' },
  { value: 'afternoon', label: 'Afternoon' },
  { value: 'after_dinner', label: 'After dinner' },
  { value: 'before_bedtime', label: 'Before bedtime' },
] as const;

type DayCode = typeof DAY_OPTIONS[number]['value'];
type TimeSlot = typeof TIME_SLOT_OPTIONS[number]['value'];

interface MedicationSchedule {
  id: string;
  careRecipientId: string;
  medicationName: string;
  dosage: string;
  purpose?: string;
  timeSlot: TimeSlot;
  scheduledTime?: string;
  repeatDays: DayCode[];
  active: boolean;
}

type ScheduleFormState = {
  medicationName: string;
  dosage: string;
  purpose: string;
  timeSlot: TimeSlot;
  scheduledTime: string;
  repeatDays: DayCode[];
  active: boolean;
};

const emptyFormState: ScheduleFormState = {
  medicationName: '',
  dosage: '',
  purpose: '',
  timeSlot: 'after_breakfast',
  scheduledTime: '',
  repeatDays: [],
  active: true,
};

export const Route = createFileRoute('/family/settings/medication-schedules')({
  component: MedicationScheduleManagementComponent,
  validateSearch: (search: Record<string, unknown>) => ({
    recipientId: (search.recipientId as string) || '',
    recipientName: (search.recipientName as string) || '',
  }),
});

function formatRepeatDays(repeatDays: DayCode[]): string {
  if (repeatDays.length === 0 || repeatDays.length === 7) {
    return 'Every day';
  }

  return DAY_OPTIONS
    .filter((day) => repeatDays.includes(day.value))
    .map((day) => day.label)
    .join(', ');
}

function MedicationScheduleManagementComponent() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const { token, user } = useAuth();
  const { recipientId, recipientName } = Route.useSearch();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<ScheduleFormState>(emptyFormState);

  const isReadOnly = user?.role !== 'family_admin';

  const { data: schedules = [], isLoading } = useQuery({
    queryKey: ['medication-schedules', recipientId],
    queryFn: async () => {
      if (!token) throw new Error('No authentication token');
      return authenticatedApiCall<MedicationSchedule[]>(`/medication-schedules/recipient/${recipientId}`, token);
    },
    enabled: !!token && !!recipientId,
  });

  const resetForm = () => {
    setEditingId(null);
    setShowForm(false);
    setFormData(emptyFormState);
  };

  const upsertMutation = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error('No authentication token');

      const payload = {
        careRecipientId: recipientId,
        medicationName: formData.medicationName.trim(),
        dosage: formData.dosage.trim(),
        purpose: formData.purpose.trim() || undefined,
        timeSlot: formData.timeSlot,
        scheduledTime: formData.scheduledTime || undefined,
        repeatDays: formData.repeatDays,
        active: formData.active,
      };

      return authenticatedApiCall<MedicationSchedule>(
        editingId ? `/medication-schedules/${editingId}` : '/medication-schedules',
        token,
        {
          method: editingId ? 'PATCH' : 'POST',
          body: JSON.stringify(payload),
        }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medication-schedules', recipientId] });
      addToast({
        type: 'success',
        message: editingId ? 'Medication schedule updated' : 'Medication schedule added',
      });
      resetForm();
    },
    onError: (error) => {
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to save medication schedule',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (scheduleId: string) => {
      if (!token) throw new Error('No authentication token');
      return authenticatedApiCall(`/medication-schedules/${scheduleId}`, token, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['medication-schedules', recipientId] });
      addToast({
        type: 'success',
        message: 'Medication schedule deleted',
      });
    },
    onError: (error) => {
      addToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to delete medication schedule',
      });
    },
  });

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!formData.medicationName.trim() || !formData.dosage.trim()) {
      addToast({
        type: 'error',
        message: 'Medication name and dosage are required',
      });
      return;
    }

    await upsertMutation.mutateAsync();
  };

  const handleEdit = (schedule: MedicationSchedule) => {
    setEditingId(schedule.id);
    setShowForm(true);
    setFormData({
      medicationName: schedule.medicationName,
      dosage: schedule.dosage,
      purpose: schedule.purpose || '',
      timeSlot: schedule.timeSlot,
      scheduledTime: schedule.scheduledTime || '',
      repeatDays: schedule.repeatDays,
      active: schedule.active,
    });
  };

  const handleDelete = async (schedule: MedicationSchedule) => {
    const confirmed = window.confirm(`Delete ${schedule.medicationName} for ${recipientName || 'this care recipient'}?`);
    if (!confirmed) return;

    await deleteMutation.mutateAsync(schedule.id);
  };

  const toggleRepeatDay = (day: DayCode) => {
    setFormData((current) => ({
      ...current,
      repeatDays: current.repeatDays.includes(day)
        ? current.repeatDays.filter((existingDay) => existingDay !== day)
        : [...current.repeatDays, day],
    }));
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
        <div className="bg-white border-b">
          <div className="max-w-5xl mx-auto px-4 py-6">
            <Breadcrumb
              items={[
                { label: 'Settings', href: '/family/settings' },
                { label: 'Care Recipients', href: '/family/settings/care-recipients' },
                { label: 'Medication Schedule', href: '/family/settings/medication-schedules' },
              ]}
            />
            <div className="flex flex-col gap-4 mt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <Pill className="h-8 w-8 text-emerald-600" />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Medication Schedule</h1>
                  <p className="text-sm text-gray-600">
                    {recipientName ? `For ${recipientName}` : 'Manage scheduled medications'}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                {!isReadOnly && (
                  <Button onClick={() => { setEditingId(null); setShowForm(true); setFormData(emptyFormState); }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Medication
                  </Button>
                )}
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
        </div>

        <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
          <Card>
            <CardContent className="py-5 text-sm text-gray-600 space-y-2">
              <p>
                Scheduled medications are copied into the caregiver&apos;s daily log when that day&apos;s care log is created.
              </p>
              <p>
                One-off medications are not supported yet. Leave repeat days empty to schedule a medication every day.
              </p>
              {isReadOnly && (
                <p className="text-amber-700">
                  You have read-only access. Only the family admin can change medication schedules.
                </p>
              )}
            </CardContent>
          </Card>

          {(showForm || schedules.length === 0) && (
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold text-gray-900">
                  {editingId ? 'Edit Medication' : 'Add Medication'}
                </h2>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Input
                      label="Medication Name"
                      value={formData.medicationName}
                      onChange={(event) => setFormData((current) => ({ ...current, medicationName: event.target.value }))}
                      placeholder="Metformin"
                      disabled={isReadOnly}
                    />
                    <Input
                      label="Dosage"
                      value={formData.dosage}
                      onChange={(event) => setFormData((current) => ({ ...current, dosage: event.target.value }))}
                      placeholder="500mg"
                      disabled={isReadOnly}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label htmlFor="time-slot" className="block text-sm font-medium text-gray-700 mb-1">
                        Time Slot
                      </label>
                      <select
                        id="time-slot"
                        value={formData.timeSlot}
                        onChange={(event) => setFormData((current) => ({
                          ...current,
                          timeSlot: event.target.value as TimeSlot,
                        }))}
                        disabled={isReadOnly}
                        className="w-full px-4 py-2 border rounded-lg border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-gray-50"
                      >
                        {TIME_SLOT_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <Input
                      label="Scheduled Time"
                      type="time"
                      value={formData.scheduledTime}
                      onChange={(event) => setFormData((current) => ({ ...current, scheduledTime: event.target.value }))}
                      helperText="Optional. Used for display only."
                      disabled={isReadOnly}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Repeat Days</label>
                    <div className="flex flex-wrap gap-2">
                      {DAY_OPTIONS.map((day) => {
                        const selected = formData.repeatDays.includes(day.value);
                        return (
                          <button
                            key={day.value}
                            type="button"
                            onClick={() => toggleRepeatDay(day.value)}
                            disabled={isReadOnly}
                            className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                              selected
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                          >
                            {day.label}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      {formData.repeatDays.length === 0
                        ? 'Currently set to every day'
                        : `Runs on ${formatRepeatDays(formData.repeatDays)}`}
                    </p>
                  </div>

                  <div>
                    <label htmlFor="purpose" className="block text-sm font-medium text-gray-700 mb-1">
                      Purpose
                    </label>
                    <textarea
                      id="purpose"
                      value={formData.purpose}
                      onChange={(event) => setFormData((current) => ({ ...current, purpose: event.target.value }))}
                      placeholder="Why this medication is taken"
                      disabled={isReadOnly}
                      rows={3}
                      className="w-full px-4 py-2 border rounded-lg border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-gray-50"
                    />
                  </div>

                  <label className="flex items-center gap-3 text-sm font-medium text-gray-700">
                    <input
                      type="checkbox"
                      checked={formData.active}
                      onChange={(event) => setFormData((current) => ({ ...current, active: event.target.checked }))}
                      disabled={isReadOnly}
                      className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    Schedule is active
                  </label>

                  {!isReadOnly && (
                    <div className="flex gap-3">
                      <Button type="submit" isLoading={upsertMutation.isPending}>
                        {editingId ? 'Save Changes' : 'Add Medication'}
                      </Button>
                      <Button type="button" variant="outline" onClick={resetForm}>
                        Cancel
                      </Button>
                    </div>
                  )}
                </form>
              </CardContent>
            </Card>
          )}

          {isLoading ? (
            <div className="text-center py-12 text-gray-500">Loading medication schedule...</div>
          ) : schedules.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Pill className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No medications scheduled yet</h3>
                <p className="text-gray-600">
                  Add recurring medications here so caregivers can check them off in the daily forms.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {schedules.map((schedule) => (
                <Card key={schedule.id}>
                  <CardContent className="py-5">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-2">
                        <div className="flex items-center gap-3 flex-wrap">
                          <h3 className="text-lg font-semibold text-gray-900">{schedule.medicationName}</h3>
                          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
                            {schedule.dosage}
                          </span>
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                            schedule.active
                              ? 'bg-green-50 text-green-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            {schedule.active ? 'Active' : 'Inactive'}
                          </span>
                        </div>

                        {schedule.purpose && (
                          <p className="text-sm text-gray-600">{schedule.purpose}</p>
                        )}

                        <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                          <span>{TIME_SLOT_OPTIONS.find((option) => option.value === schedule.timeSlot)?.label}</span>
                          <span>{formatRepeatDays(schedule.repeatDays)}</span>
                          <span className="inline-flex items-center gap-1">
                            <Clock3 className="h-4 w-4" />
                            {schedule.scheduledTime || 'Time not set'}
                          </span>
                        </div>
                      </div>

                      {!isReadOnly && (
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(schedule)}
                          >
                            <Edit2 className="h-4 w-4 mr-2" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(schedule)}
                            disabled={deleteMutation.isPending}
                            className="text-red-600 border-red-200 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </FamilyLayout>
  );
}
