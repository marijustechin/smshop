import { Controller, Get } from '@nestjs/common';
import { ContactsPublicService, type PublicContacts } from './contacts-public.service.js';

/** Public (unauthenticated) contact groups and physical stores for the site. */
@Controller('public/contacts')
export class ContactsPublicController {
  constructor(private readonly contacts: ContactsPublicService) {}

  @Get()
  get(): Promise<PublicContacts> {
    return this.contacts.get();
  }
}
