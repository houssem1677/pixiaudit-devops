import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { MailerService } from '@nestjs-modules/mailer';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { UsersService } from '../users/users.service';
import { LoginDto, ForgotPasswordDto, ResetPasswordDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly mailerService: MailerService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) throw new UnauthorizedException('Identifiants invalides');

    const passwordMatch = await bcrypt.compare(dto.password, user.password);
    if (!passwordMatch)
      throw new UnauthorizedException('Identifiants invalides');

    // ✅ Create token payload
    const tokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    console.log('🔐 [AUTH] Creating token with payload:', tokenPayload);

    const token = this.jwtService.sign(tokenPayload);

    console.log('🔐 [AUTH] Token created successfully');

    return {
      access_token: token,
      user: {
        id: user.id,
        email: user.email,
        nom: user.nom,
        prenom: user.prenom,
        role: user.role,
      },
    };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) return { message: 'Email envoyé si le compte existe.' };

    // Générer le token et sauvegarder
    user.passwordResetToken = crypto.randomBytes(32).toString('hex');
    user.passwordResetExpires = new Date(Date.now() + 3600000);
    await this.usersService.save(user);

    const resetUrl = `${this.config.get<string>('FRONTEND_URL', 'http://localhost:3000')}/reset-password?token=${user.passwordResetToken}`;

    // Email HTML responsive (mobile + web)
    await this.mailerService.sendMail({
      to: user.email,
      subject: 'Réinitialisation de votre mot de passe - PixiAudit',
      html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Réinitialisation mot de passe</title>
        <style>
          @media only screen and (max-width: 600px) {
            .container { width: 100% !important; padding: 10px !important; }
            .button { width: 100% !important; display: block !important; text-align: center !important; }
            .content { padding: 20px 10px !important; }
          }
        </style>
      </head>
      <body style="margin:0; padding:0; background-color:#f4f4f7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
          
          <!-- En-tête -->
          <div style="background-color: #8DC63F; padding: 30px 20px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">PixiAudit</h1>
            <p style="color: #ffffff; margin: 8px 0 0; font-size: 16px;">Audit & Optimisation Web</p>
          </div>

          <!-- Corps -->
          <div class="content" style="padding: 40px 30px; color: #333333; line-height: 1.5;">
            <h2 style="font-size: 24px; margin-top: 0; color: #2c3e50;">Bonjour ${user.prenom ?? 'cher utilisateur'},</h2>
            <p style="font-size: 16px; margin-bottom: 24px;">
              Vous avez demandé à réinitialiser votre mot de passe pour votre compte PixiAudit. Cliquez sur le bouton ci-dessous pour créer un nouveau mot de passe.
            </p>
            
            <!-- Bouton responsive -->
            <div style="text-align: center; margin: 32px 0;">
              <a href="${resetUrl}" class="button" style="background-color: #8DC63F; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 50px; font-size: 16px; font-weight: 600; display: inline-block; box-shadow: 0 2px 6px rgba(0,0,0,0.1);">
                🔐 Réinitialiser mon mot de passe
              </a>
            </div>

            <p style="font-size: 14px; color: #6c757d; margin-bottom: 16px;">
              Ce lien expire dans <strong>1 heure</strong> (à ${user.passwordResetExpires.toLocaleTimeString()}).
            </p>

            <p style="font-size: 14px; color: #6c757d; margin-top: 24px;">
              Si vous n'avez pas demandé cette réinitialisation, ignorez cet email. Votre mot de passe restera inchangé.
            </p>

            <hr style="border: none; border-top: 1px solid #e9ecef; margin: 28px 0 16px;">
            <p style="font-size: 12px; color: #adb5bd; text-align: center;">
              © ${new Date().getFullYear()} PixiAudit – Sécurisez votre présence web
            </p>
          </div>
        </div>
      </body>
      </html>
    `,
    });

    return { message: 'Email envoyé si le compte existe.' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.usersService.findByResetToken(dto.token);
    if (!user) throw new BadRequestException('Token invalide ou expiré');

    if (!user.passwordResetExpires || user.passwordResetExpires < new Date())
      throw new BadRequestException('Token expiré');

    user.password = await bcrypt.hash(dto.password, 10);
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    await this.usersService.save(user);

    return { message: 'Mot de passe réinitialisé avec succès.' };
  }
}
