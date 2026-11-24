import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ErrorBoundary from '@/app/error';
import Loading from '@/app/loading';
import TodoDashboardMetrics from '@/components/TodoDashboardMetrics';

afterEach((): void => {
  vi.restoreAllMocks();
});

describe('Todo dashboard UI', () => {
  it('shows all metrics, active due-date subset context, and the empty state', () => {
    render(<TodoDashboardMetrics metrics={{ total: 0, active: 0, completed: 0, overdue: 0, dueToday: 0, upcoming: 0, completionRate: 0 }} />);

    expect(screen.getByRole('region', { name: 'Todo dashboard metrics' })).toBeInTheDocument();
    for (const name of ['Total', 'Active', 'Completed', 'Overdue', 'Due Today', 'Upcoming', 'Completion Rate']) {
      expect(screen.getByText(name)).toBeInTheDocument();
    }
    expect(screen.getAllByText('0').length).toBeGreaterThanOrEqual(6);
    expect(screen.getByText('0%')).toBeInTheDocument();
    expect(screen.getByText('No Todos yet. Add a Todo to start tracking your progress.')).toBeInTheDocument();
    expect(screen.getByText('Active · before today')).toBeInTheDocument();
  });

  it('shows the dashboard loading state while the page data is pending', () => {
    render(<Loading />);
    expect(screen.getByRole('status', { name: 'Loading dashboard' })).toHaveAttribute('aria-busy', 'true');
  });

  it('uses the route error state when Dashboard data fails', async () => {
    const error = new Error('private database detail');
    const reset = vi.fn();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<ErrorBoundary error={error} reset={reset} />);

    expect(screen.getByRole('alert')).toHaveTextContent('An unexpected error occurred. Please try again.');
    expect(document.body).not.toHaveTextContent('private database detail');
    await waitFor(() => expect(errorSpy).toHaveBeenCalledWith('حدث خطأ:', error));
  });
});
