import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ErrorBoundary from '@/app/error';

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

describe('Error boundary', () => {
    it('shows only the fixed safe message and logs the original error for diagnostics', async () => {
        const error = Object.assign(
            new Error('MongoServerError: auth failed at host db.internal:27017'),
            {
                digest: 'private-error-digest',
                stack: 'MongoServerError stack with private server details',
            }
        );
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        render(<ErrorBoundary error={error} reset={vi.fn()} />);

        const alert = screen.getByRole('alert');
        expect(alert).toHaveTextContent('An unexpected error occurred. Please try again.');
        expect(document.body).not.toHaveTextContent(error.message);
        expect(document.body).not.toHaveTextContent(error.digest);
        expect(document.body).not.toHaveTextContent(error.stack);
        await waitFor(() => expect(errorSpy).toHaveBeenCalledWith('حدث خطأ:', error));
    });

    it('renders the fixed heading and invokes reset once when Try Again is clicked', async () => {
        const reset = vi.fn();
        const error = new Error('internal detail');
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const user = userEvent.setup();

        render(<ErrorBoundary error={error} reset={reset} />);

        expect(screen.getByRole('heading', { name: 'Something Went Wrong!!' })).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: '(Try Again)' }));

        expect(reset).toHaveBeenCalledTimes(1);
        await waitFor(() => expect(errorSpy).toHaveBeenCalledWith('حدث خطأ:', error));
    });
});
