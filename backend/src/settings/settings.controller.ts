import { Controller, Get, Put, Body } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/settings.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../users/user.entity';
import { Public } from '../auth/decorators/public.decorator';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  /**
   * GET /settings - Get current active settings
   * Public endpoint for now (can be restricted later)
   */
  @Public()
  @Get()
  async getSettings() {
    return this.settingsService.getActiveSettings();
  }

  /**
   * PUT /settings - Update settings (Admin only)
   */
  @Roles(Role.ADMIN)
  @Put()
  async updateSettings(@Body() dto: UpdateSettingsDto) {
    return this.settingsService.updateSettings(dto);
  }
}
