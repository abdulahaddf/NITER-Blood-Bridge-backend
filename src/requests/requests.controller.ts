import { Controller, Get, Post, Body, Param, Patch, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RequestsService } from './requests.service';
import { CreateBloodRequestDto, UpdateRequestStatusDto } from './dto/request.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('requests')
@ApiBearerAuth()
@Controller('requests')
export class RequestsController {
  constructor(private requestsService: RequestsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all blood requests' })
  async findAll(@Query() query: { status?: string; page?: number; limit?: number }) {
    return this.requestsService.findAll(query);
  }

  @Get('my')
  @ApiOperation({ summary: 'Get my blood requests' })
  async getMyRequests(@CurrentUser('id') userId: string) {
    return this.requestsService.findAll({ status: undefined });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get blood request by ID' })
  async findOne(@Param('id') id: string) {
    return this.requestsService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create blood request' })
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateBloodRequestDto,
  ) {
    return this.requestsService.create(userId, dto);
  }

  @Patch(':id/status')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Update request status (admin only)' })
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateRequestStatusDto,
  ) {
    return this.requestsService.updateStatus(id, dto.status);
  }
}
