import React from 'react';
import '../styles/ConfirmDialog.css';

interface ConfirmDialogProps {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  isDangerous?: boolean;
}

/**
 * Generic confirmation dialog component.
 * Used for confirming dangerous actions like delete or LIVE mode execution.
 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDangerous = false,
}) => {
  return (
    <div className="confirm-dialog-overlay" onClick={onCancel}>
      <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <h2 className={isDangerous ? 'danger-title' : 'title'}>{title}</h2>
        <p className="message">{message}</p>
        <div className="dialog-actions">
          <button
            className={`btn ${isDangerous ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
          <button className="btn btn-secondary" onClick={onCancel}>
            {cancelText}
          </button>
        </div>
      </div>
    </div>
  );
};
