'use client';

import * as React from 'react';
import { ApiError } from '@/shared/api/client';
import { Alert } from '@/shared/ui/alert';
import { Button } from '@/shared/ui/button';
import { Card } from '@/shared/ui/card';
import { ConfirmDialog } from '@/shared/ui/confirm-dialog';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import * as api from '../api/admin-contacts-api';
import type {
  AdminCity,
  AdminContactGroup,
  AdminStore,
  AdminStoreHour,
  AdminStoreStatus,
  StoreInput,
} from '../api/admin-contacts-api';

const WEEKDAYS = [
  { value: 1, label: 'Pirmadienis' },
  { value: 2, label: 'Antradienis' },
  { value: 3, label: 'Trečiadienis' },
  { value: 4, label: 'Ketvirtadienis' },
  { value: 5, label: 'Penktadienis' },
  { value: 6, label: 'Šeštadienis' },
  { value: 7, label: 'Sekmadienis' },
] as const;

const STATUS_LABELS: Record<AdminStoreStatus, string> = {
  OPERATING: 'Veikia',
  TEMPORARILY_CLOSED: 'Laikinai uždaryta',
  HIDDEN: 'Paslėpta',
};

function describe(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 409 && error.code === 'CITY_DUPLICATE') {
      return 'Miestas tokiu pavadinimu jau egzistuoja.';
    }
    if (error.status === 409 && error.code === 'CITY_HAS_STORES') {
      return 'Negalima ištrinti miesto, kuriame yra parduotuvių.';
    }
    if (error.status === 403) {
      return 'Neturite teisės atlikti šio veiksmo.';
    }
    if (error.status === 404) {
      return 'Įrašas nerastas.';
    }
    if (error.status === 400) {
      return 'Patikrinkite pateiktus duomenis.';
    }
    if (error.status === 401) {
      return 'Sesija nebegalioja. Prisijunkite iš naujo.';
    }
  }
  return 'Įvyko netikėta klaida. Bandykite dar kartą.';
}

function emptyHours(): AdminStoreHour[] {
  return WEEKDAYS.map((day) => ({
    weekday: day.value,
    closed: false,
    opens: '10:00',
    closes: '20:00',
  }));
}

function HoursEditor({
  value,
  onChange,
}: {
  value: AdminStoreHour[];
  onChange: (next: AdminStoreHour[]) => void;
}) {
  const setDay = (weekday: number, patch: Partial<AdminStoreHour>) =>
    onChange(value.map((hour) => (hour.weekday === weekday ? { ...hour, ...patch } : hour)));

  const copyToAll = (source: AdminStoreHour) =>
    onChange(
      value.map((hour) => ({
        ...hour,
        closed: source.closed,
        opens: source.opens,
        closes: source.closes,
      })),
    );

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-primary">Darbo laikas</legend>
      <p className="text-xs text-text-muted">
        Vienas intervalas per dieną (apribojimas šioje versijoje).
      </p>
      {WEEKDAYS.map((day) => {
        const hour = value.find((item) => item.weekday === day.value);
        if (!hour) {
          return null;
        }
        return (
          <div key={day.value} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="w-32 shrink-0">{day.label}</span>
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={hour.closed}
                onChange={(event) =>
                  setDay(day.value, {
                    closed: event.target.checked,
                    opens: event.target.checked ? null : (hour.opens ?? '10:00'),
                    closes: event.target.checked ? null : (hour.closes ?? '20:00'),
                  })
                }
              />
              Uždaryta
            </label>
            <input
              type="time"
              aria-label={`${day.label} atidaroma`}
              className="rounded-md border border-border bg-surface px-2 py-1 disabled:opacity-50"
              value={hour.opens ?? ''}
              disabled={hour.closed}
              onChange={(event) => setDay(day.value, { opens: event.target.value })}
            />
            <span aria-hidden="true">–</span>
            <input
              type="time"
              aria-label={`${day.label} uždaroma`}
              className="rounded-md border border-border bg-surface px-2 py-1 disabled:opacity-50"
              value={hour.closes ?? ''}
              disabled={hour.closed}
              onChange={(event) => setDay(day.value, { closes: event.target.value })}
            />
            {day.value === 1 ? (
              <Button type="button" variant="outline" size="sm" onClick={() => copyToAll(hour)}>
                Kopijuoti į visas dienas
              </Button>
            ) : null}
          </div>
        );
      })}
    </fieldset>
  );
}

