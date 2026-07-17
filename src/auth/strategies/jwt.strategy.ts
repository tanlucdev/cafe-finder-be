import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { parseCookies } from '../services/auth-cookie.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private prisma: PrismaService,
    config: ConfigService,
  ) {
    super({
      jwtFromRequest: (req) =>
        parseCookies(req?.headers?.cookie)[
          config.get<string>('JWT_COOKIE_NAME') || 'cafe-auth-token'
        ] || ExtractJwt.fromAuthHeaderAsBearerToken()(req),
      secretOrKey: config.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: { sub: string; role: string }) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub, isHidden: false },
      select: { id: true, email: true, role: true },
    });

    if (!user) throw new UnauthorizedException();
    return user;
  }
}
