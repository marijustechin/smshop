import { Injectable, NotFoundException } from '@nestjs/common';
import type { ContactGroup } from '@smshop/db';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { UpdateContactGroupDto } from './dto/contact.dto.js';

/**
 * Fixed business contact groups. Groups are created by the seed migration and
 * cannot be created or deleted here; only the public-facing fields are editable.
 * The group's email is the future contact-form topic recipient.
 */
@Injectable()
export class ContactGroupsService {
  constructor(private readonly prisma: PrismaService) {}

  list(): Promise<ContactGroup[]> {
    return this.prisma.contactGroup.findMany({
      orderBy: [{ displayOrder: 'asc' }, { key: 'asc' }],
    });
  }

  async update(key: string, dto: UpdateContactGroupDto): Promise<ContactGroup> {
    const existing = await this.prisma.contactGroup.findUnique({ where: { key } });
    if (!existing) {
      throw new NotFoundException({
        code: 'CONTACT_GROUP_NOT_FOUND',
        message: 'Kontaktų grupė nerasta',
      });
    }
    return this.prisma.contactGroup.update({
      where: { key },
      data: {
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.email !== undefined ? { email: dto.email } : {}),
        ...(dto.hours !== undefined ? { hours: dto.hours } : {}),
        ...(dto.address !== undefined ? { address: dto.address ?? null } : {}),
      },
    });
  }
}
