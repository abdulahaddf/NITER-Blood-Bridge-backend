import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDonationDto } from './dto/donation.dto';

@Injectable()
export class DonationsService {
  constructor(private prisma: PrismaService) {}

  async findByProfile(profileId: string) {
    return this.prisma.donationLog.findMany({
      where: { profileId },
      orderBy: { donationDate: 'desc' },
    });
  }

  async create(userId: string, dto: CreateDonationDto) {
    const profile = await this.prisma.donorProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    // Create donation log
    const donation = await this.prisma.donationLog.create({
      data: {
        profileId: profile.id,
        donationDate: dto.donationDate,
        location: dto.location,
        notes: dto.notes,
      },
    });

    // Update profile
    await this.prisma.donorProfile.update({
      where: { id: profile.id },
      data: {
        lastDonationDate: dto.donationDate,
        totalDonations: { increment: 1 },
      },
    });

    return donation;
  }

  async verify(donationId: string, adminId: string) {
    const donation = await this.prisma.donationLog.findUnique({
      where: { id: donationId },
    });

    if (!donation) {
      throw new NotFoundException('Donation not found');
    }

    return this.prisma.donationLog.update({
      where: { id: donationId },
      data: {
        verified: true,
        verifiedBy: adminId,
      },
    });
  }
}
