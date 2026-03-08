import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService implements OnModuleInit {
  private transporter: nodemailer.Transporter;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {}

  onModuleInit() {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get('SMTP_HOST'),
      port: this.configService.get('SMTP_PORT'),
      secure: false, // true for 465, false for other ports
      auth: {
        user: this.configService.get('SMTP_USER'),
        pass: this.configService.get('SMTP_PASS'),
      },
    });
  }

  async sendVerificationEmail(email: string, token: string) {
    const frontendUrl = this.configService.get('FRONTEND_URL');
    const verifyUrl = `${frontendUrl}/verify?token=${token}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e1e1e1; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #C0392B; padding: 20px; text-align: center; color: white;">
          <h1 style="margin: 0;">NITER Blood Bridge</h1>
        </div>
        <div style="padding: 30px; line-height: 1.6; color: #333;">
          <h2 style="color: #C0392B;">Welcome to the Brotherhood!</h2>
          <p>You're only one step away from joining our life-saving community. Please click the button below to verify your email address:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verifyUrl}" style="display: inline-block; padding: 14px 28px; background-color: #C0392B; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">Verify Email Address</a>
          </div>
          <p style="font-size: 14px; color: #666;">This link will expire in 24 hours. If you didn't sign up for an account, please ignore this email.</p>
        </div>
        <div style="background-color: #f9f9f9; padding: 15px; text-align: center; font-size: 12px; color: #999;">
          <p>&copy; ${new Date().getFullYear()} NITER Blood Bridge. All rights reserved.</p>
        </div>
      </div>
    `;

    try {
      await this.transporter.sendMail({
        from: this.configService.get('SMTP_FROM'),
        to: email,
        subject: 'Verify your email - NITER Blood Bridge',
        html,
      });
    } catch (error) {
      console.error('Failed to send verification email:', error);
      // Still log the link for development
      console.log(`[EMAIL-DEV] Verification URL: ${verifyUrl}`);
    }
  }

  async sendPasswordResetEmail(email: string, token: string) {
    const frontendUrl = this.configService.get('FRONTEND_URL');
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e1e1e1; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #C0392B; padding: 20px; text-align: center; color: white;">
          <h1 style="margin: 0;">NITER Blood Bridge</h1>
        </div>
        <div style="padding: 30px; line-height: 1.6; color: #333;">
          <h2 style="color: #C0392B;">Reset Your Password</h2>
          <p>We received a request to reset your password. Click the button below to choose a new one:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="display: inline-block; padding: 14px 28px; background-color: #C0392B; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">Reset Password</a>
          </div>
          <p style="font-size: 14px; color: #666;">This link will expire in 15 minutes. If you didn't request a password reset, you can safely ignore this email.</p>
        </div>
        <div style="background-color: #f9f9f9; padding: 15px; text-align: center; font-size: 12px; color: #999;">
          <p>&copy; ${new Date().getFullYear()} NITER Blood Bridge. All rights reserved.</p>
        </div>
      </div>
    `;

    try {
      await this.transporter.sendMail({
        from: this.configService.get('SMTP_FROM'),
        to: email,
        subject: 'Reset Password - NITER Blood Bridge',
        html,
      });
    } catch (error) {
      console.error('Failed to send password reset email:', error);
      console.log(`[EMAIL-DEV] Reset URL: ${resetUrl}`);
    }
  }

  async sendDeletionConfirmedEmail(email: string, note?: string) {
    try {
      await this.transporter.sendMail({
        from: this.configService.get('SMTP_FROM'),
        to: email,
        subject: 'Profile Deleted - NITER Blood Bridge',
        html: `
          <h1>Profile Deleted</h1>
          <p>Your profile has been permanently deleted from NITER Blood Bridge.</p>
          ${note ? `<p>Admin note: ${note}</p>` : ''}
        `,
      });
    } catch (error) {
      console.error('Failed to send deletion confirmation email:', error);
    }
  }

  async sendDeletionRejectedEmail(email: string, note?: string) {
    try {
      await this.transporter.sendMail({
        from: this.configService.get('SMTP_FROM'),
        to: email,
        subject: 'Deletion Request Rejected - NITER Blood Bridge',
        html: `
          <h1>Deletion Request Rejected</h1>
          <p>Your profile deletion request has been rejected. Your profile remains active.</p>
          ${note ? `<p>Admin note: ${note}</p>` : ''}
        `,
      });
    } catch (error) {
      console.error('Failed to send deletion rejection email:', error);
    }
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
