import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { CafesModule } from './cafes/cafes.module';
import { AuthModule } from './auth/auth.module';
import { SavedModule } from './saved/saved.module';
import { SubmissionsModule } from './submissions/submissions.module';
import { AdminModule } from './admin/admin.module';
import { StorageModule } from './storage/storage.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    CafesModule,
    AuthModule,
    SavedModule,
    SubmissionsModule,
    AdminModule,
    StorageModule,
  ],
})
export class AppModule {}
