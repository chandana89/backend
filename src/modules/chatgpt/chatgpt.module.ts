import { Module} from '@nestjs/common';
import { ChatGPTService } from './chatgpt.service';
import { ChatGPTController } from './chatgpt.controller';

@Module({
  imports: [],
  providers: [ChatGPTService],
  controllers: [ChatGPTController],
  exports: [ChatGPTService],
})
export class ChatGPTModule {}