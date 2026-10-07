'use client';

import * as React from 'react';
import { Alert } from './alert';
import { Button } from './button';

export interface ConfirmDialogProps {
  /** Controlled open state owned by the caller. */
  open: boolean;
  title: string;
  /** Body copy; a ReactNode so callers can interpolate e.g. a user email. */
  description: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** Visual emphasis of the confirm action. */
  variant?: 'default' | 'destructive';
  /** While true the request is in flight: the dialog cannot be dismissed. */
  isBusy?: boolean;
  /** Optional concise error shown inside the dialog (kept open for retry). */
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"]), input, select, textarea';

/**
 * Reusable controlled confirmation dialog for destructive (or similar) actions.
 * The caller owns the open state and the selected target. While `isBusy` the
 * dialog cannot be dismissed (Escape, backdrop click, or cancel) so a
 * destructive request in flight is never abandoned or double-submitted, and
 * focus returns to the previously focused element when it closes.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Atšaukti',
  variant = 'default',
  isBusy = false,
  error = null,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = React.useId();
  const descriptionId = React.useId();
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const confirmRef = React.useRef<HTMLButtonElement>(null);
  const previouslyFocused = React.useRef<HTMLElement | null>(null);

  const onCancelRef = React.useRef(onCancel);
  const isBusyRef = React.useRef(isBusy);
  React.useEffect(() => {
    onCancelRef.current = onCancel;
    isBusyRef.current = isBusy;
  }, [onCancel, isBusy]);

  React.useEffect(() => {
    if (!open) {
      return;
    }
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    confirmRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (!isBusyRef.current) {
          event.preventDefault();
          onCancelRef.current();
        }
        return;
      }
      if (event.key !== 'Tab') {
        return;
      }
      const dialog = dialogRef.current;
      if (!dialog) {
        return;
      }
      const focusables = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (element) => element.offsetParent !== null || element === document.activeElement,
      );
      if (focusables.length === 0) {
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-ink/40"
        data-testid="confirm-dialog-backdrop"
        onClick={() => {
          if (!isBusyRef.current) {
            onCancelRef.current();
          }
        }}
      />
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        aria-busy={isBusy}
        data-testid="confirm-dialog"
        className="relative z-10 w-full max-w-md rounded-lg border border-border bg-surface p-6 shadow-md"
      >
        <h2 id={titleId} className="text-lg font-semibold text-primary">
          {title}
        </h2>
        <p id={descriptionId} className="mt-2 text-sm text-text-muted">
          {description}
        </p>

        {error ? (
          <Alert variant="error" className="mt-4">
            {error}
          </Alert>
        ) : null}

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={isBusy}>
            {cancelLabel}
          </Button>
          <Button
            ref={confirmRef}
            variant={variant === 'destructive' ? 'destructive' : 'primary'}
            onClick={onConfirm}
            disabled={isBusy}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
