import { Module } from '@nestjs/common';
import { Resend } from 'resend';
import { MailService } from './mail.service';

const resendProvider = {
  provide: Resend,
  useFactory: () => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return null;
    }
    return new Resend(apiKey);
  },
};

@Module({
  providers: [resendProvider, MailService],
  exports: [MailService],
})
export class MailModule {}
