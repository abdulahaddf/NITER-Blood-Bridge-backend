import { Injectable } from '@nestjs/common';
import { differenceInDays } from 'date-fns';
import { PrismaService } from '../prisma/prisma.service';
import { BloodGroup, Department } from '@prisma/client';
import { SearchDonorsDto } from './dto/search-donors.dto';

// Blood compatibility matrix
const BloodCompatibility: Record<BloodGroup, BloodGroup[]> = {
  A_POS: ['A_POS', 'A_NEG', 'O_POS', 'O_NEG'],
  A_NEG: ['A_NEG', 'O_NEG'],
  B_POS: ['B_POS', 'B_NEG', 'O_POS', 'O_NEG'],
  B_NEG: ['B_NEG', 'O_NEG'],
  AB_POS: ['A_POS', 'A_NEG', 'B_POS', 'B_NEG', 'AB_POS', 'AB_NEG', 'O_POS', 'O_NEG'],
  AB_NEG: ['A_NEG', 'B_NEG', 'AB_NEG', 'O_NEG'],
  O_POS: ['O_POS', 'O_NEG'],
  O_NEG: ['O_NEG'],
};

@Injectable()
export class DonorsService {
  constructor(private prisma: PrismaService) {}

  async search(query: SearchDonorsDto) {
    const {
      search,
      bloodGroups,
      compatibilityMode,
      eligibilityOnly,
      departments,
      batchMin,
      batchMax,
      onCampusOnly,
      willingToDonate,
      sortBy = 'eligible',
      page = 1,
      limit = 20,
    } = query;

    const where: any = {};

    // Search by name or student ID
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { studentId: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Filter by blood group
    if (bloodGroups && bloodGroups.length > 0) {
      if (compatibilityMode) {
        const compatibleGroups = new Set<BloodGroup>();
        bloodGroups.forEach((group) => {
          BloodCompatibility[group].forEach((g) => compatibleGroups.add(g));
        });
        where.bloodGroup = { in: Array.from(compatibleGroups) };
      } else {
        where.bloodGroup = { in: bloodGroups };
      }
    }

    // Filter by department
    if (departments && departments.length > 0) {
      where.department = { in: departments };
    }

    // Filter by batch range
    if (batchMin !== undefined || batchMax !== undefined) {
      where.batch = {};
      if (batchMin !== undefined) where.batch.gte = batchMin;
      if (batchMax !== undefined) where.batch.lte = batchMax;
    }

    // Filter by on-campus
    if (onCampusOnly) {
      where.OR = [
        { currentLocation: { contains: 'niter', mode: 'insensitive' } },
        { currentLocation: { contains: 'campus', mode: 'insensitive' } },
        { currentLocation: { contains: 'hall', mode: 'insensitive' } },
      ];
    }

    // Filter by willing to donate
    if (willingToDonate !== undefined) {
      where.willingToDonate = willingToDonate;
    }

    const skip = (page - 1) * limit;

    const [profiles, total] = await Promise.all([
      this.prisma.donorProfile.findMany({
        where,
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              isActive: true,
            },
          },
        },
      }),
      this.prisma.donorProfile.count({ where }),
    ]);

    // Calculate eligibility for each profile
    let results = profiles.map((profile) => ({
      ...profile,
      eligibility: this.calculateEligibility(profile),
    }));

    // Filter by eligibility
    if (eligibilityOnly) {
      results = results.filter((p) => p.eligibility.eligible);
    }

    // Sort results
    results.sort((a, b) => {
      switch (sortBy) {
        case 'eligible':
          if (a.eligibility.eligible && !b.eligibility.eligible) return -1;
          if (!a.eligibility.eligible && b.eligibility.eligible) return 1;
          return 0;
        case 'donations':
          return b.totalDonations - a.totalDonations;
        case 'recent':
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        case 'batch':
          return b.batch - a.batch;
        default:
          return 0;
      }
    });

    return {
      data: results,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getStats() {
    const [totalDonors, byBloodGroup] = await Promise.all([
      this.prisma.donorProfile.count(),
      this.prisma.donorProfile.groupBy({
        by: ['bloodGroup'],
        _count: {
          bloodGroup: true,
        },
      }),
    ]);

    const bloodGroupStats = await Promise.all(
      byBloodGroup.map(async (stat) => {
        const eligibleCount = await this.prisma.donorProfile.count({
          where: {
            bloodGroup: stat.bloodGroup,
            willingToDonate: true,
            availabilityStatus: 'AVAILABLE',
          },
        });

        return {
          bloodGroup: stat.bloodGroup,
          count: stat._count.bloodGroup,
          eligibleCount,
        };
      }),
    );

    return {
      totalDonors,
      bloodGroupStats,
    };
  }

  async getPublicStats() {
    const stats = await this.getStats();
    
    // Calculate eligible donors
    const allProfiles = await this.prisma.donorProfile.findMany();
    const eligibleDonors = allProfiles.filter(
      (p) => this.calculateEligibility(p).eligible,
    ).length;

    return {
      totalDonors: stats.totalDonors,
      eligibleDonors,
      bloodGroupsAvailable: 8,
      byBloodGroup: stats.bloodGroupStats,
    };
  }

  private calculateEligibility(profile: any) {
    if (!profile.willingToDonate) {
      return { status: 'OPTED_OUT', label: 'Not accepting requests', eligible: false };
    }

    if (!profile.lastDonationDate) {
      return { status: 'UNCONFIRMED', label: 'First-time or unconfirmed donor', eligible: true };
    }

    const ELIGIBILITY_DAYS = 90;
    const daysSince = differenceInDays(new Date(), profile.lastDonationDate);

    if (daysSince >= ELIGIBILITY_DAYS) {
      return { status: 'ELIGIBLE', label: 'Eligible to donate', eligible: true };
    }

    const daysRemaining = ELIGIBILITY_DAYS - daysSince;
    return {
      status: 'NOT_YET',
      label: `Eligible in ${daysRemaining} days`,
      eligible: false,
      daysRemaining,
    };
  }
}