function CitiesSection({
  request,
  cities,
  refresh,
}: {
  request: api.AdminRequest;
  cities: AdminCity[];
  refresh: () => Promise<void>;
}) {
  const [name, setName] = React.useState('');
  const [order, setOrder] = React.useState('0');
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [pendingDelete, setPendingDelete] = React.useState<AdminCity | null>(null);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.createCity(request, { name: name.trim(), displayOrder: Number(order) || 0 });
      setName('');
      setOrder('0');
      await refresh();
    } catch (cause) {
      setError(describe(cause));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!pendingDelete) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.deleteCity(request, pendingDelete.id);
      setPendingDelete(null);
      await refresh();
    } catch (cause) {
      setError(describe(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {error ? <Alert variant="error">{error}</Alert> : null}
      <form onSubmit={create} className="flex flex-wrap items-end gap-3">
        <div className="min-w-48 flex-1">
          <Label htmlFor="city-name">Miesto pavadinimas</Label>
          <Input
            id="city-name"
            value={name}
            required
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className="w-28">
          <Label htmlFor="city-order">Eilė</Label>
          <Input
            id="city-order"
            type="number"
            min={0}
            value={order}
            onChange={(event) => setOrder(event.target.value)}
          />
        </div>
        <Button type="submit" disabled={busy}>
          Pridėti miestą
        </Button>
      </form>

      <ul className="divide-y divide-border">
        {cities.map((city) => (
          <li key={city.id} className="flex items-center justify-between gap-3 py-2 text-sm">
            <span>
              {city.name} <span className="text-text-muted">(eilė {city.displayOrder})</span>
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPendingDelete(city)}
            >
              Ištrinti
            </Button>
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Ištrinti miestą?"
        description={`Miestas „${pendingDelete?.name ?? ''}“ bus ištrintas.`}
        confirmLabel="Ištrinti"
        variant="destructive"
        isBusy={busy}
        error={error}
        onConfirm={() => void remove()}
        onCancel={() => {
          setPendingDelete(null);
          setError(null);
        }}
      />
    </div>
  );
}

function StoreForm({
  request,
  cities,
  editing,
  refresh,
  onDone,
}: {
  request: api.AdminRequest;
  cities: AdminCity[];
  editing: AdminStore | null;
  refresh: () => Promise<void>;
  onDone: () => void;
}) {
  const [name, setName] = React.useState(editing?.name ?? '');
  const [cityId, setCityId] = React.useState(editing?.cityId ?? cities[0]?.id ?? '');
  const [address, setAddress] = React.useState(editing?.address ?? '');
  const [phone, setPhone] = React.useState(editing?.phone ?? '');
  const [email, setEmail] = React.useState(editing?.email ?? '');
  const [status, setStatus] = React.useState<AdminStoreStatus>(editing?.status ?? 'OPERATING');
  const [notice, setNotice] = React.useState(editing?.notice ?? '');
  const [order, setOrder] = React.useState(String(editing?.displayOrder ?? 0));
  const [hours, setHours] = React.useState<AdminStoreHour[]>(
    editing?.hours && editing.hours.length === 7
      ? [...editing.hours].sort((a, b) => a.weekday - b.weekday)
      : emptyHours(),
  );
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    const body: StoreInput = {
      name: name.trim(),
      cityId,
      address: address.trim(),
      phone: phone.trim() === '' ? null : phone.trim(),
      email: email.trim() === '' ? null : email.trim(),
      status,
      notice: notice.trim() === '' ? null : notice.trim(),
      displayOrder: Number(order) || 0,
      hours,
    };
    try {
      if (editing) {
        await api.updateStore(request, editing.id, body);
      } else {
        await api.createStore(request, body);
      }
      await refresh();
      onDone();
    } catch (cause) {
      setError(describe(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      {error ? <Alert variant="error">{error}</Alert> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="store-name">Pavadinimas</Label>
          <Input
            id="store-name"
            value={name}
            required
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="store-city">Miestas</Label>
          <select
            id="store-city"
            required
            value={cityId}
            onChange={(event) => setCityId(event.target.value)}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
          >
            {cities.map((city) => (
              <option key={city.id} value={city.id}>
                {city.name}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="store-address">Adresas</Label>
          <Input
            id="store-address"
            value={address}
            required
            onChange={(event) => setAddress(event.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="store-phone">Telefonas (nebūtinas)</Label>
          <Input
            id="store-phone"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="store-email">El. paštas (nebūtinas)</Label>
          <Input
            id="store-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="store-status">Būsena</Label>
          <select
            id="store-status"
            value={status}
            onChange={(event) => setStatus(event.target.value as AdminStoreStatus)}
            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
          >
            {(Object.keys(STATUS_LABELS) as AdminStoreStatus[]).map((value) => (
              <option key={value} value={value}>
                {STATUS_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="store-order">Eilė</Label>
          <Input
            id="store-order"
            type="number"
            min={0}
            value={order}
            onChange={(event) => setOrder(event.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="store-notice">Trumpa pastaba (nebūtina)</Label>
          <Input
            id="store-notice"
            value={notice}
            onChange={(event) => setNotice(event.target.value)}
          />
        </div>
      </div>

      <HoursEditor value={hours} onChange={setHours} />

      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>
          {editing ? 'Išsaugoti pakeitimus' : 'Pridėti parduotuvę'}
        </Button>
        {editing ? (
          <Button type="button" variant="outline" onClick={onDone}>
            Atšaukti
          </Button>
        ) : null}
      </div>
    </form>
  );
}

function StoresSection({
  request,
  cities,
  stores,
  refresh,
}: {
  request: api.AdminRequest;
  cities: AdminCity[];
  stores: AdminStore[];
  refresh: () => Promise<void>;
}) {
  const [editing, setEditing] = React.useState<AdminStore | null>(null);
  const [adding, setAdding] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [pendingDelete, setPendingDelete] = React.useState<AdminStore | null>(null);

  const remove = async () => {
    if (!pendingDelete) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.deleteStore(request, pendingDelete.id);
      setPendingDelete(null);
      await refresh();
    } catch (cause) {
      setError(describe(cause));
    } finally {
      setBusy(false);
    }
  };

  const showForm = adding || editing !== null;
  const formKey = editing?.id ?? 'new';

  return (
    <div className="space-y-4">
      {error ? <Alert variant="error">{error}</Alert> : null}

      {!showForm ? (
        <Button
          type="button"
          onClick={() => {
            setEditing(null);
            setAdding(true);
          }}
        >
          Pridėti parduotuvę
        </Button>
      ) : (
        <Card>
          <StoreForm
            key={formKey}
            request={request}
            cities={cities}
            editing={editing}
            refresh={refresh}
            onDone={() => {
              setEditing(null);
              setAdding(false);
            }}
          />
        </Card>
      )}

      <ul className="divide-y divide-border">
        {stores.map((store) => (
          <li key={store.id} className="flex items-center justify-between gap-3 py-3 text-sm">
            <span className="min-w-0">
              <span className="font-medium text-primary">{store.name}</span>
              <span className="block text-text-muted">
                {store.city.name} · {STATUS_LABELS[store.status]}
              </span>
            </span>
            <span className="flex shrink-0 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setAdding(false);
                  setEditing(store);
                }}
              >
                Redaguoti
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPendingDelete(store)}
              >
                Ištrinti
              </Button>
            </span>
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Ištrinti parduotuvę?"
        description={`Parduotuvė „${pendingDelete?.name ?? ''}“ bus ištrinta.`}
        confirmLabel="Ištrinti"
        variant="destructive"
        isBusy={busy}
        error={error}
        onConfirm={() => void remove()}
        onCancel={() => {
          setPendingDelete(null);
          setError(null);
        }}
      />
    </div>
  );
}

function GroupCard({
  request,
  group,
  refresh,
}: {
  request: api.AdminRequest;
  group: AdminContactGroup;
  refresh: () => Promise<void>;
}) {
  const [phone, setPhone] = React.useState(group.phone);
  const [email, setEmail] = React.useState(group.email);
  const [hours, setHours] = React.useState(group.hours);
  const [address, setAddress] = React.useState(group.address ?? '');
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSaved(false);
    setBusy(true);
    try {
      await api.updateContactGroup(request, group.key, {
        phone: phone.trim(),
        email: email.trim(),
        hours: hours.trim(),
        address: address.trim() === '' ? null : address.trim(),
      });
      await refresh();
      setSaved(true);
    } catch (cause) {
      setError(describe(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <form onSubmit={submit} className="space-y-3">
        <h3 className="font-semibold text-primary">{group.title}</h3>
        {error ? <Alert variant="error">{error}</Alert> : null}
        {saved ? <Alert variant="success">Išsaugota.</Alert> : null}
        <div>
          <Label htmlFor={`g-phone-${group.key}`}>Telefonas</Label>
          <Input
            id={`g-phone-${group.key}`}
            value={phone}
            required
            onChange={(event) => setPhone(event.target.value)}
          />
        </div>
        <div>
          <Label htmlFor={`g-email-${group.key}`}>El. paštas</Label>
          <Input
            id={`g-email-${group.key}`}
            type="email"
            value={email}
            required
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div>
          <Label htmlFor={`g-hours-${group.key}`}>Darbo laikas</Label>
          <Input
            id={`g-hours-${group.key}`}
            value={hours}
            required
            onChange={(event) => setHours(event.target.value)}
          />
        </div>
        <div>
          <Label htmlFor={`g-address-${group.key}`}>Adresas (nebūtinas)</Label>
          <Input
            id={`g-address-${group.key}`}
            value={address}
            onChange={(event) => setAddress(event.target.value)}
          />
        </div>
        <Button type="submit" disabled={busy}>
          Išsaugoti
        </Button>
      </form>
    </Card>
  );
}

/**
 * Administrator management of cities, physical stores (with a weekly hours
 * editor) and the fixed business contact groups. Store hours are free text for
 * the groups (the source does not specify weekdays).
 */
export function ContactsAdmin({ request }: { request: api.AdminRequest }) {
  const [tab, setTab] = React.useState<'cities' | 'stores' | 'groups'>('cities');
  const [cities, setCities] = React.useState<AdminCity[]>([]);
  const [stores, setStores] = React.useState<AdminStore[]>([]);
  const [groups, setGroups] = React.useState<AdminContactGroup[]>([]);
  const [status, setStatus] = React.useState<'loading' | 'ready' | 'error'>('loading');

  React.useEffect(() => {
    let active = true;
    Promise.all([api.listCities(request), api.listStores(request), api.listContactGroups(request)])
      .then(([nextCities, nextStores, nextGroups]) => {
        if (!active) {
          return;
        }
        setCities(nextCities);
        setStores(nextStores);
        setGroups(nextGroups);
        setStatus('ready');
      })
      .catch(() => {
        if (active) {
          setStatus('error');
        }
      });
    return () => {
      active = false;
    };
  }, [request]);

  // Post-mutation refresh: refetches without toggling the page-level loading
  // state, so in-form success/error feedback is not lost.
  const refresh = React.useCallback(async () => {
    const [nextCities, nextStores, nextGroups] = await Promise.all([
      api.listCities(request),
      api.listStores(request),
      api.listContactGroups(request),
    ]);
    setCities(nextCities);
    setStores(nextStores);
    setGroups(nextGroups);
  }, [request]);

  if (status === 'loading') {
    return <p className="text-sm text-text-muted">Kraunama…</p>;
  }
  if (status === 'error') {
    return <Alert variant="error">Nepavyko įkelti kontaktų duomenų. Bandykite dar kartą.</Alert>;
  }

  return (
    <div className="space-y-6">
      <div role="tablist" aria-label="Kontaktų sekcijos" className="flex flex-wrap gap-2">
        {(
          [
            ['cities', 'Miestai'],
            ['stores', 'Parduotuvės'],
            ['groups', 'Kontaktai'],
          ] as const
        ).map(([value, label]) => (
          <Button
            key={value}
            type="button"
            variant={tab === value ? 'primary' : 'outline'}
            size="sm"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
          >
            {label}
          </Button>
        ))}
      </div>

      {tab === 'cities' ? (
        <Card>
          <CitiesSection request={request} cities={cities} refresh={refresh} />
        </Card>
      ) : null}

      {tab === 'stores' ? (
        <StoresSection request={request} cities={cities} stores={stores} refresh={refresh} />
      ) : null}

      {tab === 'groups' ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {groups.map((group) => (
            <GroupCard key={group.key} request={request} group={group} refresh={refresh} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
