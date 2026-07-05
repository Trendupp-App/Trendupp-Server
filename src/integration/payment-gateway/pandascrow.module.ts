import { Module } from '@nestjs/common';
import { PandascrowService } from './pandascrow.service';

@Module({
  providers: [PandascrowService],
  exports: [PandascrowService],
})
export class PandascrowModule {}
