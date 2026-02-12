import { Module } from '@nestjs/common';
import { PipelineController } from './pipeline.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PipelineController],
})
export class PipelineModule {}
