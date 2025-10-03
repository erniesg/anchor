import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAutoSave } from './use-auto-save';

/**
 * Auto-Save Hook Tests
 * Tests auto-save functionality with debouncing and error handling
 */

describe('useAutoSave Hook', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should initialize with idle status', () => {
    const saveFn = vi.fn();
    const { result } = renderHook(() => useAutoSave(saveFn, {}, 1000));

    expect(result.current.status).toBe('idle');
  });

  it('should trigger save after debounce delay', async () => {
    const saveFn = vi.fn().mockResolvedValue({ success: true });
    const data = { wakeTime: '07:30' };

    const { result, rerender } = renderHook(
      ({ value }) => useAutoSave(saveFn, value, 1000),
      { initialProps: { value: data } }
    );

    // Update data
    rerender({ value: { wakeTime: '08:00' } });

    // Status should change to pending
    expect(result.current.status).toBe('pending');

    // Fast-forward time
    vi.advanceTimersByTime(1000);

    await waitFor(() => {
      expect(saveFn).toHaveBeenCalledTimes(1);
      expect(result.current.status).toBe('saved');
    });
  });

  it('should debounce multiple rapid changes', async () => {
    const saveFn = vi.fn().mockResolvedValue({ success: true });

    const { result, rerender } = renderHook(
      ({ value }) => useAutoSave(saveFn, value, 1000),
      { initialProps: { value: { wakeTime: '07:00' } } }
    );

    // Rapid updates
    rerender({ value: { wakeTime: '07:30' } });
    vi.advanceTimersByTime(500);

    rerender({ value: { wakeTime: '08:00' } });
    vi.advanceTimersByTime(500);

    rerender({ value: { wakeTime: '08:30' } });
    vi.advanceTimersByTime(500);

    rerender({ value: { wakeTime: '09:00' } });
    vi.advanceTimersByTime(1000);

    await waitFor(() => {
      // Should only save once after debounce
      expect(saveFn).toHaveBeenCalledTimes(1);
      expect(saveFn).toHaveBeenCalledWith({ wakeTime: '09:00' });
    });
  });

  it('should handle save errors', async () => {
    const saveFn = vi.fn().mockRejectedValue(new Error('Network error'));
    const data = { wakeTime: '07:30' };

    const { result, rerender } = renderHook(
      ({ value }) => useAutoSave(saveFn, value, 1000),
      { initialProps: { value: data } }
    );

    rerender({ value: { wakeTime: '08:00' } });
    vi.advanceTimersByTime(1000);

    await waitFor(() => {
      expect(result.current.status).toBe('error');
      expect(result.current.error).toBeDefined();
      expect(result.current.error?.message).toBe('Network error');
    });
  });

  it('should reset error on next successful save', async () => {
    const saveFn = vi.fn()
      .mockRejectedValueOnce(new Error('First error'))
      .mockResolvedValueOnce({ success: true });

    const { result, rerender } = renderHook(
      ({ value }) => useAutoSave(saveFn, value, 1000),
      { initialProps: { value: { wakeTime: '07:00' } } }
    );

    // First update (error)
    rerender({ value: { wakeTime: '08:00' } });
    vi.advanceTimersByTime(1000);

    await waitFor(() => {
      expect(result.current.status).toBe('error');
    });

    // Second update (success)
    rerender({ value: { wakeTime: '09:00' } });
    vi.advanceTimersByTime(1000);

    await waitFor(() => {
      expect(result.current.status).toBe('saved');
      expect(result.current.error).toBeNull();
    });
  });

  it('should not save if data is unchanged', async () => {
    const saveFn = vi.fn().mockResolvedValue({ success: true });
    const data = { wakeTime: '07:30' };

    const { rerender } = renderHook(
      ({ value }) => useAutoSave(saveFn, value, 1000),
      { initialProps: { value: data } }
    );

    // Trigger with same data
    rerender({ value: data });
    vi.advanceTimersByTime(1000);

    await waitFor(() => {
      expect(saveFn).not.toHaveBeenCalled();
    });
  });

  it('should customize debounce delay', async () => {
    const saveFn = vi.fn().mockResolvedValue({ success: true });

    const { rerender } = renderHook(
      ({ value }) => useAutoSave(saveFn, value, 5000), // 5 second delay
      { initialProps: { value: { wakeTime: '07:00' } } }
    );

    rerender({ value: { wakeTime: '08:00' } });

    // Should NOT save after 1 second
    vi.advanceTimersByTime(1000);
    expect(saveFn).not.toHaveBeenCalled();

    // Should NOT save after 3 seconds
    vi.advanceTimersByTime(3000);
    expect(saveFn).not.toHaveBeenCalled();

    // Should save after 5 seconds total
    vi.advanceTimersByTime(1000);
    await waitFor(() => {
      expect(saveFn).toHaveBeenCalledTimes(1);
    });
  });

  it('should cleanup on unmount', () => {
    const saveFn = vi.fn();
    const { unmount, rerender } = renderHook(
      ({ value }) => useAutoSave(saveFn, value, 1000),
      { initialProps: { value: { wakeTime: '07:00' } } }
    );

    rerender({ value: { wakeTime: '08:00' } });
    unmount();

    // Should not save after unmount
    vi.advanceTimersByTime(1000);
    expect(saveFn).not.toHaveBeenCalled();
  });

  it('should expose manual save function', async () => {
    const saveFn = vi.fn().mockResolvedValue({ success: true });

    const { result } = renderHook(() => useAutoSave(saveFn, { wakeTime: '07:30' }, 1000));

    // Manual save
    await result.current.save();

    expect(saveFn).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('saved');
  });

  it('should handle concurrent saves', async () => {
    const saveFn = vi.fn().mockImplementation(() =>
      new Promise(resolve => setTimeout(() => resolve({ success: true }), 500))
    );

    const { result, rerender } = renderHook(
      ({ value }) => useAutoSave(saveFn, value, 1000),
      { initialProps: { value: { wakeTime: '07:00' } } }
    );

    // First save
    rerender({ value: { wakeTime: '08:00' } });
    vi.advanceTimersByTime(1000);

    // Second save while first is pending
    rerender({ value: { wakeTime: '09:00' } });
    vi.advanceTimersByTime(1000);

    await waitFor(() => {
      // Should handle both saves correctly
      expect(saveFn).toHaveBeenCalledTimes(2);
    });
  });

  it('should track last saved timestamp', async () => {
    const saveFn = vi.fn().mockResolvedValue({ success: true });

    const { result, rerender } = renderHook(
      ({ value }) => useAutoSave(saveFn, value, 1000),
      { initialProps: { value: { wakeTime: '07:00' } } }
    );

    expect(result.current.lastSaved).toBeNull();

    rerender({ value: { wakeTime: '08:00' } });
    vi.advanceTimersByTime(1000);

    await waitFor(() => {
      expect(result.current.lastSaved).toBeDefined();
      expect(result.current.lastSaved).toBeInstanceOf(Date);
    });
  });
});

