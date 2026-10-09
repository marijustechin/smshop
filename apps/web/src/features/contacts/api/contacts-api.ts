import * as React from 'react';
import { apiRequest } from '@/shared/api/client';
import type { PublicContacts } from '../model/types';

/** Public (unauthenticated) contact/store reads. */
export function getPublicContacts(signal?: AbortSignal): Promise<PublicContacts> {
  return apiRequest<PublicContacts>('/api/public/contacts', { signal });
}

export type ContactsStatus = 'loading' | 'ready' | 'error';

export interface UsePublicContactsResult {
  status: ContactsStatus;
  data: PublicContacts | null;
  retry: () => void;
}

/**
 * Loads the public contacts from the API at runtime so administrator edits are
 * visible without redeploying (no static freeze). Handles loading/failure without
 * ever displaying fabricated data.
 */
export function usePublicContacts(): UsePublicContactsResult {
  const [data, setData] = React.useState<PublicContacts | null>(null);
  const [status, setStatus] = React.useState<ContactsStatus>('loading');
  const [reloadToken, setReloadToken] = React.useState(0);

  React.useEffect(() => {
    const controller = new AbortController();
    getPublicContacts(controller.signal)
      .then((result) => {
        setData(result);
        setStatus('ready');
      })
      .catch(() => {
        if (controller.signal.aborted) {
          return;
        }
        setStatus('error');
      });
    return () => controller.abort();
  }, [reloadToken]);

  const retry = React.useCallback(() => {
    setStatus('loading');
    setReloadToken((token) => token + 1);
  }, []);

  return { status, data, retry };
}
