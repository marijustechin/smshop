'use client';

import * as React from 'react';
import Link from 'next/link';
import { Alert } from '@/shared/ui/alert';
import { Button, buttonVariants } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { getDashboardSummary } from '../api/admin-api';
import { describeAdminError, ROLE_LABELS } from '../model/messages';
import type { AdminDashboardSummary, AuthedRequest } from '../model/types';

type LoadStatus = 'loading' | 'ready' | 'error';

function formatDate(value: string): string {
  return new Date(value).toLocaleString('lt-LT', { dateStyle: 'short', timeStyle: 'short' });
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-5">
      <p className="text-sm text-text-muted">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-primary">{value}</p>
    </Card>
  );
}

/**
 * Administration dashboard (Suvestinė). Shows only real data returned by the
 * admin summary endpoint: counts and the most recent users. All requests go
 * through the authenticated request function supplied by the auth feature.
 */
export function DashboardSummary({ request }: { request: AuthedRequest }) {
  const [data, setData] = React.useState<AdminDashboardSummary | null>(null);
  const [status, setStatus] = React.useState<LoadStatus>('loading');
  const [error, setError] = React.useState<string | null>(null);
  const [reloadToken, setReloadToken] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    getDashboardSummary(request)
      .then((summary) => {
        if (cancelled) {
          return;
        }
        setData(summary);
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
  }, [request, reloadToken]);

  const reload = () => {
    setError(null);
    setStatus('loading');
    setReloadToken((token) => token + 1);
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-primary">Suvestinė</h1>
        <p className="mt-1 text-sm text-text-muted">Administravimo zona</p>
      </div>

      {status === 'loading' && !data ? <p className="text-sm text-text-muted">Kraunama…</p> : null}

      {status === 'error' && !data ? (
        <div className="space-y-3">
          <Alert variant="error">{error}</Alert>
          <Button variant="outline" onClick={reload}>
            Bandyti dar kartą
          </Button>
        </div>
      ) : null}

      {data ? (
        <>
          {status === 'error' ? <Alert variant="error">{error}</Alert> : null}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Naudotojai iš viso" value={data.totalUsers} />
            <StatCard label="Patvirtinti el. paštai" value={data.verifiedUsers} />
            <StatCard label="Administratoriai" value={data.roleCounts.admin} />
            <StatCard label="Redaktoriai" value={data.roleCounts.editor} />
          </div>

          <Card className="p-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
              <h2 className="text-lg font-semibold text-primary">Naujausi naudotojai</h2>
              <Link
                href="/administravimas/naudotojai"
                className="text-sm font-medium text-primary hover:underline"
              >
                Tvarkyti naudotojus
              </Link>
            </div>
            {data.recentUsers.length === 0 ? (
              <p className="px-5 py-6 text-sm text-text-muted">Naudotojų nerasta.</p>
            ) : (
              <ul className="divide-y divide-border">
                {data.recentUsers.map((user) => (
                  <li
                    key={user.id}
                    className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-text">{user.email}</p>
                      <p className="text-xs text-text-muted">{ROLE_LABELS[user.role]}</p>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className={user.emailVerified ? 'text-success' : 'text-text-muted'}>
                        {user.emailVerified ? 'Patvirtintas' : 'Nepatvirtintas'}
                      </span>
                      <span className="text-text-muted">{formatDate(user.createdAt)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
            <div>
              <h2 className="text-base font-semibold text-primary">Naudotojų valdymas</h2>
              <p className="mt-1 text-sm text-text-muted">
                Peržiūrėkite naudotojus, keiskite vaidmenis ir šalinkite testines paskyras.
              </p>
            </div>
            <Link
              href="/administravimas/naudotojai"
              className={buttonVariants({ variant: 'primary' })}
            >
              Tvarkyti naudotojus
            </Link>
          </Card>
        </>
      ) : null}
    </div>
  );
}
