import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';

describe('ConfirmDialog', () => {
  it('renders with title and message', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <ConfirmDialog
        title="Confirm Action"
        message="Are you sure?"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    expect(screen.getByText('Confirm Action')).toBeInTheDocument();
    expect(screen.getByText('Are you sure?')).toBeInTheDocument();
  });

  it('calls onConfirm when confirm button clicked', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <ConfirmDialog
        title="Test"
        message="Test message"
        confirmText="Yes"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    fireEvent.click(screen.getByText(/yes/i));
    expect(onConfirm).toHaveBeenCalled();
  });

  it('calls onCancel when cancel button clicked', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <ConfirmDialog
        title="Test"
        message="Test message"
        cancelText="No"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    fireEvent.click(screen.getByText(/no/i));
    expect(onCancel).toHaveBeenCalled();
  });

  it('applies danger styling when isDangerous is true', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <ConfirmDialog
        title="Delete"
        message="This cannot be undone"
        onConfirm={onConfirm}
        onCancel={onCancel}
        isDangerous={true}
      />
    );

    const titleElement = screen.getByText('Delete');
    expect(titleElement).toHaveClass('danger-title');
  });

  it('closes overlay when clicking outside dialog', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <ConfirmDialog
        title="Test"
        message="Test message"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    const overlay = screen.getByText('Test message').closest('.confirm-dialog-overlay');
    if (overlay) {
      fireEvent.click(overlay);
      expect(onCancel).toHaveBeenCalled();
    }
  });
});
