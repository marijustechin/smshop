import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { StoreStatus } from '@smshop/db';
import type { StoreHour } from './dto/contact.dto.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { CreateStoreDto, UpdateStoreDto } from './dto/contact.dto.js';

const STORE_INCLUDE = {
  city: { select: { id: true, name: true, displayOrder: true } },
  hours: { orderBy: { weekday: 'asc' as const } },
};

export interface AdminStoreHour {
  weekday: number;
  closed: boolean;
  opens: string | null;
  closes: string | null;
}

/** Portable admin projection (avoids leaking generated Prisma payload types). */
export interface AdminStore {
  id: string;
  name: string;
  cityId: string;
  address: string;
  phone: string | null;
  email: string | null;
  status: StoreStatus;
  notice: string | null;
  displayOrder: number;
  city: { id: string; name: string; displayOrder: number };
  hours: AdminStoreHour[];
}

/** Map validated hour rows to persistence rows (closed days carry no times). */
function toHourRows(hours: StoreHour[]) {
  return hours.map((hour) => ({
    weekday: hour.weekday,
    closed: hour.closed,
    opens: hour.closed ? null : (hour.opens ?? null),
    closes: hour.closed ? null : (hour.closes ?? null),
  }));
}

@Injectable()
export class StoresService {
  constructor(private readonly prisma: PrismaService) {}

  list(): Promise<AdminStore[]> {
    return this.prisma.store.findMany({
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      include: STORE_INCLUDE,
    });
  }

  async create(dto: CreateStoreDto): Promise<AdminStore> {
    await this.assertCity(dto.cityId);
    return this.prisma.store.create({
      data: {
        name: dto.name,
        cityId: dto.cityId,
        address: dto.address,
        phone: dto.phone ?? null,
        email: dto.email ?? null,
        status: dto.status,
        notice: dto.notice ?? null,
        displayOrder: dto.displayOrder,
        hours: { create: toHourRows(dto.hours) },
      },
      include: STORE_INCLUDE,
    });
  }

  async update(id: string, dto: UpdateStoreDto): Promise<AdminStore | null> {
    const existing = await this.prisma.store.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({ code: 'STORE_NOT_FOUND', message: 'Parduotuvė nerasta' });
    }
    if (dto.cityId) {
      await this.assertCity(dto.cityId);
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.store.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.cityId !== undefined ? { cityId: dto.cityId } : {}),
          ...(dto.address !== undefined ? { address: dto.address } : {}),
          ...(dto.phone !== undefined ? { phone: dto.phone ?? null } : {}),
          ...(dto.email !== undefined ? { email: dto.email ?? null } : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
          ...(dto.notice !== undefined ? { notice: dto.notice ?? null } : {}),
          ...(dto.displayOrder !== undefined ? { displayOrder: dto.displayOrder } : {}),
        },
      });
      if (dto.hours) {
        await tx.storeHours.deleteMany({ where: { storeId: id } });
        await tx.storeHours.createMany({
          data: toHourRows(dto.hours).map((row) => ({ ...row, storeId: id })),
        });
      }
      return tx.store.findUnique({ where: { id }, include: STORE_INCLUDE });
    });
  }

  async delete(id: string): Promise<void> {
    const existing = await this.prisma.store.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({ code: 'STORE_NOT_FOUND', message: 'Parduotuvė nerasta' });
    }
    await this.prisma.store.delete({ where: { id } });
  }

  private async assertCity(cityId: string): Promise<void> {
    const city = await this.prisma.city.findUnique({ where: { id: cityId } });
    if (!city) {
      throw new BadRequestException({
        code: 'CITY_NOT_FOUND',
        message: 'Pasirinktas miestas nerastas',
      });
    }
  }
}
