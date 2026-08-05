import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { parseCookies } from '../services/auth-cookie.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: (req) =>
        parseCookies(req?.headers?.cookie)[
          config.get<string>('JWT_COOKIE_NAME') || 'cafe-auth-token'
        ] || ExtractJwt.fromAuthHeaderAsBearerToken()(req),
      secretOrKey: config.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: { sub: string; role: string }) {
    return { id: payload.sub, role: payload.role };
  }
}
