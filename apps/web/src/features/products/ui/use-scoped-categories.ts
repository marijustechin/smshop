'use client';

import * as React from 'react';
import { listCategories } from '../api/products-api';
import { describeProductError } from '../model/labels';
import type { AdminCategory, AuthedRequest, ProductScope } from '../model/types';

export interface ScopedCategories {
  categories: AdminCategory[];
  status: 'loading' | 'ready' | 'error';
  error: string | null;
  /** Explicit invalidation: re-fetches the categories of this scope. */
  reload: () => void;
}

/**
 * Single, well-defined category source for one product scope. Category management
 * and product forms share this state, so a category created/edited in the
 * category table is immediately offered by the product form in the same scope.
 * The scope is part of the fetch key, so scopes are never mixed.
 */
export function useScopedCategories(request: AuthedRequest, scope: ProductScope): ScopedCategories {
  const [categories, setCategories] = React.useState<AdminCategory[]>([]);
  const [status, setStatus] = React.useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = React.useState<string | null>(null);
  const [reloadToken, setReloadToken] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    listCategories(request, scope)
      .then((result) => {
        if (cancelled) {
          return;
        }
        setCategories(result);
        setError(null);
        setStatus('ready');
      })
      .catch((loadError: unknown) => {
        if (cancelled) {
          return;
        }
        setError(describeProductError(loadError));
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [request, scope, reloadToken]);

  const reload = React.useCallback(() => {
    setError(null);
    setStatus('loading');
    setReloadToken((token) => token + 1);
  }, []);

  return { categories, status, error, reload };
}
