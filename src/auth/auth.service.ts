import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { addHours, addMinutes } from 'date-fns';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  RegisterDto,
  LoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private notificationsService: NotificationsService,
  ) {}

  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const verifyToken = uuidv4();
    const verifyTokenExpiry = addHours(new Date(), 24);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        verifyToken,
        verifyTokenExpiry,
      },
    });

    // Send verification email
    await this.notificationsService.sendVerificationEmail(
      user.email,
      verifyToken,
    );

    return {
      message: 'Registration successful. Please check your email to verify your account.',
      userId: user.id,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.emailVerified) {
      throw new UnauthorizedException('Please verify your email before logging in');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Your account has been suspended. Contact admin.');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = await this.generateTokens(user.id, user.email, user.role);

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified,
      },
      ...tokens,
    };
  }

  async verifyEmail(token: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        verifyToken: token,
        verifyTokenExpiry: {
          gt: new Date(),
        },
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        verifyToken: null,
        verifyTokenExpiry: null,
      },
    });

    return { message: 'Email verified successfully' };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      // Don't reveal if email exists
      return { message: 'If an account exists, a reset link has been sent' };
    }

    const resetToken = uuidv4();
    const resetTokenExpiry = addMinutes(new Date(), 15);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken,
        resetTokenExpiry,
      },
    });

    await this.notificationsService.sendPasswordResetEmail(
      user.email,
      resetToken,
    );

    return { message: 'If an account exists, a reset link has been sent' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.prisma.user.findFirst({
      where: {
        resetToken: dto.token,
        resetTokenExpiry: {
          gt: new Date(),
        },
      },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });

    return { message: 'Password reset successfully' };
  }

  async refreshTokens(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedException();
      }

      return this.generateTokens(user.id, user.email, user.role);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async googleLogin(profile: any) {
    const { email, googleId, firstName, lastName } = profile;
    const fullName = [firstName, lastName].filter(Boolean).join(' ') || email.split('@')[0];

    let user = await this.prisma.user.findFirst({
      where: {
        OR: [{ googleId }, { email }],
      },
    });

    let isNewUser = false;

    if (!user) {
      // Create new user
      user = await this.prisma.user.create({
        data: {
          email,
          googleId,
          emailVerified: true,
        },
      });
      isNewUser = true;
    } else if (!user.googleId) {
      // Link Google account to existing user
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { googleId },
      });
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Your account has been suspended. Contact admin.');
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Check if DonorProfile exists
    const existingProfile = await this.prisma.donorProfile.findUnique({
      where: { userId: user.id },
    });

    const hasProfile = !!existingProfile;

    // Auto-create a minimal profile for new Google users
    if (!existingProfile && isNewUser) {
      try {
        await this.prisma.donorProfile.create({
          data: {
            userId: user.id,
            fullName,
            email,
            department: null,
            idNumber: null,
            studentId: `GOOGLE-${user.id.substring(0, 8)}`,
            batch: null,
            phone: '',
            currentLocation: '',
            hometown: '',
            bloodGroup: 'O_POS',
            willingToDonate: true,
            availabilityStatus: 'AVAILABLE',
            profileComplete: false,
          },
        });
      } catch (err) {
        console.error('Auto-profile creation failed (non-fatal):', err);
      }
    }

    const tokens = await this.generateTokens(user.id, user.email, user.role);

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified,
      },
      hasProfile,
      ...tokens,
    };
  }

  private async generateTokens(userId: string, email: string, role: string) {
    const payload = { sub: userId, email, role };

    const accessToken = this.jwtService.sign(payload);
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get('JWT_REFRESH_EXPIRES_IN', '7d'),
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  async validateUser(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        emailVerified: true,
        isActive: true,
      },
    });
  }
}
