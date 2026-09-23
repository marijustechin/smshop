'use client';

import { USER_ROLES, type UserRole } from '@/entities/user';
import { Button } from '@/shared/ui/button';
import { ROLE_LABELS } from '../model/messages';
import type { AdminUser } from '../model/types';

interface UserActionsProps {
  user: AdminUser;
  isSelf: boolean;
  draftRole: UserRole;
  pending: boolean;
  confirmingDelete: boolean;
  onDraftRoleChange: (role: UserRole) => void;
  onSaveRole: () => void;
  onRequestDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
}

/**
 * Role change and deletion controls for one user. Self-administration is
 * disabled in the UI for clarity; the server independently rejects it.
 */
export function UserActions({
  user,
  isSelf,
  draftRole,
  pending,
  confirmingDelete,
  onDraftRoleChange,
  onSaveRole,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
}: UserActionsProps) {
  if (isSelf) {
    return <p className="text-xs text-text-muted">Tai jūsų paskyra — keisti negalima.</p>;
  }

  const roleChanged = draftRole !== user.role;
  const selectId = `role-${user.id}`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor={selectId} className="sr-only">
        Vaidmuo naudotojui {user.email}
      </label>
      <select
        id={selectId}
        value={draftRole}
        disabled={pending}
        onChange={(event) => onDraftRoleChange(event.target.value as UserRole)}
        className="h-9 rounded-md border border-border bg-surface px-2 text-sm text-text disabled:opacity-50"
      >
        {USER_ROLES.map((role) => (
          <option key={role} value={role}>
            {ROLE_LABELS[role]}
          </option>
        ))}
      </select>
      <Button size="sm" variant="outline" onClick={onSaveRole} disabled={pending || !roleChanged}>
        {pending ? 'Saugoma…' : 'Išsaugoti'}
      </Button>

      {confirmingDelete ? (
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-danger">Tikrai šalinti?</span>
          <Button size="sm" variant="primary" onClick={onConfirmDelete} disabled={pending}>
            Taip, šalinti
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancelDelete} disabled={pending}>
            Atšaukti
          </Button>
        </span>
      ) : (
        <Button size="sm" variant="ghost" onClick={onRequestDelete} disabled={pending}>
          Šalinti
        </Button>
      )}
    </div>
  );
}
