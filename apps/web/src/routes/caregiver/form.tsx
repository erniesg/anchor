import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useAutoSave } from '@/hooks/use-auto-save';
import { Save, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { authenticatedApiCall } from '@/lib/api';

export const Route = createFileRoute('/caregiver/form')({
  component: CareLogFormComponent,
});

function CareLogFormComponent() {
  const navigate = useNavigate();
  const [currentSection, setCurrentSection] = useState(1);
  const [careLogId, setCareLogId] = useState<string | null>(null);
  const [logStatus, setLogStatus] = useState<'draft' | 'submitted' | 'invalidated'>('draft');

  // Morning Routine
  const [wakeTime, setWakeTime] = useState('');
  const [mood, setMood] = useState('');
  const [showerTime, setShowerTime] = useState('');
  const [hairWash, setHairWash] = useState(false);

  // Medications
  const [medications, setMedications] = useState([
    { name: 'Glucophage 500mg', given: false, time: '', timeSlot: 'before_breakfast' as const },
    { name: 'Forxiga 10mg', given: false, time: '', timeSlot: 'after_breakfast' as const },
    { name: 'Ozempic 0.5mg', given: false, time: '', timeSlot: 'afternoon' as const },
  ]);

  // Meals
  const [breakfastTime, setBreakfastTime] = useState('');
  const [breakfastAppetite, setBreakfastAppetite] = useState(3);
  const [breakfastAmount, setBreakfastAmount] = useState(75);

  // Vitals
  const [bloodPressure, setBloodPressure] = useState('');
  const [pulseRate, setPulseRate] = useState('');
  const [oxygenLevel, setOxygenLevel] = useState('');
  const [bloodSugar, setBloodSugar] = useState('');
  const [vitalsTime, setVitalsTime] = useState('');

  // Toileting
  const [bowelFreq, setBowelFreq] = useState(0);
  const [urineFreq, setUrineFreq] = useState(0);
  const [diaperChanges, setDiaperChanges] = useState(0);

  // Safety
  const [emergencyFlag, setEmergencyFlag] = useState(false);
  const [emergencyNote, setEmergencyNote] = useState('');
  const [notes, setNotes] = useState('');

  // Get care recipient ID (mock for now - should come from caregiver session)
  const careRecipientId = localStorage.getItem('careRecipientId') || '';
  const caregiverToken = localStorage.getItem('caregiverToken') || '';

  // Prepare form data
  const formData = useMemo(() => {
    const careRecipient = JSON.parse(localStorage.getItem('careRecipient') || '{}');
    return {
      careRecipientId: careRecipient.id,
      logDate: new Date().toISOString().split('T')[0],
      wakeTime,
      mood,
      showerTime,
      hairWash,
      medications,
      meals: {
        breakfast: breakfastTime ? {
          time: breakfastTime,
          appetite: breakfastAppetite,
          amountEaten: breakfastAmount,
        } : undefined,
      },
      bloodPressure,
      pulseRate: pulseRate ? parseInt(pulseRate) : undefined,
      oxygenLevel: oxygenLevel ? parseInt(oxygenLevel) : undefined,
      bloodSugar: bloodSugar ? parseFloat(bloodSugar) : undefined,
      vitalsTime,
      toileting: {
        bowelFrequency: bowelFreq,
        urineFrequency: urineFreq,
        diaperChanges,
      },
      emergencyFlag,
      emergencyNote,
      notes,
    };
  }, [wakeTime, mood, showerTime, hairWash, medications, breakfastTime, breakfastAppetite,
      breakfastAmount, bloodPressure, pulseRate, oxygenLevel, bloodSugar, vitalsTime,
      bowelFreq, urineFreq, diaperChanges, emergencyFlag, emergencyNote, notes]);

  // Create/Update mutation (for auto-save)
  const saveDraftMutation = useMutation({
    mutationFn: async (data: any) => {
      const url = careLogId ? `/care-logs/${careLogId}` : '/care-logs';
      const method = careLogId ? 'PATCH' : 'POST';

      return authenticatedApiCall(url, caregiverToken, {
        method,
        body: JSON.stringify({ ...data, status: 'draft' }),
      });
    },
    onSuccess: (data) => {
      if (!careLogId && data.id) {
        setCareLogId(data.id);
      }
    },
  });

  // Submit mutation (final submission)
  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!careLogId) throw new Error('No draft to submit');

      return authenticatedApiCall(`/care-logs/${careLogId}/submit`, caregiverToken, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      setLogStatus('submitted');
      alert('Care log submitted successfully! ✅');
    },
  });

  // Auto-save hook
  const { lastSaved, isSaving, saveError } = useAutoSave({
    data: formData,
    onSave: async (data) => {
      await saveDraftMutation.mutateAsync(data);
    },
    interval: 30000, // 30 seconds
    enabled: true,
    isDraft: logStatus === 'draft',
  });

  const handleSubmit = async () => {
    try {
      // Save current draft first if needed
      if (!careLogId) {
        await saveDraftMutation.mutateAsync(formData);
      }
      // Then submit
      await submitMutation.mutateAsync();
    } catch (error) {
      console.error('Submit error:', error);
      alert('Failed to submit. Please try again.');
    }
  };

  // Check if form is locked (submitted or invalidated)
  const isLocked = logStatus === 'submitted' || logStatus === 'invalidated';

  const sections = [
    { id: 1, title: 'Morning Routine', emoji: '🌅' },
    { id: 2, title: 'Medications', emoji: '💊' },
    { id: 3, title: 'Meals & Nutrition', emoji: '🍽️' },
    { id: 4, title: 'Vital Signs', emoji: '❤️' },
    { id: 5, title: 'Toileting', emoji: '🚽' },
    { id: 6, title: 'Notes & Submit', emoji: '📝' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-accent-50 pb-8">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-10 border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-primary-700">Daily Care Report</h1>
              <p className="text-sm text-gray-600">Today: {new Date().toLocaleDateString()}</p>
            </div>

            {/* Auto-save status */}
            <div className="flex items-center gap-3">
              {logStatus === 'draft' && (
                <div className="flex items-center gap-2 text-sm">
                  {isSaving ? (
                    <>
                      <Save className="h-4 w-4 animate-pulse text-blue-600" />
                      <span className="text-gray-600">Saving...</span>
                    </>
                  ) : lastSaved ? (
                    <>
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-gray-600">
                        Saved {new Date(lastSaved).toLocaleTimeString()}
                      </span>
                    </>
                  ) : (
                    <>
                      <Clock className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-400">Not saved yet</span>
                    </>
                  )}
                </div>
              )}
              {logStatus === 'submitted' && (
                <div className="flex items-center gap-2 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                  <CheckCircle className="h-4 w-4" />
                  Submitted
                </div>
              )}
              {logStatus === 'invalidated' && (
                <div className="flex items-center gap-2 px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
                  <AlertCircle className="h-4 w-4" />
                  Needs Correction
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Section Navigation */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {sections.map(section => (
            <button
              key={section.id}
              onClick={() => setCurrentSection(section.id)}
              className={`flex-shrink-0 px-4 py-2 rounded-lg font-medium transition-colors ${
                currentSection === section.id
                  ? 'bg-primary-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span className="mr-2">{section.emoji}</span>
              {section.title}
            </button>
          ))}
        </div>
      </div>

      {/* Form Sections */}
      <div className="max-w-4xl mx-auto px-4">
        {/* Section 1: Morning Routine */}
        {currentSection === 1 && (
          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold">🌅 Morning Routine</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLocked && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4">
                  <p className="text-sm text-gray-600 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    This form is locked and cannot be edited.
                  </p>
                </div>
              )}

              <Input
                label="Wake Up Time"
                type="time"
                value={wakeTime}
                onChange={(e) => setWakeTime(e.target.value)}
                helperText="When did they wake up today?"
                disabled={isLocked}
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Mood</label>
                <div className="grid grid-cols-2 gap-2">
                  {['alert', 'confused', 'sleepy', 'agitated', 'calm'].map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => !isLocked && setMood(m)}
                      disabled={isLocked}
                      className={`p-3 rounded-lg border-2 transition-colors ${
                        mood === m
                          ? 'border-primary-500 bg-primary-50 text-primary-700'
                          : 'border-gray-200 hover:border-gray-300'
                      } ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {m.charAt(0).toUpperCase() + m.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <Input
                label="Shower Time (optional)"
                type="time"
                value={showerTime}
                onChange={(e) => setShowerTime(e.target.value)}
                disabled={isLocked}
              />

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="hairWash"
                  checked={hairWash}
                  onChange={(e) => setHairWash(e.target.checked)}
                  className="w-5 h-5 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
                <label htmlFor="hairWash" className="text-sm font-medium text-gray-700">
                  Hair was washed today
                </label>
              </div>

              <Button onClick={() => setCurrentSection(2)} variant="primary" size="lg" className="w-full">
                Next: Medications →
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Section 2: Medications */}
        {currentSection === 2 && (
          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold">💊 Medications</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              {medications.map((med, idx) => (
                <div key={idx} className="border-2 border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <label className="font-medium text-gray-900">{med.name}</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={med.given}
                        onChange={(e) => {
                          const newMeds = [...medications];
                          newMeds[idx].given = e.target.checked;
                          if (e.target.checked && !newMeds[idx].time) {
                            newMeds[idx].time = new Date().toTimeString().slice(0, 5);
                          }
                          setMedications(newMeds);
                        }}
                        className="w-5 h-5"
                      />
                      <span className="text-sm text-gray-600">Given</span>
                    </div>
                  </div>
                  {med.given && (
                    <Input
                      label="Time given"
                      type="time"
                      value={med.time || ''}
                      onChange={(e) => {
                        const newMeds = [...medications];
                        newMeds[idx].time = e.target.value;
                        setMedications(newMeds);
                      }}
                    />
                  )}
                </div>
              ))}

              <div className="flex gap-3">
                <Button onClick={() => setCurrentSection(1)} variant="outline" className="flex-1">
                  ← Back
                </Button>
                <Button onClick={() => setCurrentSection(3)} variant="primary" className="flex-1">
                  Next →
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Section 3: Meals */}
        {currentSection === 3 && (
          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold">🍽️ Meals & Nutrition</h2>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="font-semibold mb-3">Breakfast</h3>
                <Input
                  label="Time"
                  type="time"
                  value={breakfastTime}
                  onChange={(e) => setBreakfastTime(e.target.value)}
                  className="mb-3"
                />
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Appetite (1-5): <span className="font-bold text-primary-600">{breakfastAppetite}</span>
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    value={breakfastAppetite}
                    onChange={(e) => setBreakfastAppetite(parseInt(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>No appetite</span>
                    <span>Excellent</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Amount Eaten: <span className="font-bold text-primary-600">{breakfastAmount}%</span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="25"
                    value={breakfastAmount}
                    onChange={(e) => setBreakfastAmount(parseInt(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>0%</span>
                    <span>25%</span>
                    <span>50%</span>
                    <span>75%</span>
                    <span>100%</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button onClick={() => setCurrentSection(2)} variant="outline" className="flex-1">
                  ← Back
                </Button>
                <Button onClick={() => setCurrentSection(4)} variant="primary" className="flex-1">
                  Next →
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Section 4: Vitals */}
        {currentSection === 4 && (
          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold">❤️ Vital Signs</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                label="Time Measured"
                type="time"
                value={vitalsTime}
                onChange={(e) => setVitalsTime(e.target.value)}
              />
              <Input
                label="Blood Pressure"
                type="text"
                value={bloodPressure}
                onChange={(e) => setBloodPressure(e.target.value)}
                placeholder="e.g., 120/80"
                helperText="Format: systolic/diastolic (e.g., 120/80)"
              />
              <Input
                label="Pulse Rate (bpm)"
                type="number"
                value={pulseRate}
                onChange={(e) => setPulseRate(e.target.value)}
                placeholder="e.g., 72"
              />
              <Input
                label="Oxygen Level (%)"
                type="number"
                min="0"
                max="100"
                value={oxygenLevel}
                onChange={(e) => setOxygenLevel(e.target.value)}
                placeholder="e.g., 98"
              />
              <Input
                label="Blood Sugar (mmol/L)"
                type="number"
                step="0.1"
                value={bloodSugar}
                onChange={(e) => setBloodSugar(e.target.value)}
                placeholder="e.g., 5.6"
              />

              <div className="flex gap-3">
                <Button onClick={() => setCurrentSection(3)} variant="outline" className="flex-1">
                  ← Back
                </Button>
                <Button onClick={() => setCurrentSection(5)} variant="primary" className="flex-1">
                  Next →
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Section 5: Toileting */}
        {currentSection === 5 && (
          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold">🚽 Toileting</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                label="Bowel Movements (count)"
                type="number"
                min="0"
                value={bowelFreq}
                onChange={(e) => setBowelFreq(parseInt(e.target.value))}
              />
              <Input
                label="Urination Frequency (count)"
                type="number"
                min="0"
                value={urineFreq}
                onChange={(e) => setUrineFreq(parseInt(e.target.value))}
              />
              <Input
                label="Diaper Changes (count)"
                type="number"
                min="0"
                value={diaperChanges}
                onChange={(e) => setDiaperChanges(parseInt(e.target.value))}
              />

              <div className="flex gap-3">
                <Button onClick={() => setCurrentSection(4)} variant="outline" className="flex-1">
                  ← Back
                </Button>
                <Button onClick={() => setCurrentSection(6)} variant="primary" className="flex-1">
                  Next →
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Section 6: Notes & Submit */}
        {currentSection === 6 && (
          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold">📝 Notes & Submit</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4 flex items-start gap-3">
                <input
                  type="checkbox"
                  id="emergency"
                  checked={emergencyFlag}
                  onChange={(e) => setEmergencyFlag(e.target.checked)}
                  className="w-5 h-5 mt-0.5"
                />
                <label htmlFor="emergency" className="flex-1">
                  <span className="font-semibold text-yellow-900">Emergency or Alert</span>
                  <p className="text-sm text-yellow-800 mt-1">
                    Check this if there was a fall, injury, or urgent situation
                  </p>
                </label>
              </div>

              {emergencyFlag && (
                <textarea
                  value={emergencyNote}
                  onChange={(e) => setEmergencyNote(e.target.value)}
                  placeholder="Describe the emergency or alert..."
                  className="w-full px-4 py-3 border-2 border-error rounded-lg focus:outline-none focus:ring-2 focus:ring-error"
                  rows={3}
                />
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  General Notes (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any additional observations or notes..."
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  rows={4}
                />
              </div>

              {/* Submit Section */}
              {isLocked ? (
                <div className="mt-6">
                  {logStatus === 'submitted' && (
                    <div className="bg-green-50 border-2 border-green-200 rounded-lg p-6 text-center">
                      <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-3" />
                      <h3 className="text-lg font-semibold text-green-900 mb-2">
                        Report Submitted Successfully!
                      </h3>
                      <p className="text-sm text-green-800">
                        Your care report has been submitted and is now locked. The family will be able to view it.
                      </p>
                      <Button
                        onClick={() => navigate({ to: '/caregiver/form' })}
                        variant="primary"
                        className="mt-4"
                      >
                        Create New Report for Tomorrow
                      </Button>
                    </div>
                  )}
                  {logStatus === 'invalidated' && (
                    <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6 text-center">
                      <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-3" />
                      <h3 className="text-lg font-semibold text-red-900 mb-2">
                        Report Flagged for Correction
                      </h3>
                      <p className="text-sm text-red-800 mb-4">
                        The family has flagged this report. Please review and create a new corrected report.
                      </p>
                      <Button
                        onClick={() => {
                          setLogStatus('draft');
                          setCareLogId(null);
                          setCurrentSection(1);
                        }}
                        variant="primary"
                        className="bg-red-600 hover:bg-red-700"
                      >
                        Create Corrected Report
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex gap-3">
                  <Button onClick={() => setCurrentSection(5)} variant="outline" className="flex-1">
                    ← Back
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    variant="primary"
                    size="lg"
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    disabled={submitMutation.isPending || isSaving}
                  >
                    {submitMutation.isPending ? 'Submitting...' : 'Submit Report ✅'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
