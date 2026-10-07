'use client';

import * as React from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { Alert } from '@/shared/ui/alert';
import { Button } from '@/shared/ui/button';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import {
  createCatalogProduct,
  createCatalogTag,
  deleteProduct,
  listCatalogTags,
  listProducts,
  updateProduct,
  uploadProductImage,
} from '../api/products-api';
import { describeProductError, formatPriceCents, STATUS_LABELS } from '../model/labels';
import { resolveMediaUrl } from '@/shared/config/api';
import type {
  AdminCategory,
  AuthedRequest,
  CatalogProduct,
  CatalogProductInput,
  CatalogTag,
  ProductScope,
  ProductStatus,
  ShopProduct,
  ShopProductInput,
} from '../model/types';

const PAGE_SIZE = 20;
const PRODUCT_STATUSES: ProductStatus[] = ['DRAFT', 'PUBLISHED', 'HIDDEN'];
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
/**
 * Catalogue-only editorial limit, mirrored from the API DTO. Full descriptions
 * must stay short enough to sit beside the product image. E-shop products keep
 * their own (larger) description limit.
 */
const CATALOG_DESCRIPTION_MAX_LENGTH = 1000;

interface FormState {
  categoryId: string;
  name: string;
  slug: string;
  shortDescription: string;
  description: string;
  primaryImageUrl: string;
  status: ProductStatus;
  featured: boolean;
  displayOrder: string;
  /** Catalogue-only reusable tag ids. */
  tagIds: string[];
  sku: string;
  priceEuros: string;
  salePriceEuros: string;
  stockQuantity: string;
  saleStartsAt: string;
  saleEndsAt: string;
}

const EMPTY_FORM: FormState = {
  categoryId: '',
  name: '',
  slug: '',
  shortDescription: '',
  description: '',
  primaryImageUrl: '',
  status: 'DRAFT',
  featured: false,
  displayOrder: '0',
  tagIds: [],
  sku: '',
  priceEuros: '',
  salePriceEuros: '',
  stockQuantity: '0',
  saleStartsAt: '',
  saleEndsAt: '',
};

function isShop(product: CatalogProduct | ShopProduct): product is ShopProduct {
  return 'priceCents' in product;
}

function centsToEurosInput(cents: number | null): string {
  return cents === null ? '' : (cents / 100).toFixed(2);
}

