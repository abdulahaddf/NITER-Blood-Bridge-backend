import { Controller, Get, Post, Body, Param, Patch } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DonationsService } from './donations.service';
import { CreateDonationDto } from './dto/donation.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('donations')
@ApiBearerAuth()
@Controller('donations')
export class DonationsController {
  constructor(
    private donationsService: DonationsService,
    private prisma: PrismaService,
  ) {}

  @Get('my')
  @ApiOperation({ summary: 'Get my donation history' })
  async getMyDonations(@CurrentUser('id') userId: string) {
    const profile = await this.prisma.donorProfile.findUnique({
      where: { userId },
    });
    if (!profile) return [];
    return this.donationsService.findByProfile(profile.id);
  }

  @Post()
  @ApiOperation({ summary: 'Log a donation' })
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateDonationDto,
  ) {
    return this.donationsService.create(userId, dto);
  }

  @Patch(':id/verify')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Verify a donation (admin only)' })
  async verify(
    @Param('id') donationId: string,
    @CurrentUser('id') adminId: string,
  ) {
    return this.donationsService.verify(donationId, adminId);
  }
}
