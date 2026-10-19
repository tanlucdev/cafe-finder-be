import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private readonly resend: Resend;
  private readonly logger = new Logger(EmailService.name);
  private readonly fromEmail?: string;

  constructor(private config: ConfigService) {
    const resendApiKey = this.config.get<string>('RESEND_API_KEY');
    this.fromEmail = this.config.get<string>('RESEND_FROM_EMAIL');
    const appUrl = this.config.get<string>('APP_URL');
    if (this.config.get<string>('NODE_ENV') === 'production') {
      for (const [name, value] of Object.entries({
        RESEND_API_KEY: resendApiKey,
        RESEND_FROM_EMAIL: this.fromEmail,
        APP_URL: appUrl,
      })) {
        if (!value?.trim()) throw new Error(`${name} is required in production`);
      }
    }
    this.resend = new Resend(resendApiKey);
  }

  async sendPasswordReset(toEmail: string, token: string, locale: 'vi' | 'en'): Promise<void> {
    const appUrl = this.config.get('APP_URL', 'http://localhost:3000').replace(/\/$/, '');
    const resetLink = `${appUrl}/${locale}/reset-password?token=${encodeURIComponent(token)}`;
    const copy = passwordResetCopy(locale, resetLink);

    try {
      if (!this.fromEmail) throw new Error('RESEND_FROM_EMAIL is not configured');
      const { error } = await this.resend.emails.send({
        from: this.fromEmail,
        to: toEmail,
        subject: copy.subject,
        text: copy.text,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #333;">${copy.heading}</h2>
            <p>${copy.intro}</p>
            <p>${copy.expiry}</p>
            <a href="${resetLink}"
               style="display: inline-block; padding: 12px 24px; background-color: #b87428;
                      color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">
              ${copy.cta}
            </a>
            <p style="color: #666; font-size: 14px;">
              ${copy.ignore}
            </p>
          </div>
        `,
      });
      if (error) throw error;
    } catch (error) {
      this.logger.error(`Failed to send password reset email to ${toEmail}`, error);
      throw error;
    }
  }
}

function passwordResetCopy(locale: 'vi' | 'en', resetLink: string) {
  const vietnamese = locale === 'vi';
  const subject = vietnamese ? 'Đặt lại mật khẩu - Cafe Maps' : 'Reset password - Cafe Maps';
  const heading = vietnamese ? 'Đặt lại mật khẩu' : 'Reset password';
  const intro = vietnamese
    ? 'Bọn mình nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.'
    : 'We received a request to reset the password for your account.';
  const expiry = vietnamese
    ? 'Link có hiệu lực trong 60 phút.'
    : 'This link is valid for 60 minutes.';
  const cta = vietnamese ? 'Đặt lại mật khẩu' : 'Reset password';
  const ignore = vietnamese
    ? 'Nếu bạn không yêu cầu việc này, hãy bỏ qua email này.'
    : 'If you did not request this, please ignore this email.';
  return {
    subject,
    heading,
    intro,
    expiry,
    cta,
    ignore,
    text: `${heading}\n\n${intro}\n${expiry}\n\n${cta}: ${resetLink}\n\n${ignore}`,
  };
}
