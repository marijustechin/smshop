import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { City } from '@smshop/db';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { CreateCityDto, UpdateCityDto } from './dto/contact.dto.js';

/** Trim + locale-aware lower-casing used for duplicate detection. */
export function normalizeCityName(name: string): string {
  return name.trim().toLocaleLowerCase('lt-LT');
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'P2002'
  );
}

@Injectable()
export class CitiesService {
  constructor(private readonly prisma: PrismaService) {}

  list(): Promise<City[]> {
    return this.prisma.city.findMany({ orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }] });
  }

  async create(dto: CreateCityDto): Promise<City> {
    try {
      return await this.prisma.city.create({
        data: {
          name: dto.name,
          nameNormalized: normalizeCityName(dto.name),
          displayOrder: dto.displayOrder,
        },
      });
    } catch (error) {
      this.rethrowDuplicate(error);
      throw error;
    }
  }

  async update(id: string, dto: UpdateCityDto): Promise<City> {
    const existing = await this.prisma.city.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({ code: 'CITY_NOT_FOUND', message: 'Miestas nerastas' });
    }
    try {
      return await this.prisma.city.update({
        where: { id },
        data: {
          ...(dto.name !== undefined
            ? { name: dto.name, nameNormalized: normalizeCityName(dto.name) }
            : {}),
          ...(dto.displayOrder !== undefined ? { displayOrder: dto.displayOrder } : {}),
        },
      });
    } catch (error) {
      this.rethrowDuplicate(error);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    const existing = await this.prisma.city.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({ code: 'CITY_NOT_FOUND', message: 'Miestas nerastas' });
    }
    const stores = await this.prisma.store.count({ where: { cityId: id } });
    if (stores > 0) {
      throw new ConflictException({
        code: 'CITY_HAS_STORES',
        message: 'Negalima ištrinti miesto, kuriame yra parduotuvių',
      });
    }
    await this.prisma.city.delete({ where: { id } });
  }

  private rethrowDuplicate(error: unknown): void {
    if (isUniqueViolation(error)) {
      throw new ConflictException({
        code: 'CITY_DUPLICATE',
        message: 'Miestas tokiu pavadinimu jau egzistuoja',
      });
    }
  }
}
