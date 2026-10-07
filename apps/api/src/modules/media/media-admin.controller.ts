import {
  BadRequestException,
  Controller,
  PayloadTooLargeException,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { AccessTokenGuard } from '../auth/session/access-token.guard.js';
import { Roles } from '../admin/authorization/roles.decorator.js';
import { RolesGuard } from '../admin/authorization/roles.guard.js';
import { MediaService, type StoredImage } from './media.service.js';

/**
 * Admin-only product-image upload. Accepts a single multipart image and returns
 * the stored metadata. Authorization is the same server-side admin guard used by
 * the rest of the admin area.
 */
@Controller('admin/media')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('admin')
export class MediaAdminController {
  constructor(private readonly media: MediaService) {}

  @Post('images')
  async upload(@Req() request: FastifyRequest): Promise<StoredImage> {
    let file: Awaited<ReturnType<FastifyRequest['file']>>;
    try {
      file = await request.file();
    } catch (error) {
      throw this.mapUploadError(error);
    }
    if (!file) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'MEDIA_FILE_REQUIRED',
        message: 'No image file provided',
      });
    }

    let buffer: Buffer;
    try {
      buffer = await file.toBuffer();
    } catch (error) {
      throw this.mapUploadError(error);
    }

    return this.media.saveProductImage(buffer);
  }

  private mapUploadError(error: unknown): Error {
    const code = (error as { code?: unknown } | null)?.code;
    if (code === 'FST_REQ_FILE_TOO_LARGE') {
      return new PayloadTooLargeException({
        statusCode: 413,
        code: 'MEDIA_FILE_TOO_LARGE',
        message: 'Image exceeds the 10 MB limit',
      });
    }
    if (code === 'FST_FILES_LIMIT') {
      return new BadRequestException({
        statusCode: 400,
        code: 'MEDIA_TOO_MANY_FILES',
        message: 'Only one image may be uploaded',
      });
    }
    return error instanceof Error ? error : new BadRequestException('Invalid upload');
  }
}
