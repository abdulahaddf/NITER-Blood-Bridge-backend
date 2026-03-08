import {
  IsString,
  IsOptional,
  IsArray,
  IsEnum,
  IsBoolean,
  IsNumber,
  IsInt,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { BloodGroup, Department } from '@prisma/client';

export class SearchDonorsDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ enum: BloodGroup, isArray: true })
  @IsArray()
  @IsEnum(BloodGroup, { each: true })
  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  bloodGroups?: BloodGroup[];

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  compatibilityMode?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  eligibilityOnly?: boolean;

  @ApiPropertyOptional({ enum: Department, isArray: true })
  @IsArray()
  @IsEnum(Department, { each: true })
  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  departments?: Department[];

  @ApiPropertyOptional()
  @IsInt()
  @Type(() => Number)
  @IsOptional()
  batchMin?: number;

  @ApiPropertyOptional()
  @IsInt()
  @Type(() => Number)
  @IsOptional()
  batchMax?: number;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  onCampusOnly?: boolean;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  willingToDonate?: boolean;

  @ApiPropertyOptional({ default: 'eligible' })
  @IsString()
  @IsOptional()
  sortBy?: 'eligible' | 'donations' | 'recent' | 'batch';

  @ApiPropertyOptional({ default: 1 })
  @IsInt()
  @Type(() => Number)
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsInt()
  @Type(() => Number)
  @IsOptional()
  limit?: number;
}
