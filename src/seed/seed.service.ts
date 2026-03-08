import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BloodGroup, Department } from '@prisma/client';

@Injectable()
export class SeedService {
  constructor(private prisma: PrismaService) {}

  async importSeedData(data: Array<{
    studentId: string;
    fullName: string;
    bloodGroup: string;
    hometown?: string;
    phone?: string;
  }>) {
    const results = {
      imported: 0,
      skipped: 0,
      errors: [] as string[],
    };

    for (const item of data) {
      try {
        // Validate student ID format
        const parts = item.studentId.split('-');
        if (parts.length !== 2) {
          results.skipped++;
          results.errors.push(`Invalid student ID format: ${item.studentId}`);
          continue;
        }

        const [dept, idNum] = parts;
        if (!Object.values(Department).includes(dept as Department)) {
          results.skipped++;
          results.errors.push(`Invalid department: ${dept}`);
          continue;
        }

        // Normalize blood group
        const normalizedBloodGroup = this.normalizeBloodGroup(item.bloodGroup);
        if (!normalizedBloodGroup) {
          results.skipped++;
          results.errors.push(`Invalid blood group: ${item.bloodGroup}`);
          continue;
        }

        // Check if already exists
        const existing = await this.prisma.seedDonor.findUnique({
          where: { studentId: item.studentId },
        });

        if (existing) {
          results.skipped++;
          continue;
        }

        // Create seed donor
        await this.prisma.seedDonor.create({
          data: {
            studentId: item.studentId,
            fullName: item.fullName,
            bloodGroup: normalizedBloodGroup as BloodGroup,
            hometown: item.hometown,
            phone: item.phone,
          },
        });

        results.imported++;
      } catch (error) {
        results.skipped++;
        results.errors.push(`Error importing ${item.studentId}: ${error.message}`);
      }
    }

    return results;
  }

  private normalizeBloodGroup(input: string): string | null {
    const normalized = input
      .toUpperCase()
      .replace(/\s/g, '')
      .replace(/\(VE\)/, '')
      .replace(/POSITIVE/, '+')
      .replace(/NEGATIVE/, '-')
      .replace(/POS/, '_POS')
      .replace(/NEG/, '_NEG');

    const validGroups = Object.values(BloodGroup);
    if (validGroups.includes(normalized as BloodGroup)) {
      return normalized;
    }

    // Try alternative formats
    const mappings: Record<string, string> = {
      'A+': 'A_POS',
      'A-': 'A_NEG',
      'B+': 'B_POS',
      'B-': 'B_NEG',
      'AB+': 'AB_POS',
      'AB-': 'AB_NEG',
      'O+': 'O_POS',
      'O-': 'O_NEG',
    };

    return mappings[input.toUpperCase().replace(/\s/g, '')] || null;
  }

  async getStats() {
    const [total, claimed, unclaimed] = await Promise.all([
      this.prisma.seedDonor.count(),
      this.prisma.seedDonor.count({ where: { isClaimed: true } }),
      this.prisma.seedDonor.count({ where: { isClaimed: false } }),
    ]);

    return { total, claimed, unclaimed };
  }
}
