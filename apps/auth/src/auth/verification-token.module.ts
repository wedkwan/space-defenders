import { Module } from '@nestjs/common';
import { VerificationTokenService } from './verification-token.service';

@Module({
  providers: [VerificationTokenService],
  exports: [VerificationTokenService],
})
export class VerificationTokenModule {}