/**
 * Typed admin wrappers for cities, physical stores and fixed contact groups.
 * The authenticated request function is injected (see `useAuth().authedRequest`),
 * matching the other admin features.
 */

export type AdminRequest = <T>(
  path: string,
  options?: { method?: string; body?: unknown },
) => Promise<T>;

export interface AdminCity {
  id: string;
  name: string;
  displayOrder: number;
}

export interface AdminStoreHour {
  weekday: number;
  closed: boolean;
  opens: string | null;
  closes: string | null;
}

export type AdminStoreStatus = 'OPERATING' | 'TEMPORARILY_CLOSED' | 'HIDDEN';

export interface AdminStore {
  id: string;
  name: string;
  cityId: string;
  address: string;
  phone: string | null;
  email: string | null;
  status: AdminStoreStatus;
  notice: string | null;
  displayOrder: number;
  city: { id: string; name: string; displayOrder: number };
  hours: AdminStoreHour[];
}

export interface AdminContactGroup {
  id: string;
  key: string;
  title: string;
  phone: string;
  email: string;
  hours: string;
  address: string | null;
  displayOrder: number;
}

export interface StoreInput {
  name: string;
  cityId: string;
  address: string;
  phone?: string | null;
  email?: string | null;
  status: AdminStoreStatus;
  notice?: string | null;
  displayOrder: number;
  hours: AdminStoreHour[];
}

export interface ContactGroupInput {
  phone?: string;
  email?: string;
  hours?: string;
  address?: string | null;
}

export function listCities(request: AdminRequest): Promise<AdminCity[]> {
  return request<AdminCity[]>('/api/admin/contacts/cities');
}

export function createCity(
  request: AdminRequest,
  body: { name: string; displayOrder: number },
): Promise<AdminCity> {
  return request<AdminCity>('/api/admin/contacts/cities', { method: 'POST', body });
}

export function updateCity(
  request: AdminRequest,
  id: string,
  body: { name?: string; displayOrder?: number },
): Promise<AdminCity> {
  return request<AdminCity>(`/api/admin/contacts/cities/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body,
  });
}

export function deleteCity(request: AdminRequest, id: string): Promise<void> {
  return request<void>(`/api/admin/contacts/cities/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export function listStores(request: AdminRequest): Promise<AdminStore[]> {
  return request<AdminStore[]>('/api/admin/contacts/stores');
}

export function createStore(request: AdminRequest, body: StoreInput): Promise<AdminStore> {
  return request<AdminStore>('/api/admin/contacts/stores', { method: 'POST', body });
}

export function updateStore(
  request: AdminRequest,
  id: string,
  body: StoreInput,
): Promise<AdminStore> {
  return request<AdminStore>(`/api/admin/contacts/stores/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body,
  });
}

export function deleteStore(request: AdminRequest, id: string): Promise<void> {
  return request<void>(`/api/admin/contacts/stores/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export function listContactGroups(request: AdminRequest): Promise<AdminContactGroup[]> {
  return request<AdminContactGroup[]>('/api/admin/contacts/groups');
}

export function updateContactGroup(
  request: AdminRequest,
  key: string,
  body: ContactGroupInput,
): Promise<AdminContactGroup> {
  return request<AdminContactGroup>(`/api/admin/contacts/groups/${encodeURIComponent(key)}`, {
    method: 'PATCH',
    body,
  });
}
