import { useState } from 'react';
import { Plus, X, Droplets, Activity, AlertTriangle } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authenticatedApiCall } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

interface QuickActionFABProps {
  careLogId: string | null;
  careRecipientId: string | null;
  onLogCreated?: (logId: string) => void;
}

interface FluidEntry {
  name: string;
  time: string;
  amountMl: number;
}

interface ToiletingEntry {
  type: 'bowel' | 'urination' | 'both';
  time: string;
  assistance: 'none' | 'partial' | 'full';
  notes?: string;
}

interface ExerciseEntry {
  type: string;
  startTime: string;
  duration: number;
  notes?: string;
}

interface IncidentEntry {
  type: 'near_fall' | 'fall' | 'other';
  time: string;
  description: string;
  actionsTaken: string;
}

type ModalType = 'toileting' | 'fluid' | 'exercise' | 'incident' | null;

export function QuickActionFAB({ careLogId, careRecipientId, onLogCreated }: QuickActionFABProps) {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<ModalType>(null);

  // Form states
  const [fluidEntry, setFluidEntry] = useState<FluidEntry>({
    name: 'water',
    time: new Date().toTimeString().slice(0, 5),
    amountMl: 200,
  });

  const [toiletingEntry, setToiletingEntry] = useState<ToiletingEntry>({
    type: 'urination',
    time: new Date().toTimeString().slice(0, 5),
    assistance: 'none',
    notes: '',
  });

  const [exerciseEntry, setExerciseEntry] = useState<ExerciseEntry>({
    type: 'walking',
    startTime: new Date().toTimeString().slice(0, 5),
    duration: 10,
    notes: '',
  });

  const [incidentEntry, setIncidentEntry] = useState<IncidentEntry>({
    type: 'near_fall',
    time: new Date().toTimeString().slice(0, 5),
    description: '',
    actionsTaken: '',
  });

  // Create care log if needed
  const createLogMutation = useMutation({
    mutationFn: async () => {
      if (!token || !careRecipientId) throw new Error('Not authenticated');
      const today = new Date().toISOString().split('T')[0];
      const response = await authenticatedApiCall<{ id: string }>('/care-logs', token, {
        method: 'POST',
        body: JSON.stringify({ careRecipientId, logDate: today }),
      });
      return response;
    },
    onSuccess: (data) => {
      if (onLogCreated) onLogCreated(data.id);
      queryClient.invalidateQueries({ queryKey: ['caregiver-today-log'] });
    },
  });

  // Update care log mutation
  const updateLogMutation = useMutation({
    mutationFn: async ({ logId, data }: { logId: string; data: Record<string, unknown> }) => {
      if (!token) throw new Error('Not authenticated');
      return authenticatedApiCall(`/care-logs/${logId}`, token, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caregiver-today-log'] });
      setActiveModal(null);
      setIsOpen(false);
    },
  });

  const getOrCreateLogId = async (): Promise<string> => {
    if (careLogId) return careLogId;
    const result = await createLogMutation.mutateAsync();
    return result.id;
  };

  const handleFluidSubmit = async () => {
    try {
      const logId = await getOrCreateLogId();
      // Get existing fluids first
      const existingLog = await authenticatedApiCall<{ fluids?: FluidEntry[] }>(
        `/care-logs/${logId}`,
        token!
      );
      const existingFluids = existingLog.fluids || [];

      await updateLogMutation.mutateAsync({
        logId,
        data: {
          fluids: [...existingFluids, fluidEntry],
        },
      });

      // Reset form
      setFluidEntry({
        name: 'water',
        time: new Date().toTimeString().slice(0, 5),
        amountMl: 200,
      });
    } catch (error) {
      console.error('Failed to save fluid entry:', error);
    }
  };

  const handleToiletingSubmit = async () => {
    try {
      const logId = await getOrCreateLogId();

      // Build toileting update based on type - use top-level fields
      const toiletingData: Record<string, unknown> = {};

      if (toiletingEntry.type === 'bowel' || toiletingEntry.type === 'both') {
        toiletingData.bowelMovements = {
          frequency: 1,
          timesUsedToilet: 1,
          assistance: toiletingEntry.assistance !== 'none' ? toiletingEntry.assistance : undefined,
        };
      }

      if (toiletingEntry.type === 'urination' || toiletingEntry.type === 'both') {
        toiletingData.urination = {
          frequency: 1,
          timesUsedToilet: 1,
        };
      }

      await updateLogMutation.mutateAsync({
        logId,
        data: toiletingData,
      });

      // Reset form
      setToiletingEntry({
        type: 'urination',
        time: new Date().toTimeString().slice(0, 5),
        assistance: 'none',
        notes: '',
      });
    } catch (error) {
      console.error('Failed to save toileting entry:', error);
    }
  };

  const handleExerciseSubmit = async () => {
    try {
      const logId = await getOrCreateLogId();

      await updateLogMutation.mutateAsync({
        logId,
        data: {
          physicalActivity: {
            exerciseType: [exerciseEntry.type],
            exerciseDuration: exerciseEntry.duration,
          },
        },
      });

      // Reset form
      setExerciseEntry({
        type: 'walking',
        startTime: new Date().toTimeString().slice(0, 5),
        duration: 10,
        notes: '',
      });
    } catch (error) {
      console.error('Failed to save exercise entry:', error);
    }
  };

  const handleIncidentSubmit = async () => {
    try {
      const logId = await getOrCreateLogId();

      // Map incident type to appropriate fields
      const incidentData: Record<string, unknown> = {};

      if (incidentEntry.type === 'fall') {
        incidentData.actualFalls = true;
        incidentData.incidentDescription = incidentEntry.description;
        incidentData.actionsTaken = incidentEntry.actionsTaken;
      } else if (incidentEntry.type === 'near_fall') {
        incidentData.nearFalls = true;
        incidentData.incidentDescription = incidentEntry.description;
        incidentData.actionsTaken = incidentEntry.actionsTaken;
      } else {
        incidentData.specialConcerns = {
          priorityLevel: 'medium',
          incidentDescription: incidentEntry.description,
          actionsTaken: incidentEntry.actionsTaken,
        };
      }

      await updateLogMutation.mutateAsync({
        logId,
        data: incidentData,
      });

      // Reset form
      setIncidentEntry({
        type: 'near_fall',
        time: new Date().toTimeString().slice(0, 5),
        description: '',
        actionsTaken: '',
      });
    } catch (error) {
      console.error('Failed to save incident:', error);
    }
  };

  const quickActions = [
    { id: 'toileting', icon: '🚽', label: 'Toileting', color: 'bg-purple-500' },
    { id: 'fluid', icon: '💧', label: 'Fluid', color: 'bg-blue-500' },
    { id: 'exercise', icon: '🏃', label: 'Exercise', color: 'bg-green-500' },
    { id: 'incident', icon: '⚠️', label: 'Incident', color: 'bg-amber-500' },
  ];

  // Expose methods to open modals programmatically (for inline quick action buttons)
  const openModal = (modalType: ModalType) => {
    setActiveModal(modalType);
    setIsOpen(true);
  };

  // Make openModal available globally for inline buttons
  if (typeof window !== 'undefined') {
    (window as unknown as { openQuickActionModal?: (type: ModalType) => void }).openQuickActionModal = openModal;
  }

  const isLoading = createLogMutation.isPending || updateLogMutation.isPending;

  return (
    <>
      {/* FAB Button */}
      <div className="fixed bottom-6 right-6 z-50">
        {/* Quick action buttons */}
        {isOpen && (
          <div className="absolute bottom-16 right-0 flex flex-col gap-3 mb-2">
            {quickActions.map((action) => (
              <button
                key={action.id}
                onClick={() => setActiveModal(action.id as ModalType)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full ${action.color} text-white shadow-lg hover:opacity-90 transition-all animate-fade-in`}
              >
                <span className="text-lg">{action.icon}</span>
                <span className="font-medium">{action.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Main FAB - bright orange/red for visibility */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`w-16 h-16 rounded-full shadow-xl flex items-center justify-center transition-all border-4 border-white ${
            isOpen ? 'bg-gray-700 rotate-45' : 'bg-orange-500 hover:bg-orange-600'
          }`}
          style={{ boxShadow: '0 4px 20px rgba(249, 115, 22, 0.5)' }}
        >
          {isOpen ? (
            <X className="h-7 w-7 text-white" />
          ) : (
            <Plus className="h-7 w-7 text-white" />
          )}
        </button>
        {/* Label below FAB when closed */}
        {!isOpen && (
          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap">
            <span className="text-xs font-bold text-orange-600 bg-white px-2 py-0.5 rounded shadow">
              Quick Log
            </span>
          </div>
        )}
      </div>

      {/* Modals */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setActiveModal(null)}
          />
          <div className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md max-h-[80vh] overflow-y-auto p-6 animate-slide-up">
            {/* Fluid Modal */}
            {activeModal === 'fluid' && (
              <>
                <div className="flex items-center gap-3 mb-6">
                  <Droplets className="h-6 w-6 text-blue-500" />
                  <h2 className="text-xl font-bold">Log Fluid Intake</h2>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Drink Type</label>
                    <select
                      value={fluidEntry.name}
                      onChange={(e) => setFluidEntry({ ...fluidEntry, name: e.target.value })}
                      className="w-full p-3 border rounded-lg"
                    >
                      <option value="water">Water</option>
                      <option value="tea">Tea</option>
                      <option value="juice">Juice</option>
                      <option value="milk">Milk</option>
                      <option value="glucerna">Glucerna</option>
                      <option value="soup">Soup</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Amount (ml)</label>
                    <div className="flex gap-2">
                      {[100, 150, 200, 250, 300].map((amount) => (
                        <button
                          key={amount}
                          type="button"
                          onClick={() => setFluidEntry({ ...fluidEntry, amountMl: amount })}
                          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                            fluidEntry.amountMl === amount
                              ? 'bg-blue-500 text-white'
                              : 'bg-gray-100 hover:bg-gray-200'
                          }`}
                        >
                          {amount}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Time</label>
                    <input
                      type="time"
                      value={fluidEntry.time}
                      onChange={(e) => setFluidEntry({ ...fluidEntry, time: e.target.value })}
                      className="w-full p-3 border rounded-lg"
                    />
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setActiveModal(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    className="flex-1"
                    onClick={handleFluidSubmit}
                    isLoading={isLoading}
                  >
                    Save
                  </Button>
                </div>
              </>
            )}

            {/* Toileting Modal */}
            {activeModal === 'toileting' && (
              <>
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-2xl">🚽</span>
                  <h2 className="text-xl font-bold">Log Toileting</h2>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Type</label>
                    <div className="flex gap-2">
                      {[
                        { value: 'urination', label: 'Urination' },
                        { value: 'bowel', label: 'Bowel' },
                        { value: 'both', label: 'Both' },
                      ].map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setToiletingEntry({ ...toiletingEntry, type: option.value as ToiletingEntry['type'] })}
                          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                            toiletingEntry.type === option.value
                              ? 'bg-purple-500 text-white'
                              : 'bg-gray-100 hover:bg-gray-200'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Assistance</label>
                    <div className="flex gap-2">
                      {[
                        { value: 'none', label: 'None' },
                        { value: 'partial', label: 'Partial' },
                        { value: 'full', label: 'Full' },
                      ].map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setToiletingEntry({ ...toiletingEntry, assistance: option.value as ToiletingEntry['assistance'] })}
                          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                            toiletingEntry.assistance === option.value
                              ? 'bg-purple-500 text-white'
                              : 'bg-gray-100 hover:bg-gray-200'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Time</label>
                    <input
                      type="time"
                      value={toiletingEntry.time}
                      onChange={(e) => setToiletingEntry({ ...toiletingEntry, time: e.target.value })}
                      className="w-full p-3 border rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Notes (optional)</label>
                    <textarea
                      value={toiletingEntry.notes}
                      onChange={(e) => setToiletingEntry({ ...toiletingEntry, notes: e.target.value })}
                      className="w-full p-3 border rounded-lg"
                      rows={2}
                      placeholder="Any observations..."
                    />
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setActiveModal(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    className="flex-1"
                    onClick={handleToiletingSubmit}
                    isLoading={isLoading}
                  >
                    Save
                  </Button>
                </div>
              </>
            )}

            {/* Exercise Modal */}
            {activeModal === 'exercise' && (
              <>
                <div className="flex items-center gap-3 mb-6">
                  <Activity className="h-6 w-6 text-green-500" />
                  <h2 className="text-xl font-bold">Log Exercise</h2>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Exercise Type</label>
                    <select
                      value={exerciseEntry.type}
                      onChange={(e) => setExerciseEntry({ ...exerciseEntry, type: e.target.value })}
                      className="w-full p-3 border rounded-lg"
                    >
                      <option value="walking">Walking</option>
                      <option value="arm_exercises">Arm Exercises</option>
                      <option value="leg_exercises">Leg Exercises</option>
                      <option value="stretching">Stretching</option>
                      <option value="balance_training">Balance Training</option>
                      <option value="physiotherapy">Physiotherapy</option>
                      <option value="other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Duration (minutes)</label>
                    <div className="flex gap-2">
                      {[5, 10, 15, 20, 30].map((duration) => (
                        <button
                          key={duration}
                          type="button"
                          onClick={() => setExerciseEntry({ ...exerciseEntry, duration })}
                          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                            exerciseEntry.duration === duration
                              ? 'bg-green-500 text-white'
                              : 'bg-gray-100 hover:bg-gray-200'
                          }`}
                        >
                          {duration}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Start Time</label>
                    <input
                      type="time"
                      value={exerciseEntry.startTime}
                      onChange={(e) => setExerciseEntry({ ...exerciseEntry, startTime: e.target.value })}
                      className="w-full p-3 border rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Notes (optional)</label>
                    <textarea
                      value={exerciseEntry.notes}
                      onChange={(e) => setExerciseEntry({ ...exerciseEntry, notes: e.target.value })}
                      className="w-full p-3 border rounded-lg"
                      rows={2}
                      placeholder="How did it go?"
                    />
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setActiveModal(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    className="flex-1"
                    onClick={handleExerciseSubmit}
                    isLoading={isLoading}
                  >
                    Save
                  </Button>
                </div>
              </>
            )}

            {/* Incident Modal */}
            {activeModal === 'incident' && (
              <>
                <div className="flex items-center gap-3 mb-6">
                  <AlertTriangle className="h-6 w-6 text-amber-500" />
                  <h2 className="text-xl font-bold">Report Incident</h2>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Type</label>
                    <div className="flex gap-2">
                      {[
                        { value: 'near_fall', label: 'Near Fall' },
                        { value: 'fall', label: 'Fall' },
                        { value: 'other', label: 'Other' },
                      ].map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setIncidentEntry({ ...incidentEntry, type: option.value as IncidentEntry['type'] })}
                          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                            incidentEntry.type === option.value
                              ? 'bg-amber-500 text-white'
                              : 'bg-gray-100 hover:bg-gray-200'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Time</label>
                    <input
                      type="time"
                      value={incidentEntry.time}
                      onChange={(e) => setIncidentEntry({ ...incidentEntry, time: e.target.value })}
                      className="w-full p-3 border rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">What happened? *</label>
                    <textarea
                      value={incidentEntry.description}
                      onChange={(e) => setIncidentEntry({ ...incidentEntry, description: e.target.value })}
                      className="w-full p-3 border rounded-lg"
                      rows={3}
                      placeholder="Describe what happened..."
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Actions taken *</label>
                    <textarea
                      value={incidentEntry.actionsTaken}
                      onChange={(e) => setIncidentEntry({ ...incidentEntry, actionsTaken: e.target.value })}
                      className="w-full p-3 border rounded-lg"
                      rows={2}
                      placeholder="What did you do?"
                      required
                    />
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setActiveModal(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    className="flex-1"
                    onClick={handleIncidentSubmit}
                    isLoading={isLoading}
                    disabled={!incidentEntry.description || !incidentEntry.actionsTaken}
                  >
                    Report
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(100%); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </>
  );
}
