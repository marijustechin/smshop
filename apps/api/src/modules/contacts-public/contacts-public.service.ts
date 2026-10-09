import { Injectable } from '@nestjs/common';
import { StoreStatus } from '@smshop/db';
import { PrismaService } from '../prisma/prisma.service.js';

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

export interface PublicStore {
  name: string;
  address: string;
  phone: string | null;
  email: string | null;
  status: 'OPERATING' | 'TEMPORARILY_CLOSED';
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

/**
 * Public, unauthenticated contact/store reads. Only fields needed for display
 * are returned. HIDDEN stores are excluded; cities left with no visible store are
 * omitted. Ordering follows the configured display order.
 */
@Injectable()
export class ContactsPublicService {
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<PublicContacts> {
    const [groups, cities] = await Promise.all([
      this.prisma.contactGroup.findMany({ orderBy: [{ displayOrder: 'asc' }, { key: 'asc' }] }),
      this.prisma.city.findMany({
        orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
        include: {
          stores: {
            where: { status: { not: StoreStatus.HIDDEN } },
            orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
            include: { hours: { orderBy: { weekday: 'asc' } } },
          },
        },
      }),
    ]);

    return {
      groups: groups.map((group) => ({
        key: group.key,
        title: group.title,
        phone: group.phone,
        email: group.email,
        hours: group.hours,
        address: group.address,
      })),
      cities: cities
        .map((city) => ({
          name: city.name,
          stores: city.stores.map((store) => ({
            name: store.name,
            address: store.address,
            phone: store.phone,
            email: store.email,
            status: store.status as 'OPERATING' | 'TEMPORARILY_CLOSED',
            notice: store.notice,
            hours: store.hours.map((hour) => ({
              weekday: hour.weekday,
              closed: hour.closed,
              opens: hour.opens,
              closes: hour.closes,
            })),
          })),
        }))
        .filter((city) => city.stores.length > 0),
    };
  }
}
