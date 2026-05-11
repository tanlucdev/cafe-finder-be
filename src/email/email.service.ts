import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private readonly resend: Resend;
  private readonly logger = new Logger(EmailService.name);
  private readonly fromEmail: string;

  constructor(private config: ConfigService) {
    this.resend = new Resend(this.config.get('RESEND_API_KEY'));
    this.fromEmail = this.config.get('RESEND_FROM_EMAIL', 'noreply@cafefinder.vn');
  }

  async sendPasswordReset(toEmail: string, token: string): Promise<void> {
    const appUrl = this.config.get('APP_URL', 'http://localhost:3000');
    const resetLink = `${appUrl}/reset-password?token=${token}`;

    try {
      await this.resend.emails.send({
        from: this.fromEmail,
        to: toEmail,
        subject: 'Reset Password - Cafe Finder',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #333;">Reset Password</h2>
            <p>We received a request to reset the password for your account.</p>
            <p>Click the button below to reset your password. The link is valid for <strong>1 hour</strong>.</p>
            <a href="${resetLink}"
               style="display: inline-block; padding: 12px 24px; background-color: #4F46E5;
                      color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">
              Reset Password
            </a>
            <p style="color: #666; font-size: 14px;">
              If you did not request this, please ignore this email.
            </p>
            <p style="color: #999; font-size: 12px;">
              Or copy this link into your browser:<br/>
              <a href="${resetLink}" style="color: #4F46E5;">${resetLink}</a>
            </p>
          </div>
        `,
      });
    } catch (error) {
      this.logger.error(`Failed to send password reset email to ${toEmail}`, error);
      throw error;
    }
  }
}
