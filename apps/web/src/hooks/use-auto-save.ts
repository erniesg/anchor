import { useEffect, useRef, useState } from 'react';

interface UseAutoSaveOptions {
  data: any;
  onSave: (data: any) => Promise<void>;
  interval?: number; // milliseconds
  enabled?: boolean;
  isDraft?: boolean;
}

export function useAutoSave({
  data,
  onSave,
  interval = 30000, // 30 seconds default
  enabled = true,
  isDraft = true,
}: UseAutoSaveOptions) {
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const dataRef = useRef(data);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Update ref when data changes
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  // Auto-save effect
  useEffect(() => {
    if (!enabled || !isDraft) {
      return;
    }

    const performSave = async () => {
      setIsSaving(true);
      setSaveError(null);

      try {
        await onSave(dataRef.current);
        setLastSaved(new Date());
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : 'Failed to save');
        console.error('Auto-save error:', error);
      } finally {
        setIsSaving(false);
      }
    };

    // Set up auto-save interval
    saveTimeoutRef.current = setInterval(performSave, interval);

    // Cleanup on unmount or when dependencies change
    return () => {
      if (saveTimeoutRef.current) {
        clearInterval(saveTimeoutRef.current);
      }
    };
  }, [enabled, isDraft, interval, onSave]);

  // Manual save function
  const saveNow = async () => {
    if (isSaving) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      await onSave(dataRef.current);
      setLastSaved(new Date());
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save');
      console.error('Manual save error:', error);
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  return {
    lastSaved,
    isSaving,
    saveError,
    saveNow,
  };
}
