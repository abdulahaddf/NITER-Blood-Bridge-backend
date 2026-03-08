import { IsString, IsDate, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDonationDto {
  @ApiProperty()
  @IsDate()
  @Type(() => Date)
  donationDate: Date;

  @ApiProperty()
  @IsString()
  location: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}
