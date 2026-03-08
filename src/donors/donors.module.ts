import { Module } from '@nestjs/common';
import { DonorsService } from './donors.service';
import { DonorsController } from './donors.controller';

@Module({
  providers: [DonorsService],
  controllers: [DonorsController],
  exports: [DonorsService],
})
export class DonorsModule {}
