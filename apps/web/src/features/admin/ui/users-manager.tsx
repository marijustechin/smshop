'use client';

import * as React from 'react';
import type { UserRole } from '@/entities/user';
import { Alert } from '@/shared/ui/alert';
import { Button } from '@/shared/ui/button';
import { deleteUser, listUsers, updateUserRole } from '../api/admin-api';
import { describeAdminError, ROLE_LABELS } from '../model/messages';
import type { AdminUser, AuthedRequest, PaginatedUsers } from '../model/types';
import { UserActions } from './user-actions';

const PAGE_SIZE = 20;

type LoadStatus = 'loading' | 'ready' | 'error';

function formatDate(value: string | null): string {
  if (!value) {
    return '—';
  }
  return new Date(value).toLocaleString('lt-LT', { dateStyle: 'short', timeStyle: 'short' });
}

function VerificationBadge({ verified }: { verified: boolean }) {
  return verified ? (
    <span className="rounded-full bg-[#eef7ec] px-2 py-0.5 text-xs font-medium text-[#2f5d2a]">
      Patvirtintas
    </span>
  ) : (
    <span className="rounded-full bg-cream/60 px-2 py-0.5 text-xs font-medium text-muted">
      Nepatvirtintas
    </span>
  );
}

/**
 * Admin Users section: paginated list with role change and confirmed deletion.
 * All calls go through the authenticated request function supplied by the auth
 * feature; the API enforces authorization regardless of this UI.
 */
