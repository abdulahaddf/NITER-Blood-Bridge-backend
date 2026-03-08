import { Controller, Post, Get, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SeedService } from './seed.service';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('seed')
@ApiBearerAuth()
@Controller('seed')
@Roles('ADMIN', 'SUPER_ADMIN')
export class SeedController {
  constructor(private seedService: SeedService) {}

  @Post('import')
  @ApiOperation({ summary: 'Import seed data from CSV/Excel' })
  async importData(@Body() data: any[]) {
    return this.seedService.importSeedData(data);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get seed data statistics' })
  async getStats() {
    return this.seedService.getStats();
  }
}