describe('useAutoSave Edge Cases', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should handle null/undefined data', async () => {
    const saveFn = vi.fn().mockResolvedValue({ success: true });

    const { rerender } = renderHook(
      ({ value }) => useAutoSave(saveFn, value, 1000),
      { initialProps: { value: null } }
    );

    rerender({ value: undefined });
    vi.advanceTimersByTime(1000);

    // Should not crash
    expect(saveFn).not.toHaveBeenCalled();
  });

  it('should handle deep object changes', async () => {
    const saveFn = vi.fn().mockResolvedValue({ success: true });

    const { rerender } = renderHook(
      ({ value }) => useAutoSave(saveFn, value, 1000),
      {
        initialProps: {
          value: {
            meals: {
              breakfast: { time: '08:00', appetite: 4 },
            },
          },
        },
      }
    );

    // Deep change
    rerender({
      value: {
        meals: {
          breakfast: { time: '08:00', appetite: 5 }, // Only appetite changed
        },
      },
    });

    vi.advanceTimersByTime(1000);

    await waitFor(() => {
      expect(saveFn).toHaveBeenCalledTimes(1);
    });
  });

  it('should handle array changes', async () => {
    const saveFn = vi.fn().mockResolvedValue({ success: true });

    const { rerender } = renderHook(
      ({ value }) => useAutoSave(saveFn, value, 1000),
      {
        initialProps: {
          value: {
            medications: [{ name: 'Med1', given: true }],
          },
        },
      }
    );

    // Add medication
    rerender({
      value: {
        medications: [
          { name: 'Med1', given: true },
          { name: 'Med2', given: false },
        ],
      },
    });

    vi.advanceTimersByTime(1000);

    await waitFor(() => {
      expect(saveFn).toHaveBeenCalledTimes(1);
    });
  });

  it('should handle network timeout', async () => {
    const saveFn = vi.fn().mockImplementation(
      () => new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), 5000)
      )
    );

    const { result, rerender } = renderHook(
      ({ value }) => useAutoSave(saveFn, value, 1000),
      { initialProps: { value: { wakeTime: '07:00' } } }
    );

    rerender({ value: { wakeTime: '08:00' } });
    vi.advanceTimersByTime(1000);

    // Fast-forward to timeout
    vi.advanceTimersByTime(5000);

    await waitFor(() => {
      expect(result.current.status).toBe('error');
      expect(result.current.error?.message).toBe('Timeout');
    });
  });
});
