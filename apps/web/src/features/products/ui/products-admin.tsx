'use client';

import * as React from 'react';
import { cn } from '@/shared/lib/cn';
import { SCOPE_LABELS } from '../model/labels';
import type { AuthedRequest, ProductScope } from '../model/types';
import { CategoriesPanel } from './categories-panel';
import { ProductsPanel } from './products-panel';
import { useScopedCategories } from './use-scoped-categories';

const SCOPES: ProductScope[] = ['CATALOG', 'SHOP'];

/**
 * Admin product area. The two public product areas are presented as clearly
 * separated tabs and always managed independently: the informational catalogue
 * and the purchasable e-shop.
 */
export function ProductsAdmin({ request }: { request: AuthedRequest }) {
  const [scope, setScope] = React.useState<ProductScope>('CATALOG');
  // One category source per scope, shared by the category table and the product
  // form so newly created/edited categories are immediately selectable.
  const { categories, status, error, reload } = useScopedCategories(request, scope);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-primary">Prekės</h1>
        <p className="mt-1 text-sm text-text-muted">
          Prekių katalogas ir el. parduotuvė yra atskiros sritys ir valdomos atskirai.
        </p>
      </div>

      <div role="tablist" aria-label="Prekių sritys" className="flex flex-wrap gap-1">
        {SCOPES.map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={scope === value}
            onClick={() => setScope(value)}
            className={cn(
              'rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-focus',
              scope === value
                ? 'bg-primary text-on-primary'
                : 'border border-border bg-surface text-text-muted hover:text-primary',
            )}
          >
            {SCOPE_LABELS[value]}
          </button>
        ))}
      </div>

      <div role="tabpanel" aria-label={SCOPE_LABELS[scope]} className="space-y-6">
        <CategoriesPanel
          key={`categories-${scope}`}
          request={request}
          scope={scope}
          categories={categories}
          status={status}
          error={error}
          onChanged={reload}
        />
        <ProductsPanel
          key={`products-${scope}`}
          request={request}
          scope={scope}
          categories={categories}
        />
      </div>
    </div>
  );
}
