import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorState } from '@/components/common/ErrorState';
import { EmptyState } from '@/components/common/EmptyState';

describe('LoadingState', () => {
  it('renders with default message', () => {
    render(<LoadingState />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders with custom message', () => {
    render(<LoadingState message="Loading strategies..." />);
    expect(screen.getByText('Loading strategies...')).toBeInTheDocument();
  });
});

describe('ErrorState', () => {
  it('renders error message', () => {
    render(<ErrorState message="Something went wrong" />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('renders retry button when onRetry provided', () => {
    const onRetry = vi.fn();
    render(<ErrorState message="Error" onRetry={onRetry} />);
    expect(screen.getByText(/try again/i)).toBeInTheDocument();
  });
});

describe('EmptyState', () => {
  it('renders title and message', () => {
    render(
      <EmptyState title="No data" message="No items to display" />
    );
    expect(screen.getByText('No data')).toBeInTheDocument();
    expect(screen.getByText('No items to display')).toBeInTheDocument();
  });

  it('renders action button when provided', () => {
    const onAction = vi.fn();
    render(
      <EmptyState
        title="Empty"
        message="Start by creating one"
        actionLabel="Create"
        onAction={onAction}
      />
    );
    expect(screen.getByText(/create/i)).toBeInTheDocument();
  });
});

import { vi } from 'vitest';
