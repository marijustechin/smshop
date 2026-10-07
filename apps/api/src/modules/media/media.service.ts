import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { isAbsolute, join, resolve, sep } from 'node:path';
import sharp from 'sharp';

/** Maximum accepted upload size for a single product image (10 MB). */
export const MAX_IMAGE_UPLOAD_BYTES = 10 * 1024 * 1024;
/** Longest output edge; images are never upscaled beyond their input size. */
export const MAX_IMAGE_DIMENSION = 2400;
const ALLOWED_INPUT_FORMATS = new Set(['jpeg', 'png', 'webp']);
const PRODUCT_FILE_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/;

export interface StoredImage {
  key: string;
  url: string;
  width: number;
  height: number;
  mimeType: 'image/webp';
  sizeBytes: number;
}

/**
 * Local persistent product-image storage. Images are validated and normalized to
 * WebP (auto-rotated, metadata stripped, bounded dimensions), stored under
 * `<MEDIA_STORAGE_DIR>/products/<uuid>.webp`, and exposed through the stable
 * application-relative URL `/media/products/<uuid>.webp` so physical storage can
 * later move to object storage without changing product records.
 *
 * All file names are server-generated UUIDs; original names are never used, and
 * the read path only resolves strict UUID `.webp` names beneath the products
 * directory (no traversal, no arbitrary file access).
 */
@Injectable()
export class MediaService {
  private readonly productsDir: string;

  constructor(config: ConfigService) {
    const configured = config.get<string>('MEDIA_STORAGE_DIR')?.trim();
    const base = configured
      ? isAbsolute(configured)
        ? configured
        : resolve(process.cwd(), configured)
      : resolve(process.cwd(), 'data', 'uploads');
    this.productsDir = join(base, 'products');
  }

  /** Validates, normalizes and stores an uploaded image; returns safe metadata. */
  async saveProductImage(buffer: Buffer): Promise<StoredImage> {
    if (buffer.length === 0) {
      throw this.invalidImage();
    }

    let format: string | undefined;
    try {
      const metadata = await sharp(buffer, {
        failOn: 'error',
        limitInputPixels: 40_000_000,
      }).metadata();
      format = metadata.format;
    } catch {
      throw this.invalidImage();
    }
    if (!format || !ALLOWED_INPUT_FORMATS.has(format)) {
      // Rejects SVG, GIF, PDF and any non-raster/arbitrary content regardless of
      // the supplied MIME type or file name.
      throw this.invalidImage();
    }

    let data: Buffer;
    let info: { width: number; height: number; size: number };
    try {
      const result = await sharp(buffer, { failOn: 'error', limitInputPixels: 40_000_000 })
        .rotate() // applies EXIF orientation and drops metadata
        .resize({
          width: MAX_IMAGE_DIMENSION,
          height: MAX_IMAGE_DIMENSION,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: 82 })
        .toBuffer({ resolveWithObject: true });
      data = result.data;
      info = result.info;
    } catch {
      throw this.invalidImage();
    }

    const filename = `${randomUUID()}.webp`;
    await mkdir(this.productsDir, { recursive: true });
    await writeFile(join(this.productsDir, filename), data);

    return {
      key: `products/${filename}`,
      url: `/media/products/${filename}`,
      width: info.width,
      height: info.height,
      mimeType: 'image/webp',
      sizeBytes: info.size,
    };
  }

  /** Resolves a safe stored product-image path, or `null` for anything else. */
  resolveProductFile(filename: string): string | null {
    if (!PRODUCT_FILE_PATTERN.test(filename)) {
      return null;
    }
    const filePath = join(this.productsDir, filename);
    // Defense in depth: even with the strict name pattern, never leave the dir.
    if (!filePath.startsWith(this.productsDir + sep)) {
      return null;
    }
    return existsSync(filePath) ? filePath : null;
  }

  private invalidImage(): BadRequestException {
    return new BadRequestException({
      statusCode: 400,
      code: 'INVALID_IMAGE',
      message: 'Only JPEG, PNG or WebP images are accepted',
    });
  }
}
