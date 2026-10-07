'use client';

import * as React from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { Alert } from '@/shared/ui/alert';
import { Button } from '@/shared/ui/button';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { createCategory, deleteCategory, updateCategory } from '../api/products-api';
import { describeProductError } from '../model/labels';
import type { AdminCategory, AuthedRequest, CategoryInput, ProductScope } from '../model/types';

interface FormState {
  name: string;
  slug: string;
  parentId: string;
  displayOrder: string;
  isActive: boolean;
}

const EMPTY_FORM: FormState = {
  name: '',
  slug: '',
  parentId: '',
  displayOrder: '0',
  isActive: true,
};

/**
 * Category management for one product scope. Categories come from the shared
 * per-scope source owned by the parent (`useScopedCategories`), and every
 * successful mutation invalidates it so the same-scope product form sees the
 * change immediately.
 */
export function CategoriesPanel({
  request,
  scope,
  categories,
  status,
  error,
  onChanged,
}: {
  request: AuthedRequest;
  scope: ProductScope;
  categories: AdminCategory[];
  status: 'loading' | 'ready' | 'error';
  error: string | null;
  onChanged: () => void;
}) {
  const [notice, setNotice] = React.useState<string | null>(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<AdminCategory | null>(null);
  const [form, setForm] = React.useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [confirmTarget, setConfirmTarget] = React.useState<AdminCategory | null>(null);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setFormOpen(true);
  };

  const openEdit = (category: AdminCategory) => {
    setEditing(category);
    setForm({
      name: category.name,
      slug: category.slug,
      parentId: category.parentId ?? '',
      displayOrder: String(category.displayOrder),
      isActive: category.isActive,
    });
    setFormError(null);
    setFormOpen(true);
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFormError(null);
    const displayOrder = Number.parseInt(form.displayOrder, 10);
    const body: CategoryInput = {
      name: form.name.trim(),
      slug: form.slug.trim(),
      displayOrder: Number.isNaN(displayOrder) ? 0 : displayOrder,
      isActive: form.isActive,
    };
    // A root category omits `parentId` on create; clearing a parent on update
    // sends the explicit `null` representation. Never an empty string.
    const parentId = form.parentId || null;
    if (editing) {
      body.parentId = parentId;
    } else if (parentId !== null) {
      body.parentId = parentId;
    }
    try {
      if (editing) {
        await updateCategory(request, scope, editing.id, body);
        setNotice(`Kategorija atnaujinta: ${body.name}.`);
      } else {
        await createCategory(request, scope, body);
        setNotice(`Kategorija sukurta: ${body.name}.`);
      }
      setFormOpen(false);
      onChanged();
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
      await deleteCategory(request, scope, confirmTarget.id);
      setNotice(`Kategorija pašalinta: ${confirmTarget.name}.`);
      setConfirmTarget(null);
      onChanged();
    } catch (deleteFailure) {
      setDeleteError(describeProductError(deleteFailure));
    } finally {
      setDeleting(false);
    }
  };

  const parentOptions = categories.filter((category) => category.id !== editing?.id);

  return (
    <section className="rounded-lg border border-border bg-surface p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-primary">Kategorijos</h3>
        <Button size="sm" variant="outline" onClick={openCreate}>
          Nauja kategorija
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
          {formError ? <Alert variant="error">{formError}</Alert> : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="category-name">Pavadinimas</Label>
              <Input
                id="category-name"
                value={form.name}
                required
                onChange={(event) => setForm((f) => ({ ...f, name: event.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="category-slug">Nuorodos fragmentas (slug)</Label>
              <Input
                id="category-slug"
                value={form.slug}
                required
                onChange={(event) => setForm((f) => ({ ...f, slug: event.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="category-parent">Tėvinė kategorija</Label>
              <select
                id="category-parent"
                value={form.parentId}
                onChange={(event) => setForm((f) => ({ ...f, parentId: event.target.value }))}
                className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-text"
              >
                <option value="">— Nėra —</option>
                {parentOptions.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="category-order">Rikiavimo tvarka</Label>
              <Input
                id="category-order"
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
              checked={form.isActive}
              onChange={(event) => setForm((f) => ({ ...f, isActive: event.target.checked }))}
            />
            Aktyvi (rodoma)
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
      {status === 'error' && categories.length === 0 ? (
        <Button variant="outline" className="mt-4" onClick={onChanged}>
          Bandyti dar kartą
        </Button>
      ) : null}

      {status !== 'loading' && categories.length === 0 && !error ? (
        <p className="mt-4 text-sm text-text-muted">Kategorijų nerasta.</p>
      ) : null}

      {categories.length > 0 ? (
        <div className="mt-4 overflow-x-auto" data-testid="categories-table">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-text-muted">
                <th className="px-3 py-2 font-medium">Pavadinimas</th>
                <th className="px-3 py-2 font-medium">Slug</th>
                <th className="px-3 py-2 font-medium">Tėvinė</th>
                <th className="px-3 py-2 font-medium">Tvarka</th>
                <th className="px-3 py-2 font-medium">Būsena</th>
                <th className="px-3 py-2 font-medium whitespace-nowrap">Veiksmai</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <tr key={category.id} className="border-b border-border/60">
                  <td className="px-3 py-2 font-medium text-text">{category.name}</td>
                  <td className="px-3 py-2 text-text-muted">{category.slug}</td>
                  <td className="px-3 py-2 text-text-muted">
                    {categories.find((item) => item.id === category.parentId)?.name ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-text-muted">{category.displayOrder}</td>
                  <td className="px-3 py-2">
                    <span className={category.isActive ? 'text-success' : 'text-text-muted'}>
                      {category.isActive ? 'Aktyvi' : 'Neaktyvi'}
                    </span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        aria-label={`Redaguoti kategoriją ${category.name}`}
                        onClick={() => openEdit(category)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-primary hover:bg-surface-muted focus-visible:outline-focus"
                      >
                        <Pencil aria-hidden="true" className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Pašalinti kategoriją ${category.name}`}
                        onClick={() => {
                          setDeleteError(null);
                          setConfirmTarget(category);
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
        title="Pašalinti kategoriją?"
        description={
          confirmTarget
            ? `Bus pašalinta kategorija ${confirmTarget.name}. Šio veiksmo atšaukti negalima.`
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
