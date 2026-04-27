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
        subject: 'Đặt lại mật khẩu - Cafe Finder',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #333;">Đặt lại mật khẩu</h2>
            <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn.</p>
            <p>Click vào nút bên dưới để đặt lại mật khẩu. Link có hiệu lực trong <strong>1 giờ</strong>.</p>
            <a href="${resetLink}"
               style="display: inline-block; padding: 12px 24px; background-color: #4F46E5;
                      color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">
              Đặt lại mật khẩu
            </a>
            <p style="color: #666; font-size: 14px;">
              Nếu bạn không yêu cầu điều này, hãy bỏ qua email này.
            </p>
            <p style="color: #999; font-size: 12px;">
              Hoặc copy link này vào trình duyệt:<br/>
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
