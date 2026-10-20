import { Module } from '@nestjs/common';
import { StartbuttonService } from './startbutton.service';

@Module({
  providers: [StartbuttonService],
  exports: [StartbuttonService],
})
export class StartbuttonModule {}
