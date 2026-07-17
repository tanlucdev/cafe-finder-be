import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../auth.service';
import { mapAuthUser } from '../auth-user.mapper';

@Injectable()
export class GoogleOAuthService {
  private client: OAuth2Client;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    private authService: AuthService,
  ) {
    this.client = new OAuth2Client(
      config.get<string>('GOOGLE_CLIENT_ID'),
      config.get<string>('GOOGLE_CLIENT_SECRET'),
      config.get<string>('GOOGLE_OAUTH_REDIRECT_URI'),
    );
  }

  getAuthorizationUrl(returnUrl: string) {
    const state = randomBytes(24).toString('base64url');
    return {
      state,
      authorizationUrl: this.client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'select_account',
        scope: ['openid', 'email', 'profile'],
        state,
      }),
      returnUrl,
    };
  }

  async finish(code: string) {
    const { tokens } = await this.client.getToken(code);
    if (!tokens.id_token) throw new BadRequestException('Missing Google ID token');

    const ticket = await this.client.verifyIdToken({
      idToken: tokens.id_token,
      audience: this.config.get<string>('GOOGLE_CLIENT_ID'),
    });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email || !payload.email_verified) {
      throw new UnauthorizedException('Google email is not verified');
    }

    const user = await this.upsertGoogleUser({
      googleSub: payload.sub,
      email: payload.email,
      displayName: payload.name ?? null,
      avatarUrl: payload.picture ?? null,
    });
    return { token: this.authService.signAuthToken(user.id, user.role), user: mapAuthUser(user) };
  }

  private async upsertGoogleUser(data: {
    googleSub: string;
    email: string;
    displayName: string | null;
    avatarUrl: string | null;
  }) {
    const bySub = await this.prisma.user.findUnique({ where: { googleSub: data.googleSub } });
    const user = bySub ?? (await this.prisma.user.findUnique({ where: { email: data.email } }));
    if (user?.isHidden) throw new UnauthorizedException('User is disabled');

    if (user) {
      return this.prisma.user.update({
        where: { id: user.id },
        data: {
          googleSub: user.googleSub ?? data.googleSub,
          displayName: user.displayName ?? data.displayName,
          avatarUrl: user.avatarUrl ?? data.avatarUrl,
        },
      });
    }

    return this.prisma.user.create({
      data: {
        email: data.email,
        passwordHash: null,
        googleSub: data.googleSub,
        displayName: data.displayName,
        avatarUrl: data.avatarUrl,
        role: 'USER',
      },
    });
  }
}
