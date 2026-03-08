import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { differenceInDays } from 'date-fns';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProfileDto, UpdateProfileDto } from './dto/profile.dto';

@Injectable()
export class ProfilesService {
  constructor(private prisma: PrismaService) {}

  async findByUserId(userId: string) {
    const profile = await this.prisma.donorProfile.findUnique({
      where: { userId },
      include: {
        donationHistory: {
          orderBy: { donationDate: 'desc' },
        },
        contactReveals: {
          include: {
            requester: {
              select: {
                id: true,
                email: true,
                profile: {
                  select: {
                    fullName: true,
                  },
                },
              },
            },
          },
          orderBy: { revealedAt: 'desc' },
        },
      },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    return {
      ...profile,
      eligibility: this.calculateEligibility(profile),
    };
  }

  async findById(id: string) {
    let profile: any = await this.prisma.donorProfile.findUnique({
      where: { id },
      include: {
        donationHistory: {
          orderBy: { donationDate: 'desc' },
        },
      },
    });

    if (!profile) {
      // Fallback: check if it's a seed donor id
      const seed = await this.prisma.seedDonor.findUnique({
        where: { id },
      });

      if (!seed) {
        throw new NotFoundException('Profile not found');
      }

      // Format seed donor to look like a profile
      const batchNum = seed.batch ? parseInt(seed.batch.replace(/\D/g, ''), 10) : 0;
      profile = {
        id: seed.id,
        userId: null,
        fullName: seed.fullName,
        department: seed.department || 'TE',
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
        donationHistory: [],
      };
    }

    return {
      ...profile,
      eligibility: this.calculateEligibility(profile),
    };
  }

  async create(userId: string, dto: CreateProfileDto) {
    // Check if user already has a profile
    const existingProfile = await this.prisma.donorProfile.findUnique({
      where: { userId },
    });

    if (existingProfile) {
      throw new ConflictException('Profile already exists');
    }

    // Check if student ID is already taken
    const studentId = `${dto.department}-${dto.idNumber}`;
    const existingStudentId = await this.prisma.donorProfile.findUnique({
      where: { studentId },
    });

    if (existingStudentId) {
      throw new ConflictException('Student ID already registered');
    }

    // Check seed match
    const seedMatch = await this.prisma.seedDonor.findUnique({
      where: { studentId },
    });

    const profile = await this.prisma.donorProfile.create({
      data: {
        userId,
        fullName: dto.fullName,
        department: dto.department,
        idNumber: dto.idNumber,
        studentId,
        batch: dto.batch,
        phone: dto.phone,
        email: dto.email,
        currentLocation: dto.currentLocation,
        hometown: dto.hometown,
        bloodGroup: dto.bloodGroup,
        lastDonationDate: dto.neverDonated ? null : dto.lastDonationDate,
        willingToDonate: dto.willingToDonate,
        availabilityNote: dto.availabilityNote,
        availabilityStatus: dto.willingToDonate ? 'AVAILABLE' : 'UNAVAILABLE',
        seedMatched: !!seedMatch,
        seedMatchedAt: seedMatch ? new Date() : null,
        profileComplete: true,
      },
    });

    // Update seed donor if matched
    if (seedMatch) {
      await this.prisma.seedDonor.update({
        where: { id: seedMatch.id },
        data: {
          isClaimed: true,
          claimedAt: new Date(),
        },
      });
    }

    return profile;
  }

  async update(userId: string, dto: UpdateProfileDto) {
    const profile = await this.prisma.donorProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException('Profile not found');
    }

    const updateData: any = {};

    if (dto.fullName != null) updateData.fullName = dto.fullName;
    if (dto.batch != null) updateData.batch = dto.batch;
    if (dto.phone != null) updateData.phone = dto.phone;
    if (dto.email != null) updateData.email = dto.email;
    if (dto.currentLocation != null) updateData.currentLocation = dto.currentLocation;
    if (dto.hometown != null) updateData.hometown = dto.hometown;
    if (dto.bloodGroup != null) updateData.bloodGroup = dto.bloodGroup;
    if (dto.willingToDonate !== undefined) {
      updateData.willingToDonate = dto.willingToDonate;
      updateData.availabilityStatus = dto.willingToDonate ? 'AVAILABLE' : 'UNAVAILABLE';
    }
    if (dto.availabilityNote !== undefined) updateData.availabilityNote = dto.availabilityNote;
    if (dto.profilePhoto != null) updateData.profilePhoto = dto.profilePhoto;

    // Handle last donation date
    if (dto.neverDonated !== undefined) {
      updateData.lastDonationDate = dto.neverDonated ? null : dto.lastDonationDate;
    } else if (dto.lastDonationDate) {
      updateData.lastDonationDate = dto.lastDonationDate;
    }

    // Handle department/idNumber change - check seed match
    if (dto.department != null && dto.idNumber != null) {
      const newStudentId = `${dto.department}-${dto.idNumber}`;
      
      if (newStudentId !== profile.studentId) {
        const existing = await this.prisma.donorProfile.findUnique({
          where: { studentId: newStudentId },
        });

        if (existing) {
          throw new ConflictException('Student ID already registered');
        }

        updateData.department = dto.department;
        updateData.idNumber = dto.idNumber;
        updateData.studentId = newStudentId;

        // Check new seed match
        const seedMatch = await this.prisma.seedDonor.findUnique({
          where: { studentId: newStudentId },
        });

        if (seedMatch && !profile.seedMatched) {
          updateData.seedMatched = true;
          updateData.seedMatchedAt = new Date();

          await this.prisma.seedDonor.update({
            where: { id: seedMatch.id },
            data: {
              isClaimed: true,
              claimedAt: new Date(),
            },
          });
        }
      }
    }

    // Check if profile is now complete (has all required fields)
    const merged = { ...profile, ...updateData };
    if (merged.fullName && merged.department && merged.idNumber && merged.batch &&
        merged.phone && merged.email && merged.currentLocation && merged.hometown && merged.bloodGroup) {
      updateData.profileComplete = true;
    }

    return this.prisma.donorProfile.update({
      where: { userId },
      data: updateData,
    });
  }

  async checkSeedMatch(department: string, idNumber: string) {
    const studentId = `${department}-${idNumber}`;
    const seed = await this.prisma.seedDonor.findUnique({
      where: { studentId },
    });

    return {
      matched: !!seed,
      seedData: seed
        ? {
            fullName: seed.fullName,
            bloodGroup: seed.bloodGroup,
            hometown: seed.hometown,
          }
        : null,
    };
  }

  async getCompletionStatus(userId: string) {
    const profile = await this.prisma.donorProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      return { completion: 0 };
    }

    const requiredFields = [
      profile.fullName,
      profile.department,
      profile.idNumber,
      profile.batch,
      profile.phone,
      profile.email,
      profile.currentLocation,
      profile.hometown,
      profile.bloodGroup,
    ];

    const filledFields = requiredFields.filter(Boolean).length;
    const completion = Math.round((filledFields / requiredFields.length) * 100);

    return { completion };
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
