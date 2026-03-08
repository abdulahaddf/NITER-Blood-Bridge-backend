import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  private resend: Resend;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    if (apiKey) {
      this.resend = new Resend(apiKey);
    }
  }

  async sendVerificationEmail(email: string, token: string) {
    const frontendUrl = this.configService.get('FRONTEND_URL');
    const verifyUrl = `${frontendUrl}/verify?token=${token}`;

    if (!this.resend) {
      console.log(`[EMAIL] Verification email to ${email}: ${verifyUrl}`);
      return;
    }

    await this.resend.emails.send({
      from: 'NITER Blood Connect <noreply@niter.edu.bd>',
      to: email,
      subject: 'Verify your email - NITER Blood Connect',
      html: `
        <h1>Welcome to NITER Blood Connect!</h1>
        <p>Please click the link below to verify your email address:</p>
        <a href="${verifyUrl}" style="padding: 12px 24px; background: #C0392B; color: white; text-decoration: none; border-radius: 4px;">Verify Email</a>
        <p>This link will expire in 24 hours.</p>
      `,
    });
  }

  async sendPasswordResetEmail(email: string, token: string) {
    const frontendUrl = this.configService.get('FRONTEND_URL');
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

    if (!this.resend) {
      console.log(`[EMAIL] Password reset email to ${email}: ${resetUrl}`);
      return;
    }

    await this.resend.emails.send({
      from: 'NITER Blood Connect <noreply@niter.edu.bd>',
      to: email,
      subject: 'Password Reset - NITER Blood Connect',
      html: `
        <h1>Password Reset Request</h1>
        <p>Click the link below to reset your password:</p>
        <a href="${resetUrl}" style="padding: 12px 24px; background: #C0392B; color: white; text-decoration: none; border-radius: 4px;">Reset Password</a>
        <p>This link will expire in 15 minutes.</p>
      `,
    });
  }

  async sendDeletionConfirmedEmail(email: string, note?: string) {
    if (!this.resend) {
      console.log(`[EMAIL] Deletion confirmed email to ${email}`);
      return;
    }

    await this.resend.emails.send({
      from: 'NITER Blood Connect <noreply@niter.edu.bd>',
      to: email,
      subject: 'Profile Deleted - NITER Blood Connect',
      html: `
        <h1>Profile Deleted</h1>
        <p>Your profile has been permanently deleted from NITER Blood Connect.</p>
        ${note ? `<p>Admin note: ${note}</p>` : ''}
      `,
    });
  }

  async sendDeletionRejectedEmail(email: string, note?: string) {
    if (!this.resend) {
      console.log(`[EMAIL] Deletion rejected email to ${email}`);
      return;
    }

    await this.resend.emails.send({
      from: 'NITER Blood Connect <noreply@niter.edu.bd>',
      to: email,
      subject: 'Deletion Request Rejected - NITER Blood Connect',
      html: `
        <h1>Deletion Request Rejected</h1>
        <p>Your profile deletion request has been rejected. Your profile remains active.</p>
        ${note ? `<p>Admin note: ${note}</p>` : ''}
      `,
    });
  }

  async notifyAdminsCriticalRequest(request: any) {
    const admins = await this.prisma.user.findMany({
      where: {
        role: { in: ['ADMIN', 'SUPER_ADMIN'] },
        isActive: true,
      },
    });

    for (const admin of admins) {
      await this.createNotification({
        userId: admin.id,
        type: 'BLOOD_REQUEST',
        title: 'Critical Blood Request',
        message: `Urgent ${request.bloodGroup} blood needed at ${request.location}`,
        link: `/dashboard/requests`,
      });
    }
  }

  async notifyMatchingDonors(request: any) {
    const matchingDonors = await this.prisma.donorProfile.findMany({
      where: {
        bloodGroup: request.bloodGroup,
        willingToDonate: true,
        availabilityStatus: 'AVAILABLE',
      },
    });

    for (const donor of matchingDonors) {
      await this.createNotification({
        userId: donor.userId,
        type: 'BLOOD_REQUEST',
        title: 'Blood Request Matching Your Type',
        message: `Someone needs ${request.bloodGroup} blood at ${request.location}`,
        link: `/requests/${request.id}`,
      });
    }
  }

  async createNotification(data: {
    userId: string;
    type: string;
    title: string;
    message: string;
    link?: string;
  }) {
    return this.prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type as any,
        title: data.title,
        message: data.message,
        link: data.link,
      },
    });
  }

  async getUserNotifications(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markAsRead(notificationId: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: {
        id: notificationId,
        userId,
      },
      data: { read: true },
    });
  }

  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: {
        userId,
        read: false,
      },
      data: { read: true },
    });
  }
}
