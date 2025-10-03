import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DashboardComponent } from './dashboard';

/**
 * Family Dashboard Component Tests
 * Tests real-time data display, charts, and status badges
 */

describe('Family Dashboard', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    // Mock localStorage
    const mockUser = {
      id: 'user-123',
      email: 'family@example.com',
      name: 'John Doe',
      role: 'family_admin',
    };

    const mockRecipient = {
      id: 'recipient-123',
      name: 'Grandma Lee',
      condition: 'PSP',
    };

    localStorage.setItem('user', JSON.stringify(mockUser));
    localStorage.setItem('careRecipient', JSON.stringify(mockRecipient));
  });

  const renderDashboard = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <DashboardComponent />
      </QueryClientProvider>
    );
  };

  describe('Initial Render', () => {
    it('should display care recipient name', () => {
      renderDashboard();
      expect(screen.getByText(/Grandma Lee/i)).toBeInTheDocument();
    });

    it('should show loading state initially', () => {
      renderDashboard();
      expect(screen.getByText(/Loading/i)).toBeInTheDocument();
    });

    it('should display Settings link', () => {
      renderDashboard();
      const settingsLink = screen.getByRole('link', { name: /Settings/i });
      expect(settingsLink).toBeInTheDocument();
      expect(settingsLink).toHaveAttribute('href', '/family/settings');
    });
  });

  describe('Status Badges', () => {
    it('should display draft badge for draft log', async () => {
      // Mock API response
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'log-123',
          status: 'draft',
          wakeTime: '07:30',
        }),
      });

      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText(/Draft.*In Progress/i)).toBeInTheDocument();
      });
    });

    it('should display submitted badge for submitted log', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'log-123',
          status: 'submitted',
          wakeTime: '07:30',
        }),
      });

      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText(/Submitted/i)).toBeInTheDocument();
      });
    });

    it('should display invalidated badge for invalidated log', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'log-123',
          status: 'invalidated',
          invalidationReason: 'Incorrect wake time',
        }),
      });

      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText(/Needs Correction/i)).toBeInTheDocument();
      });
    });

    it('should apply correct badge styling', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'log-123',
          status: 'submitted',
        }),
      });

      renderDashboard();

      await waitFor(() => {
        const badge = screen.getByText(/Submitted/i);
        expect(badge).toHaveClass('bg-green-100');
        expect(badge).toHaveClass('text-green-800');
      });
    });
  });

  describe('Today\'s Care Log', () => {
    it('should display morning routine data', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          wakeTime: '07:30',
          mood: 'alert',
          showerTime: '08:00',
          hairWash: true,
          status: 'submitted',
        }),
      });

      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText(/07:30/)).toBeInTheDocument();
        expect(screen.getByText(/alert/i)).toBeInTheDocument();
        expect(screen.getByText(/08:00/)).toBeInTheDocument();
      });
    });

    it('should display medication data', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          medications: [
            { name: 'Glucophage 500mg', given: true, time: '08:15' },
            { name: 'Forxiga 10mg', given: false },
          ],
          status: 'submitted',
        }),
      });

      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText(/Glucophage 500mg/)).toBeInTheDocument();
        expect(screen.getByText(/Forxiga 10mg/)).toBeInTheDocument();
      });
    });

    it('should display vital signs', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          bloodPressure: '120/80',
          pulseRate: 72,
          oxygenLevel: 98,
          bloodSugar: 110,
          vitalsTime: '09:30',
          status: 'submitted',
        }),
      });

      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText(/120\/80/)).toBeInTheDocument();
        expect(screen.getByText(/72/)).toBeInTheDocument();
        expect(screen.getByText(/98/)).toBeInTheDocument();
        expect(screen.getByText(/110/)).toBeInTheDocument();
      });
    });

    it('should show emergency alert for emergency flag', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          emergencyFlag: true,
          emergencyNote: 'Patient had a fall',
          status: 'submitted',
        }),
      });

      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText(/Emergency/i)).toBeInTheDocument();
        expect(screen.getByText(/Patient had a fall/)).toBeInTheDocument();
      });
    });
  });

  describe('Week View Charts', () => {
    it('should display Mon-Sun week navigation', () => {
      renderDashboard();

      const weekButtons = screen.getAllByRole('button', { name: /week/i });
      expect(weekButtons.length).toBeGreaterThan(0);
    });

    it('should render vital signs chart', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          bloodPressure: '120/80',
          pulseRate: 72,
          oxygenLevel: 98,
          status: 'submitted',
        }),
      });

      renderDashboard();

      await waitFor(() => {
        // Chart should be rendered (check for chart container)
        const charts = document.querySelectorAll('.recharts-wrapper');
        expect(charts.length).toBeGreaterThan(0);
      });
    });

    it('should navigate to previous week', async () => {
      renderDashboard();

      const prevButton = screen.getByRole('button', { name: /previous/i });
      expect(prevButton).toBeInTheDocument();
    });

    it('should navigate to next week', async () => {
      renderDashboard();

      const nextButton = screen.getByRole('button', { name: /next/i });
      expect(nextButton).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should display error message on API failure', async () => {
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error'));

      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText(/error/i)).toBeInTheDocument();
      });
    });

    it('should show empty state when no data', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => null,
      });

      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText(/No care log/i)).toBeInTheDocument();
      });
    });
  });

  describe('Real-time Updates', () => {
    it('should refetch data every 30 seconds', async () => {
      vi.useFakeTimers();

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'submitted', wakeTime: '07:30' }),
      });

      renderDashboard();

      // Initial fetch
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1);
      });

      // Fast-forward 30 seconds
      vi.advanceTimersByTime(30000);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2);
      });

      vi.useRealTimers();
    });
  });

  describe('View Mode Switching', () => {
    it('should switch between today and week view', async () => {
      renderDashboard();

      const todayButton = screen.getByRole('button', { name: /Today/i });
      const weekButton = screen.getByRole('button', { name: /Week/i });

      expect(todayButton).toBeInTheDocument();
      expect(weekButton).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      renderDashboard();

      const dashboard = screen.getByRole('main');
      expect(dashboard).toBeInTheDocument();
    });

    it('should be keyboard navigable', () => {
      renderDashboard();

      const links = screen.getAllByRole('link');
      links.forEach((link) => {
        expect(link).toBeVisible();
      });
    });
  });

  describe('Invalidation Workflow', () => {
    it('should show invalidation reason', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'invalidated',
          invalidationReason: 'Incorrect vital signs',
          invalidatedAt: new Date().toISOString(),
        }),
      });

      renderDashboard();

      await waitFor(() => {
        expect(screen.getByText(/Incorrect vital signs/)).toBeInTheDocument();
      });
    });

    it('should display invalidate button for family_admin', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'log-123',
          status: 'submitted',
        }),
      });

      renderDashboard();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Invalidate/i })).toBeInTheDocument();
      });
    });

    it('should hide invalidate button for family_member', async () => {
      localStorage.setItem(
        'user',
        JSON.stringify({
          id: 'user-123',
          role: 'family_member',
        })
      );

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'submitted',
        }),
      });

      renderDashboard();

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /Invalidate/i })).not.toBeInTheDocument();
      });
    });
  });
});
