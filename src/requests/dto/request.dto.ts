import {
  IsString,
  IsEnum,
  IsOptional,
  IsDate,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BloodGroup } from '@prisma/client';

export class CreateBloodRequestDto {
  @ApiProperty({ enum: BloodGroup })
  @IsEnum(BloodGroup)
  bloodGroup: BloodGroup;

  @ApiProperty()
  @IsString()
  urgency: 'routine' | 'urgent' | 'critical';

  @ApiProperty()
  @IsString()
  location: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  hospital?: string;

  @ApiPropertyOptional()
  @IsDate()
  @Type(() => Date)
  @IsOptional()
  neededBy?: Date;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  message?: string;

  @ApiProperty()
  @IsString()
  contactPhone: string;
}

export class UpdateRequestStatusDto {
  @ApiProperty()
  @IsString()
  status: string;
}
