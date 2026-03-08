import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(private configService: ConfigService) {
    super({
      datasources: {
        db: {
          url: configService.get<string>('DATABASE_URL'),
        },
      },
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'info' },
        { emit: 'stdout', level: 'warn' },
        { emit: 'stdout', level: 'error' },
      ],
    });
  }

  async onModuleInit() {
    await this.$connect();
    console.log('Connected to database');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    console.log('Disconnected from database');
  }

  async cleanDatabase() {
    if (this.configService.get('NODE_ENV') === 'test') {
      const models = Reflect.ownKeys(this).filter(
        (key) => typeof key === 'string' && !key.startsWith('_') && !key.startsWith('$'),
      );

      return Promise.all(
        models.map((modelKey) => this[modelKey as string].deleteMany()),
      );
    }
  }
}
