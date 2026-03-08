import {
  IsString,
  IsNumber,
  IsEmail,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsDate,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BloodGroup, Department } from '@prisma/client';

export class CreateProfileDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  fullName: string;

  @ApiProperty({ enum: Department })
  @IsEnum(Department)
  department: Department;

  @ApiProperty()
  @IsString()
  idNumber: string;

  @ApiProperty()
  @IsNumber()
  @Type(() => Number)
  batch: number;

  @ApiProperty()
  @IsString()
  phone: string;

  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  currentLocation: string;

  @ApiProperty()
  @IsString()
  hometown: string;

  @ApiProperty({ enum: BloodGroup })
  @IsEnum(BloodGroup)
  bloodGroup: BloodGroup;

  @ApiPropertyOptional()
  @IsDate()
  @Type(() => Date)
  @IsOptional()
  lastDonationDate?: Date;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  neverDonated?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  willingToDonate?: boolean;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  availabilityNote?: string;
}

export class UpdateProfileDto {
  @ApiPropertyOptional()
  @IsString()
  @MinLength(2)
  @IsOptional()
  fullName?: string;

  @ApiPropertyOptional({ enum: Department })
  @IsEnum(Department)
  @IsOptional()
  department?: Department;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  idNumber?: string;

  @ApiPropertyOptional()
  @IsNumber()
  @Type(() => Number)
  @IsOptional()
  batch?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional()
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  currentLocation?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  hometown?: string;

  @ApiPropertyOptional({ enum: BloodGroup })
  @IsEnum(BloodGroup)
  @IsOptional()
  bloodGroup?: BloodGroup;

  @ApiPropertyOptional()
  @IsDate()
  @Type(() => Date)
  @IsOptional()
  lastDonationDate?: Date;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  neverDonated?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  willingToDonate?: boolean;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  availabilityNote?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  profilePhoto?: string;
}

export class CheckSeedMatchDto {
  @ApiProperty({ enum: Department })
  @IsEnum(Department)
  department: Department;

  @ApiProperty()
  @IsString()
  idNumber: string;
}

export class EligibilityResponseDto {
  @ApiProperty()
  status: string;

  @ApiProperty()
  label: string;

  @ApiProperty()
  eligible: boolean;

  @ApiPropertyOptional()
  daysRemaining?: number;
}
