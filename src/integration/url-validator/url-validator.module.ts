import { Module } from '@nestjs/common';
import { UrlValidatorService } from './url-validator.service';

@Module({
  providers: [UrlValidatorService],
  exports: [UrlValidatorService],
})
export class UrlValidatorModule {}
