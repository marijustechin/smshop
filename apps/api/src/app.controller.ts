import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  root(): { service: string; status: string } {
    return { service: 'api', status: 'ok' };
  }
}
