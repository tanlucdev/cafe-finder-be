import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { parseCookies } from '../services/auth-cookie.service';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: (req) =>
        parseCookies(req?.headers?.cookie)[
          config.get<string>('JWT_COOKIE_NAME') || 'cafe-auth-token'
        ] || ExtractJwt.fromAuthHeaderAsBearerToken()(req),
      secretOrKey: config.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: { sub: string; role: string; version?: number }) {
    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, authVersion: payload.version ?? 0, isHidden: false },
      select: { id: true, role: true },
    });
    return user ? { id: user.id, role: user.role } : null;
  }
}
