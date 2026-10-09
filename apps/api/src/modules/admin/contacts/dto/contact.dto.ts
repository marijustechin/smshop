import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/** `HH:MM` 24-hour time. */
export const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Laikas turi būti HH:MM formatu');

export const weekdaySchema = z.coerce.number().int().min(1).max(7);

/**
 * One weekday row. A closed day carries no times; an open day requires both and
 * opening must precede closing (string comparison is safe for zero-padded HH:MM).
 * One interval per day in this version (documented limitation).
 */
export const storeHourSchema = z
  .object({
    weekday: weekdaySchema,
    closed: z.boolean().default(false),
    opens: timeSchema.nullable().optional(),
    closes: timeSchema.nullable().optional(),
  })
  .strict()
  .superRefine((hour, ctx) => {
    if (hour.closed) {
      return;
    }
    if (!hour.opens || !hour.closes) {
      ctx.addIssue({ code: 'custom', message: 'Nurodykite atidarymo ir uždarymo laiką' });
      return;
    }
    if (hour.opens >= hour.closes) {
      ctx.addIssue({
        code: 'custom',
        message: 'Atidarymo laikas turi būti ankstesnis už uždarymo laiką',
      });
    }
  });

const weeklyHoursSchema = z
  .array(storeHourSchema)
  .length(7, 'Turi būti pateiktos visos 7 savaitės dienos')
  .superRefine((hours, ctx) => {
    const seen = new Set(hours.map((hour) => hour.weekday));
    if (seen.size !== 7) {
      ctx.addIssue({ code: 'custom', message: 'Savaitės dienos turi nesikartoti' });
    }
  });

export type StoreHour = z.infer<typeof storeHourSchema>;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === '' ? null : value))
    .nullable()
    .optional();

const emailSchema = z
  .string()
  .trim()
  .max(200)
  .refine((value) => value === '' || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value), {
    message: 'Neteisingas el. pašto formatas',
  })
  .transform((value) => (value === '' ? null : value))
  .nullable()
  .optional();

export const storeStatusSchema = z.enum(['OPERATING', 'TEMPORARILY_CLOSED', 'HIDDEN']);

export const createCitySchema = z
  .object({
    name: z.string().trim().min(1, 'Įveskite miesto pavadinimą').max(120),
    displayOrder: z.coerce.number().int().min(0).default(0),
  })
  .strict();
export class CreateCityDto extends createZodDto(createCitySchema) {}

export const updateCitySchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    displayOrder: z.coerce.number().int().min(0).optional(),
  })
  .strict();
export class UpdateCityDto extends createZodDto(updateCitySchema) {}

export const createStoreSchema = z
  .object({
    name: z.string().trim().min(1, 'Įveskite parduotuvės pavadinimą').max(160),
    cityId: z.uuid('Pasirinkite miestą'),
    address: z.string().trim().min(1, 'Įveskite adresą').max(300),
    phone: optionalText(40),
    email: emailSchema,
    status: storeStatusSchema.default('OPERATING'),
    notice: optionalText(500),
    displayOrder: z.coerce.number().int().min(0).default(0),
    hours: weeklyHoursSchema,
  })
  .strict();
export class CreateStoreDto extends createZodDto(createStoreSchema) {}

export const updateStoreSchema = z
  .object({
    name: z.string().trim().min(1).max(160).optional(),
    cityId: z.uuid().optional(),
    address: z.string().trim().min(1).max(300).optional(),
    phone: optionalText(40),
    email: emailSchema,
    status: storeStatusSchema.optional(),
    notice: optionalText(500),
    displayOrder: z.coerce.number().int().min(0).optional(),
    hours: weeklyHoursSchema.optional(),
  })
  .strict();
export class UpdateStoreDto extends createZodDto(updateStoreSchema) {}

export const updateContactGroupSchema = z
  .object({
    phone: z.string().trim().min(1).max(40).optional(),
    email: z.string().trim().min(1).max(200).optional(),
    hours: z.string().trim().min(1).max(200).optional(),
    address: optionalText(300),
  })
  .strict();
export class UpdateContactGroupDto extends createZodDto(updateContactGroupSchema) {}
