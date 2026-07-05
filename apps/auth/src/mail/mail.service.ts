import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly from: string;
  private readonly frontendUrl: string;

  constructor(@Optional() @Inject(Resend) private readonly resend: Resend | null) {
    this.from = process.env.MAIL_FROM ?? 'onboarding@resend.dev';
    this.frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
  }

  async sendVerificationEmail(email: string, token: string): Promise<void> {
    if (!this.resend) {
      this.logger.warn('RESEND_API_KEY não configurado. E-mail de verificação não enviado.');
      return;
    }

    const verificationUrl = `${this.frontendUrl}/verify-email?token=${token}`;

    try {
      await this.resend.emails.send({
        from: this.from,
        to: email,
        subject: 'Confirme seu e-mail - Space Defenders',
        html: this.buildVerificationTemplate(verificationUrl),
      });
    } catch (error) {
      this.logger.error(`Falha ao enviar e-mail de verificação para ${email}`, error);
      throw error;
    }
  }

  private buildVerificationTemplate(verificationUrl: string): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #1a1a1a;">Confirme seu e-mail</h2>
        <p style="color: #444; font-size: 15px; line-height: 1.5;">
          Obrigado por se cadastrar no Space Defenders. Clique no botão abaixo para confirmar seu e-mail.
        </p>
        <a href="${verificationUrl}"
           style="display: inline-block; margin-top: 16px; padding: 12px 24px; background-color: #4f46e5; color: #fff; text-decoration: none; border-radius: 6px; font-weight: bold;">
          Confirmar e-mail
        </a>
        <p style="color: #999; font-size: 13px; margin-top: 24px;">
          Este link expira em 24 horas. Se você não criou uma conta, ignore este e-mail.
        </p>
      </div>
    `;
  }
}
