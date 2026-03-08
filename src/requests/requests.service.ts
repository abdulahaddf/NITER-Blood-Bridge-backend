import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateBloodRequestDto } from './dto/request.dto';

@Injectable()
export class RequestsService {
  constructor(
    private prisma: PrismaService,
    private notificationsService: NotificationsService,
  ) {}

  async findAll(query: { status?: string; page?: number; limit?: number }) {
    const { status, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;

    const [requests, total] = await Promise.all([
      this.prisma.bloodRequest.findMany({
        where,
        skip,
        take: limit,
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
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.bloodRequest.count({ where }),
    ]);

    return {
      data: requests,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const request = await this.prisma.bloodRequest.findUnique({
      where: { id },
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
    });

    if (!request) {
      throw new NotFoundException('Blood request not found');
    }

    return request;
  }

  async create(userId: string, dto: CreateBloodRequestDto) {
    const request = await this.prisma.bloodRequest.create({
      data: {
        requesterId: userId,
        bloodGroup: dto.bloodGroup,
        urgency: dto.urgency,
        location: dto.location,
        hospital: dto.hospital,
        neededBy: dto.neededBy,
        message: dto.message,
        contactPhone: dto.contactPhone,
      },
    });

    // Notify admins for critical requests
    if (dto.urgency === 'critical') {
      await this.notificationsService.notifyAdminsCriticalRequest(request);
    }

    // Notify matching donors
    await this.notificationsService.notifyMatchingDonors(request);

    return request;
  }

  async updateStatus(id: string, status: string) {
    const request = await this.prisma.bloodRequest.findUnique({
      where: { id },
    });

    if (!request) {
      throw new NotFoundException('Blood request not found');
    }

    return this.prisma.bloodRequest.update({
      where: { id },
      data: { status },
    });
  }
}
