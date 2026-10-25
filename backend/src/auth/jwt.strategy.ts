
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'node:fs';

function readRequiredSecret(
  config: ConfigService,
  key: string,
): string {
  const path = config.get<string>(key);

  if (!path) {
    throw new Error(`${key} is required`);
  }

  const secret = readFileSync(path, 'utf8').trim();

  if (!secret) {
    throw new Error(`${key} points to an empty secret`);
  }

  return secret;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: readRequiredSecret(config, 'JWT_SECRET_FILE'),
    });
  }

  async validate(payload: { sub: string; email: string; role: string }) {
    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };
  }
}
