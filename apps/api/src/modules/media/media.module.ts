import { Module } from '@nestjs/common';
import { AuthSessionModule } from '../auth/session/auth-session.module.js';
import { RolesGuard } from '../admin/authorization/roles.guard.js';
import { MediaAdminController } from './media-admin.controller.js';
import { MediaPublicController } from './media-public.controller.js';
import { MediaService } from './media.service.js';

/**
 * Product-image media: admin upload plus public serving of stored files.
 */
@Module({
  imports: [AuthSessionModule],
  controllers: [MediaAdminController, MediaPublicController],
  providers: [MediaService, RolesGuard],
})
export class MediaModule {}
