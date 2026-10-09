import { Module } from '@nestjs/common';
import { ContactsPublicController } from './contacts-public.controller.js';
import { ContactsPublicService } from './contacts-public.service.js';

/** Public contact reads; `PrismaModule` is global. */
@Module({
  controllers: [ContactsPublicController],
  providers: [ContactsPublicService],
})
export class ContactsPublicModule {}
