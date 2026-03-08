import { Controller, Get, Query, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { DonorsService } from './donors.service';
import { SearchDonorsDto } from './dto/search-donors.dto';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('donors')
@ApiBearerAuth()
@Controller('donors')
export class DonorsController {
  constructor(private donorsService: DonorsService) {}

  @Get()
  @ApiOperation({ summary: 'Search donors' })
  @ApiResponse({ status: 200, description: 'List of donors' })
  async search(@Query() query: SearchDonorsDto) {
    return this.donorsService.search(query);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get donor statistics' })
  async getStats() {
    return this.donorsService.getStats();
  }

  @Get('public-stats')
  @Public()
  @ApiOperation({ summary: 'Get public donor statistics (no auth required)' })
  async getPublicStats() {
    return this.donorsService.getPublicStats();
  }
}
