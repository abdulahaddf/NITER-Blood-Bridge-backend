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

  async search(searchDto: SearchDonorsDto) {
    const { search, bloodGroups, departments, batchMin, batchMax, onCampusOnly, willingToDonate, compatibilityMode, eligibilityOnly, page = 1, limit = 20, sortBy = 'eligible' } = searchDto;

    // ── Build DonorProfile WHERE clause ────────────────────────
    const where: any = {};
    const andConditions: any[] = [];

    // Search by name or student ID
    if (search) {
      andConditions.push({
        OR: [
          { fullName: { contains: search, mode: 'insensitive' } },
          { studentId: { contains: search, mode: 'insensitive' } },
        ],
      });
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

    // Filter by on-campus (use AND so it doesn't clobber search OR)
    if (onCampusOnly) {
      andConditions.push({
        OR: [
          { currentLocation: { contains: 'niter', mode: 'insensitive' } },
          { currentLocation: { contains: 'campus', mode: 'insensitive' } },
          { currentLocation: { contains: 'hall', mode: 'insensitive' } },
        ],
      });
    }

    // Filter by willing to donate
    if (willingToDonate !== undefined) {
      where.willingToDonate = willingToDonate;
    }

    // Combine AND conditions
    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    // ── Build SeedDonor WHERE clause ──────────────────────────
    const seedWhere: any = { isClaimed: false };
    const seedAnd: any[] = [];

    if (search) {
      seedAnd.push({
        OR: [
          { fullName: { contains: search, mode: 'insensitive' } },
          { studentId: { contains: search, mode: 'insensitive' } },
        ],
      });
    }
    if (bloodGroups && bloodGroups.length > 0) {
      if (compatibilityMode) {
        const compatibleGroups = new Set<BloodGroup>();
        bloodGroups.forEach((group) => {
          BloodCompatibility[group].forEach((g) => compatibleGroups.add(g));
        });
        seedWhere.bloodGroup = { in: Array.from(compatibleGroups) };
      } else {
        seedWhere.bloodGroup = { in: bloodGroups };
      }
    }
    if (departments && departments.length > 0) {
      seedWhere.department = { in: departments };
    }
    if (seedAnd.length > 0) {
      seedWhere.AND = seedAnd;
    }

    // ── Fetch from both tables ────────────────────────────────
    const skip = (page - 1) * limit;

    const [dbProfiles, dbSeedDonors] = await Promise.all([
      this.prisma.donorProfile.findMany({
        where,
        include: {
          user: {
            select: { id: true, isActive: true },
          },
        },
      }),
      this.prisma.seedDonor.findMany({
        where: seedWhere,
      }),
    ]);

    // Format profiles
    const formattedProfiles = dbProfiles.map((profile) => ({
      ...profile,
      isImported: false,
      eligibility: this.calculateEligibility(profile),
    }));

    // Format seed donors
    let formattedSeeds = dbSeedDonors.map((seed) => {
      const batchNum = seed.batch ? parseInt(seed.batch.replace(/\D/g, ''), 10) : 0;
      return {
        id: seed.id,
        isImported: true,
        userId: null,
        user: null,
        fullName: seed.fullName,
        department: (seed.department as Department) || 'TE',
        idNumber: seed.studentId,
        studentId: seed.studentId,
        batch: isNaN(batchNum) ? 0 : batchNum,
        phone: seed.phone || '',
        email: '',
        currentLocation: 'Campus',
        hometown: seed.hometown || '',
        bloodGroup: seed.bloodGroup,
        lastDonationDate: null,
        totalDonations: 0,
        availabilityStatus: 'AVAILABLE',
        availabilityNote: 'Imported from previous database',
        willingToDonate: true,
        seedMatched: false,
        profileComplete: false,
        profilePhoto: null,
        createdAt: seed.importedAt,
        updatedAt: seed.importedAt,
        eligibility: {
          status: 'UNCONFIRMED',
          label: 'Imported Data',
          eligible: true,
        },
      };
    });

    // Memory-filter seed donors for batch
    if (batchMin !== undefined || batchMax !== undefined) {
      formattedSeeds = formattedSeeds.filter((s) => {
        if (batchMin !== undefined && s.batch < batchMin) return false;
        if (batchMax !== undefined && s.batch > batchMax) return false;
        return true;
      });
    }

    // If willingToDonate filter is explicitly false, exclude seed donors
    // (seed donors are assumed willing)
    let seedsToInclude = formattedSeeds;
    if (willingToDonate === false) {
      seedsToInclude = [];
    }

    // Combine all results
    let allResults = [...formattedProfiles, ...seedsToInclude] as any[];

    // Filter by eligibility
    if (eligibilityOnly) {
      allResults = allResults.filter((p) => p.eligibility.eligible);
    }

    // Sort results
    allResults.sort((a, b) => {
      switch (sortBy) {
        case 'eligible':
          if (a.eligibility.eligible && !b.eligibility.eligible) return -1;
          if (!a.eligibility.eligible && b.eligibility.eligible) return 1;
          return 0;
        case 'donations':
          return (b.totalDonations || 0) - (a.totalDonations || 0);
        case 'recent':
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        case 'batch':
          return (b.batch || 0) - (a.batch || 0);
        default:
          return 0;
      }
    });

    const total = allResults.length;
    const paginatedData = allResults.slice(skip, skip + limit);

    return {
      data: paginatedData,
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
            profileComplete: true,
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
    const [unclaimedSeed, unclaimedSeedByGroup, registeredProfiles] = await Promise.all([
      this.prisma.seedDonor.count({ where: { isClaimed: false } }),
      this.prisma.seedDonor.groupBy({
        by: ['bloodGroup'],
        where: { isClaimed: false },
        _count: {
          bloodGroup: true,
        },
      }),
      this.prisma.donorProfile.findMany(),
    ]);

    const bgStatsMap: Record<string, { bloodGroup: BloodGroup; count: number; eligibleCount: number }> = {};

    const BLOOD_GROUPS: BloodGroup[] = ['A_POS', 'A_NEG', 'B_POS', 'B_NEG', 'AB_POS', 'AB_NEG', 'O_POS', 'O_NEG'];
    BLOOD_GROUPS.forEach((bg) => {
      bgStatsMap[bg] = { bloodGroup: bg, count: 0, eligibleCount: 0 };
    });

    // Add unclaimed seed donors per group (seed donors are considered eligible by default)
    unclaimedSeedByGroup.forEach((stat) => {
      if (bgStatsMap[stat.bloodGroup]) {
        bgStatsMap[stat.bloodGroup].count += stat._count.bloodGroup;
        bgStatsMap[stat.bloodGroup].eligibleCount += stat._count.bloodGroup;
      }
    });

    // Add registered stats
    const registeredStats = await this.getStats();
    registeredStats.bloodGroupStats.forEach((stat) => {
      if (bgStatsMap[stat.bloodGroup]) {
        bgStatsMap[stat.bloodGroup].count += stat.count;
        bgStatsMap[stat.bloodGroup].eligibleCount += stat.eligibleCount;
      }
    });

    const eligibleDonorsFromProfiles = registeredProfiles.filter(
      (p) => p.profileComplete && this.calculateEligibility(p).eligible,
    ).length;

    const totalPotentialEligible = unclaimedSeed + eligibleDonorsFromProfiles;

    return {
      totalDonors: unclaimedSeed + registeredStats.totalDonors,
      eligibleDonors: totalPotentialEligible,
      bloodGroupsAvailable: 8,
      byBloodGroup: Object.values(bgStatsMap),
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
