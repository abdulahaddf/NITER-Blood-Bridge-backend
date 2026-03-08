import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ProfilesService } from './profiles.service';
import { CreateProfileDto, UpdateProfileDto, CheckSeedMatchDto } from './dto/profile.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('profiles')
@ApiBearerAuth()
@Controller('profiles')
export class ProfilesController {
  constructor(private profilesService: ProfilesService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  async getMyProfile(@CurrentUser('id') userId: string) {
    return this.profilesService.findByUserId(userId);
  }

  @Get('me/completion')
  @ApiOperation({ summary: 'Get profile completion status' })
  async getCompletionStatus(@CurrentUser('id') userId: string) {
    return this.profilesService.getCompletionStatus(userId);
  }

  @Post()
  @ApiOperation({ summary: 'Create profile' })
  async create(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateProfileDto,
  ) {
    return this.profilesService.create(userId, dto);
  }

  @Put('me')
  @ApiOperation({ summary: 'Update profile' })
  async update(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.profilesService.update(userId, dto);
  }

  @Get('check-seed')
  @ApiOperation({ summary: 'Check if student ID matches seed data' })
  async checkSeedMatch(@Query() query: CheckSeedMatchDto) {
    return this.profilesService.checkSeedMatch(query.department, query.idNumber);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get profile by ID' })
  async findById(@Param('id') id: string) {
    return this.profilesService.findById(id);
  }
}
