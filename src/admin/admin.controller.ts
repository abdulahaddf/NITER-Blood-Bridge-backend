import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
@Roles('ADMIN', 'SUPER_ADMIN')
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get dashboard statistics' })
  async getDashboardStats() {
    return this.adminService.getDashboardStats();
  }

  @Get('deletions')
  @ApiOperation({ summary: 'Get pending deletion requests' })
  async getDeletionRequests() {
    return this.adminService.getDeletionRequests();
  }

  @Post('deletions/:id/confirm')
  @ApiOperation({ summary: 'Confirm deletion request' })
  async confirmDeletion(
    @Param('id') requestId: string,
    @CurrentUser('id') adminId: string,
    @Body('note') note?: string,
  ) {
    return this.adminService.processDeletionRequest(requestId, 'CONFIRMED', adminId, note);
  }

  @Post('deletions/:id/reject')
  @ApiOperation({ summary: 'Reject deletion request' })
  async rejectDeletion(
    @Param('id') requestId: string,
    @CurrentUser('id') adminId: string,
    @Body('note') note?: string,
  ) {
    return this.adminService.processDeletionRequest(requestId, 'REJECTED', adminId, note);
  }

  @Get('seed-data')
  @ApiOperation({ summary: 'Get seed data' })
  async getSeedData(@Query() query: { search?: string; isClaimed?: boolean }) {
    return this.adminService.getSeedData(query);
  }

  @Get('audit-logs')
  @ApiOperation({ summary: 'Get admin audit logs' })
  async getAuditLogs(@Query() query: { page?: number; limit?: number }) {
    return this.adminService.getAuditLogs(query);
  }
}