export function UsersManager({
  request,
  currentUserId,
}: {
  request: AuthedRequest;
  currentUserId: string;
}) {
  const [page, setPage] = React.useState(1);
  const [reloadToken, setReloadToken] = React.useState(0);
  const [data, setData] = React.useState<PaginatedUsers | null>(null);
  const [status, setStatus] = React.useState<LoadStatus>('loading');
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [confirmId, setConfirmId] = React.useState<string | null>(null);
  const [draftRoles, setDraftRoles] = React.useState<Record<string, UserRole>>({});

  React.useEffect(() => {
    let cancelled = false;
    listUsers(request, { page, pageSize: PAGE_SIZE })
      .then((result) => {
        if (cancelled) {
          return;
        }
        setData(result);
        setDraftRoles(Object.fromEntries(result.items.map((user) => [user.id, user.role])));
        setStatus('ready');
      })
      .catch((loadError: unknown) => {
        if (cancelled) {
          return;
        }
        setError(describeAdminError(loadError));
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [request, page, reloadToken]);

  const startLoading = () => {
    setError(null);
    setStatus('loading');
  };

  const goToPage = (nextPage: number) => {
    startLoading();
    setPage(nextPage);
  };

  const reload = () => {
    startLoading();
    setReloadToken((token) => token + 1);
  };

  const onSaveRole = async (user: AdminUser) => {
    const role = draftRoles[user.id];
    if (!role || role === user.role) {
      return;
    }
    setPendingId(user.id);
    setNotice(null);
    setError(null);
    try {
      const updated = await updateUserRole(request, user.id, role);
      setData((previous) =>
        previous
          ? {
              ...previous,
              items: previous.items.map((item) => (item.id === updated.id ? updated : item)),
            }
          : previous,
      );
      setDraftRoles((previous) => ({ ...previous, [updated.id]: updated.role }));
      setNotice(`Vaidmuo atnaujintas: ${updated.email}.`);
    } catch (saveError) {
      setError(describeAdminError(saveError));
    } finally {
      setPendingId(null);
    }
  };

  const onConfirmDelete = async (user: AdminUser) => {
    setPendingId(user.id);
    setNotice(null);
    setError(null);
    try {
      await deleteUser(request, user.id);
      setConfirmId(null);
      setNotice(`Naudotojas pašalintas: ${user.email}.`);
      // Step back a page when the last row on a later page was removed.
      if (data && data.items.length === 1 && page > 1) {
        goToPage(page - 1);
      } else {
        reload();
      }
    } catch (deleteError) {
      setError(describeAdminError(deleteError));
    } finally {
      setPendingId(null);
    }
  };

  const renderActions = (user: AdminUser) => (
    <UserActions
      user={user}
      isSelf={user.id === currentUserId}
      draftRole={draftRoles[user.id] ?? user.role}
      pending={pendingId === user.id}
      confirmingDelete={confirmId === user.id}
      onDraftRoleChange={(role) => setDraftRoles((previous) => ({ ...previous, [user.id]: role }))}
      onSaveRole={() => void onSaveRole(user)}
      onRequestDelete={() => setConfirmId(user.id)}
      onCancelDelete={() => setConfirmId(null)}
      onConfirmDelete={() => void onConfirmDelete(user)}
    />
  );

  return (
    <div className="space-y-4">
      {error ? <Alert variant="error">{error}</Alert> : null}
      {notice ? <Alert variant="success">{notice}</Alert> : null}

      {status === 'loading' && !data ? <p className="text-sm text-muted">Kraunama…</p> : null}

      {status === 'error' && !data ? (
        <Button variant="outline" onClick={reload}>
          Bandyti dar kartą
        </Button>
      ) : null}

      {data ? (
        data.items.length === 0 ? (
          <Alert variant="info">Naudotojų nerasta.</Alert>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block" data-testid="users-table">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
                    <th className="px-3 py-2 font-medium">El. paštas</th>
                    <th className="px-3 py-2 font-medium">Būsena</th>
                    <th className="px-3 py-2 font-medium">Vaidmuo</th>
                    <th className="px-3 py-2 font-medium">Sukurta</th>
                    <th className="px-3 py-2 font-medium">Paskutinis prisijungimas</th>
                    <th className="px-3 py-2 font-medium">Veiksmai</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((user) => (
                    <tr key={user.id} className="border-b border-border/60 align-top">
                      <td className="px-3 py-3 font-medium break-all text-ink">
                        {user.email}
                        {user.id === currentUserId ? (
                          <span className="ml-2 text-xs font-normal text-muted">(jūs)</span>
                        ) : null}
                      </td>
                      <td className="px-3 py-3">
                        <VerificationBadge verified={user.emailVerified} />
                      </td>
                      <td className="px-3 py-3 text-ink">{ROLE_LABELS[user.role]}</td>
                      <td className="px-3 py-3 text-muted">{formatDate(user.createdAt)}</td>
                      <td className="px-3 py-3 text-muted">{formatDate(user.lastLoginAt)}</td>
                      <td className="px-3 py-3">{renderActions(user)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="space-y-3 md:hidden" data-testid="users-list">
              {data.items.map((user) => (
                <li key={user.id} className="rounded-lg border border-border bg-white p-4">
                  <p className="font-medium break-all text-ink">
                    {user.email}
                    {user.id === currentUserId ? (
                      <span className="ml-2 text-xs font-normal text-muted">(jūs)</span>
                    ) : null}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
                    <VerificationBadge verified={user.emailVerified} />
                    <span>{ROLE_LABELS[user.role]}</span>
                  </div>
                  <p className="mt-2 text-xs text-muted">
                    Paskutinis prisijungimas: {formatDate(user.lastLoginAt)}
                  </p>
                  <div className="mt-3">{renderActions(user)}</div>
                </li>
              ))}
            </ul>
          </>
        )
      ) : null}

      {data && data.totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm">
          <Button
            variant="outline"
            size="sm"
            onClick={() => goToPage(Math.max(1, page - 1))}
            disabled={page <= 1 || status === 'loading'}
          >
            Atgal
          </Button>
          <span className="text-muted">
            {data.page} / {data.totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => goToPage(Math.min(data.totalPages, page + 1))}
            disabled={page >= data.totalPages || status === 'loading'}
          >
            Toliau
          </Button>
        </div>
      ) : null}
    </div>
  );
}
