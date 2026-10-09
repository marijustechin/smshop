import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AccessTokenGuard } from '../../auth/session/access-token.guard.js';
import { Roles } from '../authorization/roles.decorator.js';
import { RolesGuard } from '../authorization/roles.guard.js';
import { CitiesService } from './cities.service.js';
import { ContactGroupsService } from './contact-groups.service.js';
import { StoresService } from './stores.service.js';
import {
  CreateCityDto,
  CreateStoreDto,
  UpdateCityDto,
  UpdateContactGroupDto,
  UpdateStoreDto,
} from './dto/contact.dto.js';

/**
 * Admin management of cities, physical stores and the fixed business contact
 * groups. Administrator-only; the public surface is a separate read-only
 * controller. Store hours live outside catalogue/e-shop categories by design.
 */
@Controller('admin/contacts')
@UseGuards(AccessTokenGuard, RolesGuard)
@Roles('admin')
export class AdminContactsController {
  constructor(
    private readonly cities: CitiesService,
    private readonly stores: StoresService,
    private readonly groups: ContactGroupsService,
  ) {}

  @Get('cities')
  listCities() {
    return this.cities.list();
  }

  @Post('cities')
  createCity(@Body() dto: CreateCityDto) {
    return this.cities.create(dto);
  }

  @Patch('cities/:id')
  updateCity(@Param('id') id: string, @Body() dto: UpdateCityDto) {
    return this.cities.update(id, dto);
  }

  @Delete('cities/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteCity(@Param('id') id: string) {
    return this.cities.delete(id);
  }

  @Get('stores')
  listStores() {
    return this.stores.list();
  }

  @Post('stores')
  createStore(@Body() dto: CreateStoreDto) {
    return this.stores.create(dto);
  }

  @Patch('stores/:id')
  updateStore(@Param('id') id: string, @Body() dto: UpdateStoreDto) {
    return this.stores.update(id, dto);
  }

  @Delete('stores/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteStore(@Param('id') id: string) {
    return this.stores.delete(id);
  }

  @Get('groups')
  listGroups() {
    return this.groups.list();
  }

  @Patch('groups/:key')
  updateGroup(@Param('key') key: string, @Body() dto: UpdateContactGroupDto) {
    return this.groups.update(key, dto);
  }
}
