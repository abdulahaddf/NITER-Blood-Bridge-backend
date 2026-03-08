import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  async getDashboardStats() {
    const [
      totalUsers,
      verifiedProfiles,
      eligibleDonors,
      pendingDeletions,
      openBloodRequests,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.donorProfile.count({
        where: { seedMatched: true },
      }),
      this.prisma.donorProfile.count({
        where: {
          willingToDonate: true,
          availabilityStatus: 'AVAILABLE',
        },
      }),
      this.prisma.deletionRequest.count({
        where: { status: 'PENDING' },
      }),
      this.prisma.bloodRequest.count({
        where: { status: 'open' },
      }),
    ]);

    return {
      totalUsers,
      verifiedProfiles,
      eligibleDonors,
      pendingDeletions,
      openBloodRequests,
    };
  }

  async getDeletionRequests() {
    return this.prisma.deletionRequest.findMany({
      where: { status: 'PENDING' },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
        profile: {
          select: {
            fullName: true,
            studentId: true,
          },
        },
      },
      orderBy: { requestedAt: 'desc' },
    });
  }

  async processDeletionRequest(
    requestId: string,
    action: 'CONFIRMED' | 'REJECTED',
    adminId: string,
    adminNote?: string,
  ) {
    const request = await this.prisma.deletionRequest.findUnique({
      where: { id: requestId },
      include: {
        user: true,
        profile: true,
      },
    });

    if (!request) {
      throw new NotFoundException('Deletion request not found');
    }

    await this.prisma.deletionRequest.update({
      where: { id: requestId },
      data: {
        status: action,
        adminNote,
        resolvedAt: new Date(),
        resolvedBy: adminId,
      },
    });

    if (action === 'CONFIRMED') {
      // Delete profile and user
      await this.prisma.donorProfile.delete({
        where: { id: request.profileId },
      });
      await this.prisma.user.delete({
        where: { id: request.userId },
      });

      // Notify user
      await this.notificationsService.sendDeletionConfirmedEmail(
        request.user.email,
        adminNote,
      );
    } else {
      // Notify user
      await this.notificationsService.sendDeletionRejectedEmail(
        request.user.email,
        adminNote,
      );
    }

    return { message: `Deletion request ${action.toLowerCase()}` };
  }

  async getSeedData(query: { search?: string; isClaimed?: boolean }) {
    const { search, isClaimed } = query;
    const where: any = {};

    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { studentId: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (isClaimed !== undefined) {
      where.isClaimed = isClaimed;
    }

    return this.prisma.seedDonor.findMany({
      where,
      orderBy: { importedAt: 'desc' },
    });
  }

  async getAuditLogs(query: { page?: number; limit?: number }) {
    const { page = 1, limit = 50 } = query;
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      this.prisma.adminAuditLog.findMany({
        skip,
        take: limit,
        include: {
          admin: {
            select: {
              email: true,
              profile: {
                select: {
                  fullName: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.adminAuditLog.count(),
    ]);

    return {
      data: logs,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
