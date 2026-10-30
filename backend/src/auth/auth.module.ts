import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailerModule } from '@nestjs-modules/mailer';
import { PassportModule } from '@nestjs/passport';
import { readFileSync } from 'node:fs';

import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { UsersModule } from '../users/users.module';

function readRequiredSecret(config: ConfigService, key: string): string {
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

@Module({
  imports: [
    ConfigModule,
    UsersModule,
    PassportModule,

    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: readRequiredSecret(config, 'JWT_SECRET_FILE'),
        signOptions: {
          expiresIn: config.get<string>('JWT_EXPIRES_IN', '7d') as any,
        },
      }),
    }),

    MailerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        transport: {
          host: config.get<string>('SMTP_HOST', 'smtp-relay.brevo.com'),
          port: config.get<number>('SMTP_PORT', 587),
          secure: false,
          auth: {
            user: config.getOrThrow<string>('SMTP_USER'),
            pass: readRequiredSecret(config, 'SMTP_PASSWORD_FILE'),
          },
        },
        defaults: {
          from: config.getOrThrow<string>('SMTP_FROM'),
        },
      }),
    }),
  ],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
})
export class AuthModule {}
