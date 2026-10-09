/** Public contacts projection returned by `GET /api/public/contacts`. */

export interface PublicContactGroup {
  key: string;
  title: string;
  phone: string;
  email: string;
  hours: string;
  address: string | null;
}

export interface PublicStoreHour {
  weekday: number;
  closed: boolean;
  opens: string | null;
  closes: string | null;
}

export type PublicStoreStatus = 'OPERATING' | 'TEMPORARILY_CLOSED';

export interface PublicStore {
  name: string;
  address: string;
  phone: string | null;
  email: string | null;
  status: PublicStoreStatus;
  notice: string | null;
  hours: PublicStoreHour[];
}

export interface PublicCity {
  name: string;
  stores: PublicStore[];
}

export interface PublicContacts {
  groups: PublicContactGroup[];
  cities: PublicCity[];
}
