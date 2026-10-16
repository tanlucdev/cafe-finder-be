import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { mapAuthUser } from './auth-user.mapper';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private emailService: EmailService,
  ) {}

  async register(dto: RegisterDto) {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) {
      throw new ConflictException('Email is already in use');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        registrationMethod: 'EMAIL',
        displayName: dto.displayName,
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        createdAt: true,
        authVersion: true,
      },
    });

    const token = this.signAuthToken(user.id, user.role, user.authVersion);
    return { token, user };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        displayName: true,
        role: true,
        isHidden: true,
        authVersion: true,
        createdAt: true,
      },
    });

    if (!user || user.isHidden) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const token = this.signAuthToken(user.id, user.role, user.authVersion);
    return { token, user: mapAuthUser(user) };
  }

  async getMe(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId, isHidden: false },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        createdAt: true,
        avatarUrl: true,
      },
    });
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    return this.prisma.user.update({
      where: { id: userId, isHidden: false },
      data: { displayName: dto.displayName },
      select: { id: true, email: true, displayName: true, role: true, createdAt: true },
    });
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId, isHidden: false } });

    if (!user?.passwordHash) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const isValid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, authVersion: { increment: 1 } },
    });

    return { message: 'Password changed successfully' };
  }

  async forgotPassword(email: string, locale: 'vi' | 'en') {
    const user = await this.prisma.user.findUnique({ where: { email } });
    const message = forgotPasswordMessage(locale);

    // Passwordless Google accounts deliberately stay outside this flow.
    if (!user || user.isHidden || !user.passwordHash) return { message };

    const token = crypto.randomBytes(32).toString('base64url');
    const tokenHash = hashResetToken(token);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    const requestBucket = new Date();
    requestBucket.setSeconds(0, 0);

    try {
      await this.prisma.passwordResetToken.create({
        data: { tokenHash, userId: user.id, expiresAt, requestBucket },
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) return { message };
      throw error;
    }

    try {
      await this.emailService.sendPasswordReset(user.email, token, locale);
    } catch {
      // Always preserve the enumeration-safe response when email delivery fails.
    }

    return { message };
  }

  async resetPassword(token: string, newPassword: string) {
    const tokenHash = hashResetToken(token);
    const passwordHash = await bcrypt.hash(newPassword, 10);

    await this.prisma.$transaction(async (tx) => {
      const resetToken = await tx.passwordResetToken.findUnique({
        where: { tokenHash },
        select: { userId: true },
      });
      if (!resetToken) throw new BadRequestException('Token is invalid or has expired');

      const claimed = await tx.passwordResetToken.updateMany({
        where: {
          tokenHash,
          used: false,
          expiresAt: { gt: new Date() },
          user: { isHidden: false },
        },
        data: { used: true },
      });
      if (claimed.count !== 1) throw new BadRequestException('Token is invalid or has expired');

      await tx.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash, authVersion: { increment: 1 } },
      });
    });

    return { message: 'Password updated successfully' };
  }

  signAuthToken(userId: string, role: string, authVersion: number) {
    return this.jwtService.sign({ sub: userId, role, version: authVersion });
  }
}

function hashResetToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function isUniqueConstraintError(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

function forgotPasswordMessage(locale: 'vi' | 'en') {
  return locale === 'vi'
    ? 'Nếu tài khoản phù hợp tồn tại, bạn sẽ nhận được hướng dẫn qua email'
    : 'If an eligible account exists, you will receive instructions via email';
}