function StatusBadge({ status }: { status: ProductStatus }) {
  const tone =
    status === 'PUBLISHED'
      ? 'bg-success-surface text-success'
      : status === 'HIDDEN'
        ? 'bg-surface-muted text-text-muted'
        : 'bg-warning-surface text-warning';
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

/**
 * Product management for one scope. The catalogue scope deliberately shows no
 * commercial columns; the e-shop scope shows price, active sale price and stock,
 * including the explicit “Nėra likučio” state.
 */
export function ProductsPanel({
  request,
  scope,
  categories,
}: {
  request: AuthedRequest;
  scope: ProductScope;
  categories: AdminCategory[];
}) {
  const shopScope = scope === 'SHOP';
  const [items, setItems] = React.useState<(CatalogProduct | ShopProduct)[]>([]);
  const [status, setStatus] = React.useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [reloadToken, setReloadToken] = React.useState(0);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<CatalogProduct | ShopProduct | null>(null);
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [imageError, setImageError] = React.useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = React.useState<CatalogProduct | ShopProduct | null>(
    null,
  );
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  // Catalogue tags are shared and loaded once per panel; the e-shop scope never
  // touches them.
  const [tags, setTags] = React.useState<CatalogTag[]>([]);
  const [newTagName, setNewTagName] = React.useState('');
  const [tagBusy, setTagBusy] = React.useState(false);
  const [tagError, setTagError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    listProducts<CatalogProduct | ShopProduct>(request, scope, { page: 1, pageSize: PAGE_SIZE })
      .then((products) => {
        if (cancelled) {
          return;
        }
        setItems(products.items);
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

  const reload = () => {
    setError(null);
    setStatus('loading');
    setReloadToken((token) => token + 1);
  };

  React.useEffect(() => {
    if (shopScope) {
      // The e-shop scope has no tag UI; nothing to load (and no state reset in
      // the effect body, which would cause a cascading render).
      return;
    }
    let cancelled = false;
    listCatalogTags(request)
      .then((result) => {
        if (!cancelled) {
          setTags(result);
        }
      })
      .catch(() => {
        // A missing tag list must not block product editing; the inline
        // "Pridėti žymą" control still works.
      });
    return () => {
      cancelled = true;
    };
  }, [request, shopScope, reloadToken]);

  // New products may only be assigned to an active category. When editing a
  // product whose category was later deactivated, that assignment is kept and
  // labelled as inactive instead of being silently changed.
  const selectableCategories = React.useMemo(() => {
    const active = categories.filter((category) => category.isActive);
    if (editing) {
      const current = categories.find((category) => category.id === editing.categoryId);
      if (current && !current.isActive) {
        return [...active, current];
      }
    }
    return active;
  }, [categories, editing]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setImageError(null);
    setFormOpen(true);
  };

  const openEdit = (product: CatalogProduct | ShopProduct) => {
    setEditing(product);
    setForm({
      categoryId: product.categoryId,
      name: product.name,
      slug: product.slug,
      shortDescription: isShop(product) ? product.shortDescription : '',
      description: product.description,
      primaryImageUrl: product.primaryImageUrl,
      status: product.status,
      featured: product.featured,
      displayOrder: String(product.displayOrder),
      tagIds: isShop(product) ? [] : product.tags.map((tag) => tag.id),
      sku: isShop(product) ? (product.sku ?? '') : '',
      priceEuros: isShop(product) ? centsToEurosInput(product.priceCents) : '',
      salePriceEuros: isShop(product) ? centsToEurosInput(product.salePriceCents) : '',
      stockQuantity: isShop(product) ? String(product.stockQuantity) : '0',
      saleStartsAt:
        isShop(product) && product.saleStartsAt ? product.saleStartsAt.slice(0, 10) : '',
      saleEndsAt: isShop(product) && product.saleEndsAt ? product.saleEndsAt.slice(0, 10) : '',
    });
    setFormError(null);
    setImageError(null);
    setFormOpen(true);
  };

  const onFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Allow re-selecting the same file later.
    event.target.value = '';
    if (!file) {
      return;
    }
    setImageError(null);
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setImageError('Palaikomi tik JPEG, PNG ir WebP formatai.');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImageError('Nuotrauka per didelė (maks. 10 MB).');
      return;
    }
    setUploading(true);
    try {
      const uploaded = await uploadProductImage(request, file);
      setForm((f) => ({ ...f, primaryImageUrl: uploaded.url }));
    } catch (uploadError) {
      setImageError(describeProductError(uploadError));
    } finally {
      setUploading(false);
    }
  };

  const buildInput = (): CatalogProductInput | ShopProductInput => {
    const common = {
      categoryId: form.categoryId,
      name: form.name.trim(),
      slug: form.slug.trim(),
      description: form.description.trim(),
      primaryImageUrl: form.primaryImageUrl.trim(),
      status: form.status,
      featured: form.featured,
      displayOrder: Number(form.displayOrder) || 0,
    };
    if (!shopScope) {
      return { ...common, tagIds: form.tagIds };
    }
    return {
      ...common,
      shortDescription: form.shortDescription.trim(),
      sku: form.sku.trim() || null,
      priceCents: Math.round(Number(form.priceEuros || '0') * 100),
      salePriceCents: form.salePriceEuros ? Math.round(Number(form.salePriceEuros) * 100) : null,
      stockQuantity: Number(form.stockQuantity) || 0,
      saleStartsAt: form.saleStartsAt ? `${form.saleStartsAt}T00:00:00.000Z` : null,
      saleEndsAt: form.saleEndsAt ? `${form.saleEndsAt}T00:00:00.000Z` : null,
    };
  };

  const selectedTags = React.useMemo(
    () =>
      form.tagIds
        .map((id) => tags.find((tag) => tag.id === id))
        .filter((tag): tag is CatalogTag => Boolean(tag)),
    [form.tagIds, tags],
  );

  const availableTags = React.useMemo(
    () => tags.filter((tag) => !form.tagIds.includes(tag.id)),
    [tags, form.tagIds],
  );

  const toggleTag = (id: string) => {
    setForm((current) => ({
      ...current,
      tagIds: current.tagIds.includes(id)
        ? current.tagIds.filter((tagId) => tagId !== id)
        : [...current.tagIds, id],
    }));
  };

  const onAddTag = async () => {
    const name = newTagName.trim();
    if (!name) {
      return;
    }
    setTagBusy(true);
    setTagError(null);
    try {
      const tag = await createCatalogTag(request, name);
      setTags((current) =>
        current.some((existing) => existing.id === tag.id)
          ? current
          : [...current, tag].sort((a, b) => a.name.localeCompare(b.name, 'lt')),
      );
      setForm((current) =>
        current.tagIds.includes(tag.id)
          ? current
          : { ...current, tagIds: [...current.tagIds, tag.id] },
      );
      setNewTagName('');
    } catch (createError) {
      setTagError(describeProductError(createError));
    } finally {
      setTagBusy(false);
    }
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    // A new product cannot be saved before its primary image has been uploaded.
    if (!editing && !form.primaryImageUrl.startsWith('/media/')) {
      setFormError('Įkelkite pagrindinę nuotrauką.');
      return;
    }
    const input = buildInput();
    if (!input.categoryId || !input.name || !input.slug || !input.primaryImageUrl) {
      setFormError('Užpildykite privalomus laukus.');
      return;
    }
    if (shopScope && form.priceEuros === '') {
      setFormError('Įveskite bazinę kainą.');
      return;
    }
    if (!shopScope && form.description.length > CATALOG_DESCRIPTION_MAX_LENGTH) {
      setFormError(
        `Aprašymas per ilgas: leidžiama iki ${CATALOG_DESCRIPTION_MAX_LENGTH} simbolių.`,
      );
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateProduct(request, scope, editing.id, input);
        setNotice(`Prekė atnaujinta: ${input.name}.`);
      } else {
        await createCatalogProduct(request, scope, input);
        setNotice(`Prekė sukurta: ${input.name}.`);
      }
      setFormOpen(false);
      reload();
    } catch (submitError) {
      setFormError(describeProductError(submitError));
    } finally {
      setSaving(false);
    }
  };

  const onConfirmDelete = async () => {
    if (!confirmTarget) {
      return;
    }
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteProduct(request, scope, confirmTarget.id);
      setNotice(`Prekė pašalinta: ${confirmTarget.name}.`);
      setConfirmTarget(null);
      reload();
    } catch (deleteFailure) {
      setDeleteError(describeProductError(deleteFailure));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section className="rounded-lg border border-border bg-surface p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-primary">Prekės</h3>
        <Button size="sm" variant="outline" onClick={openCreate}>
          Nauja prekė
        </Button>
      </div>

      {error ? (
        <Alert variant="error" className="mt-4">
          {error}
        </Alert>
      ) : null}
      {notice ? (
        <Alert variant="success" className="mt-4">
          {notice}
        </Alert>
      ) : null}

      {formOpen ? (
        <form onSubmit={onSubmit} className="mt-4 space-y-3 rounded-md border border-border p-4">
          <p className="text-sm font-medium text-text">
            {editing ? 'Redaguoti prekę' : 'Nauja prekė'}
          </p>
          {formError ? <Alert variant="error">{formError}</Alert> : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="product-category">Kategorija</Label>
              <select
                id="product-category"
                required
                value={form.categoryId}
                onChange={(event) => setForm((f) => ({ ...f, categoryId: event.target.value }))}
                className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-text"
              >
                <option value="">— Pasirinkite —</option>
                {selectableCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.isActive ? category.name : `${category.name} (neaktyvi)`}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="product-name">Pavadinimas</Label>
              <Input
                id="product-name"
                required
                value={form.name}
                onChange={(event) => setForm((f) => ({ ...f, name: event.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="product-slug">Nuorodos fragmentas (slug)</Label>
              <Input
                id="product-slug"
                required
                value={form.slug}
                onChange={(event) => setForm((f) => ({ ...f, slug: event.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="product-image">Pagrindinė nuotrauka</Label>
              <div className="flex flex-wrap items-center gap-3">
                {form.primaryImageUrl ? (
                  // Arbitrary legacy external URLs / API-origin media cannot use
                  // next/image without per-domain remotePatterns; a plain preview
                  // img is the pragmatic choice here.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={resolveMediaUrl(form.primaryImageUrl)}
                    alt="Pagrindinės nuotraukos peržiūra"
                    className="h-16 w-16 rounded-md border border-border object-cover"
                  />
                ) : null}
                <input
                  id="product-image"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={uploading}
                  onChange={onFileSelected}
                  className="block text-sm text-text file:mr-3 file:rounded-md file:border file:border-border file:bg-surface file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary hover:file:bg-surface-muted"
                />
              </div>
              {uploading ? <p className="text-xs text-text-muted">Įkeliama…</p> : null}
              {imageError ? <p className="text-xs text-danger">{imageError}</p> : null}
            </div>
            {shopScope ? (
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="product-short">Trumpas aprašymas</Label>
                <Input
                  id="product-short"
                  required
                  value={form.shortDescription}
                  onChange={(event) =>
                    setForm((f) => ({ ...f, shortDescription: event.target.value }))
                  }
                />
              </div>
            ) : (
              <div className="space-y-3 sm:col-span-2">
                <Label htmlFor="product-tag-name">Žymos</Label>
                <div className="flex flex-wrap gap-1.5" data-testid="selected-tags">
                  {selectedTags.length === 0 ? (
                    <span className="text-xs text-text-muted">Žymų nepasirinkta.</span>
                  ) : (
                    selectedTags.map((tag) => (
                      <span
                        key={tag.id}
                        className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium text-text"
                      >
                        {tag.name}
                        <button
                          type="button"
                          aria-label={`Pašalinti žymą ${tag.name}`}
                          onClick={() => toggleTag(tag.id)}
                          className="text-text-muted hover:text-danger"
                        >
                          ×
                        </button>
                      </span>
                    ))
                  )}
                </div>
                {availableTags.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {availableTags.map((tag) => (
                      <button
                        key={tag.id}
                        type="button"
                        aria-pressed={false}
                        onClick={() => toggleTag(tag.id)}
                        className="rounded-full border border-border bg-surface px-2 py-0.5 text-xs font-medium text-text-muted hover:border-primary hover:text-primary"
                      >
                        + {tag.name}
                      </button>
                    ))}
                  </div>
                ) : null}
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    id="product-tag-name"
                    value={newTagName}
                    placeholder="Nauja žyma, pvz. Šokoladas"
                    onChange={(event) => setNewTagName(event.target.value)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void onAddTag()}
                    disabled={tagBusy || !newTagName.trim()}
                  >
                    {tagBusy ? 'Pridedama…' : 'Pridėti žymą'}
                  </Button>
                </div>
                {tagError ? <p className="text-xs text-danger">{tagError}</p> : null}
              </div>
            )}
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="product-description">Pilnas aprašymas</Label>
              <textarea
                id="product-description"
                required
                rows={4}
                value={form.description}
                onChange={(event) => setForm((f) => ({ ...f, description: event.target.value }))}
                className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text"
              />
              {!shopScope ? (
                <p
                  data-testid="catalog-description-counter"
                  aria-live="polite"
                  className={`text-xs ${
                    form.description.length > CATALOG_DESCRIPTION_MAX_LENGTH
                      ? 'font-medium text-danger'
                      : 'text-text-muted'
                  }`}
                >
                  {form.description.length} / {CATALOG_DESCRIPTION_MAX_LENGTH}
                </p>
              ) : null}
            </div>

            {shopScope ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="product-sku">SKU</Label>
                  <Input
                    id="product-sku"
                    value={form.sku}
                    onChange={(event) => setForm((f) => ({ ...f, sku: event.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="product-price">Bazinė kaina (€)</Label>
                  <Input
                    id="product-price"
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.priceEuros}
                    onChange={(event) => setForm((f) => ({ ...f, priceEuros: event.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="product-sale-price">Akcijos kaina (€)</Label>
                  <Input
                    id="product-sale-price"
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.salePriceEuros}
                    onChange={(event) =>
                      setForm((f) => ({ ...f, salePriceEuros: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="product-stock">Likutis</Label>
                  <Input
                    id="product-stock"
                    type="number"
                    min={0}
                    value={form.stockQuantity}
                    onChange={(event) =>
                      setForm((f) => ({ ...f, stockQuantity: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="product-sale-start">Akcija nuo</Label>
                  <Input
                    id="product-sale-start"
                    type="date"
                    value={form.saleStartsAt}
                    onChange={(event) =>
                      setForm((f) => ({ ...f, saleStartsAt: event.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="product-sale-end">Akcija iki</Label>
                  <Input
                    id="product-sale-end"
                    type="date"
                    value={form.saleEndsAt}
                    onChange={(event) => setForm((f) => ({ ...f, saleEndsAt: event.target.value }))}
                  />
                </div>
              </>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="product-status">Būsena</Label>
              <select
                id="product-status"
                value={form.status}
                onChange={(event) =>
                  setForm((f) => ({ ...f, status: event.target.value as ProductStatus }))
                }
                className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-text"
              >
                {PRODUCT_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {STATUS_LABELS[value]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="product-order">Rikiavimo tvarka</Label>
              <Input
                id="product-order"
                type="number"
                min={0}
                value={form.displayOrder}
                onChange={(event) => setForm((f) => ({ ...f, displayOrder: event.target.value }))}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-text">
            <input
              type="checkbox"
              checked={form.featured}
              onChange={(event) => setForm((f) => ({ ...f, featured: event.target.checked }))}
            />
            Rekomenduojama
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              Atšaukti
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saugoma…' : 'Išsaugoti'}
            </Button>
          </div>
        </form>
      ) : null}

      {status === 'loading' ? <p className="mt-4 text-sm text-text-muted">Kraunama…</p> : null}
      {status === 'error' && items.length === 0 ? (
        <Button variant="outline" className="mt-4" onClick={reload}>
          Bandyti dar kartą
        </Button>
      ) : null}
      {status !== 'loading' && items.length === 0 && !error ? (
        <p className="mt-4 text-sm text-text-muted">Prekių nerasta.</p>
      ) : null}

      {items.length > 0 ? (
        <div
          className="mt-4 overflow-x-auto"
          data-testid={shopScope ? 'shop-products-table' : 'catalog-products-table'}
        >
          <table className="w-full min-w-[56rem] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-text-muted">
                <th className="min-w-[14rem] px-3 py-2 font-medium">Pavadinimas</th>
                <th className="px-3 py-2 font-medium">Kategorija</th>
                {shopScope ? (
                  <>
                    <th className="px-3 py-2 font-medium whitespace-nowrap">Kaina</th>
                    <th className="px-3 py-2 font-medium whitespace-nowrap">Likutis</th>
                  </>
                ) : null}
                <th className="px-3 py-2 font-medium">Būsena</th>
                <th className="px-3 py-2 font-medium">Rekomenduojama</th>
                <th className="px-3 py-2 font-medium whitespace-nowrap">Veiksmai</th>
              </tr>
            </thead>
            <tbody>
              {items.map((product) => (
                <tr key={product.id} className="border-b border-border/60">
                  <td className="px-3 py-2 font-medium whitespace-nowrap text-text">
                    {product.name}
                    {!isShop(product) &&
                    product.description.length > CATALOG_DESCRIPTION_MAX_LENGTH ? (
                      <span className="ml-2 rounded-full bg-warning-surface px-2 py-0.5 text-xs font-medium text-warning">
                        Per ilgas aprašymas
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-text-muted">
                    {product.category.name}
                  </td>
                  {isShop(product) ? (
                    <>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {product.salePriceCents !== null ? (
                          <span className="flex items-baseline gap-2">
                            <span className="font-medium text-primary">
                              {formatPriceCents(product.salePriceCents)}
                            </span>
                            <span className="text-xs text-text-muted line-through">
                              {formatPriceCents(product.priceCents)}
                            </span>
                          </span>
                        ) : (
                          <span className="text-text">{formatPriceCents(product.priceCents)}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {product.stockQuantity > 0 ? (
                          <span className="text-text">{product.stockQuantity}</span>
                        ) : (
                          <span className="font-medium text-rose-600">Nėra likučio</span>
                        )}
                      </td>
                    </>
                  ) : null}
                  <td className="px-3 py-2 whitespace-nowrap">
                    <StatusBadge status={product.status} />
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-text-muted">
                    {product.featured ? 'Taip' : '—'}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        aria-label={`Redaguoti prekę ${product.name}`}
                        onClick={() => openEdit(product)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-primary hover:bg-surface-muted focus-visible:outline-focus"
                      >
                        <Pencil aria-hidden="true" className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Pašalinti prekę ${product.name}`}
                        onClick={() => {
                          setDeleteError(null);
                          setConfirmTarget(product);
                        }}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-rose-600 hover:bg-rose-50 focus-visible:outline-focus"
                      >
                        <Trash2 aria-hidden="true" className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmTarget !== null}
        title="Pašalinti prekę?"
        description={
          confirmTarget
            ? `Bus pašalinta prekė ${confirmTarget.name}. Šio veiksmo atšaukti negalima.`
            : ''
        }
        confirmLabel="Pašalinti"
        variant="destructive"
        isBusy={deleting}
        error={deleteError}
        onConfirm={() => void onConfirmDelete()}
        onCancel={() => {
          setConfirmTarget(null);
          setDeleteError(null);
        }}
      />
    </section>
  );
}
