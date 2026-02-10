import { Module } from '@nestjs/common';
import { PipelineController } from './pipeline.controller';
import { RelayModule } from '../relay/relay.module';

@Module({
  imports: [RelayModule],
  controllers: [PipelineController],
})
export class PipelineModule {}
