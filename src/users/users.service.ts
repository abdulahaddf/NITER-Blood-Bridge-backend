import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateUserDto, UpdateRoleDto } from './dto/user.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: {
    page?: number;
    limit?: number;
    search?: string;
    role?: UserRole;
    isActive?: boolean;
  }) {
    const { page = 1, limit = 20, search, role, isActive } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { profile: { fullName: { contains: search, mode: 'insensitive' } } },
      ];
    }

    if (role) {
      where.role = role;
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        include: {
          profile: {
            select: {
              id: true,
              fullName: true,
              studentId: true,
              department: true,
              batch: true,
              bloodGroup: true,
              seedMatched: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        profile: {
          include: {
            donationHistory: {
              orderBy: { donationDate: 'desc' },
            },
          },
        },
        notifications: {
          where: { read: false },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      include: {
        profile: true,
      },
    });
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.user.update({
      where: { id },
      data: dto,
      include: {
        profile: true,
      },
    });
  }

  async updateRole(id: string, dto: UpdateRoleDto, adminId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Prevent demoting the last super admin
    if (user.role === 'SUPER_ADMIN' && dto.role !== 'SUPER_ADMIN') {
      const superAdminCount = await this.prisma.user.count({
        where: { role: 'SUPER_ADMIN' },
      });

      if (superAdminCount <= 1) {
        throw new BadRequestException('Cannot demote the last super admin');
      }
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: { role: dto.role },
    });

    // Log admin action
    await this.prisma.adminAuditLog.create({
      data: {
        adminId,
        action: 'UPDATE_ROLE',
        targetUserId: id,
        targetUserName: user.email,
        details: `Changed role from ${user.role} to ${dto.role}`,
      },
    });

    return updatedUser;
  }

  async deactivate(id: string, adminId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Prevent deactivating the last super admin
    if (user.role === 'SUPER_ADMIN') {
      const superAdminCount = await this.prisma.user.count({
        where: { role: 'SUPER_ADMIN', isActive: true },
      });

      if (superAdminCount <= 1) {
        throw new BadRequestException('Cannot deactivate the last super admin');
      }
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: { isActive: false },
    });

    // Log admin action
    await this.prisma.adminAuditLog.create({
      data: {
        adminId,
        action: 'DEACTIVATE_USER',
        targetUserId: id,
        targetUserName: user.email,
      },
    });

    return updatedUser;
  }

  async reactivate(id: string, adminId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: { isActive: true },
    });

    // Log admin action
    await this.prisma.adminAuditLog.create({
      data: {
        adminId,
        action: 'REACTIVATE_USER',
        targetUserId: id,
        targetUserName: user.email,
      },
    });

    return updatedUser;
  }

  async delete(id: string, adminId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Prevent deleting the last super admin
    if (user.role === 'SUPER_ADMIN') {
      const superAdminCount = await this.prisma.user.count({
        where: { role: 'SUPER_ADMIN' },
      });

      if (superAdminCount <= 1) {
        throw new BadRequestException('Cannot delete the last super admin');
      }
    }

    // Log admin action before deletion
    await this.prisma.adminAuditLog.create({
      data: {
        adminId,
        action: 'DELETE_USER',
        targetUserId: id,
        targetUserName: user.email,
      },
    });

    await this.prisma.user.delete({
      where: { id },
    });

    return { message: 'User deleted successfully' };
  }

  async getStats() {
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
}
