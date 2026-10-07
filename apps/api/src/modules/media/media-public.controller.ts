import { Controller, Get, Header, NotFoundException, Param, StreamableFile } from '@nestjs/common';
import { createReadStream } from 'node:fs';
import { MediaService } from './media.service.js';

/**
 * Public read of stored product images at `GET /media/products/:filename`
 * (outside the `/api` prefix). Only server-generated `<uuid>.webp` names beneath
 * the controlled products directory resolve; everything else is a 404, so there
 * is no path traversal and no access to other files.
 */
@Controller('media/products')
export class MediaPublicController {
  constructor(private readonly media: MediaService) {}

  @Get(':filename')
  @Header('Cache-Control', 'public, max-age=31536000, immutable')
  serve(@Param('filename') filename: string): StreamableFile {
    const filePath = this.media.resolveProductFile(filename);
    if (!filePath) {
      throw new NotFoundException('Image not found');
    }
    return new StreamableFile(createReadStream(filePath), { type: 'image/webp' });
  }
}
