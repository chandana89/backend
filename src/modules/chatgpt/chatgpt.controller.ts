import { Controller, Post, Body, HttpCode, HttpStatus, Req, Get } from '@nestjs/common';
import { ChatGPTService } from './chatgpt.service';

@Controller('chatgpt')
export class ChatGPTController {
  constructor(private chatGPTService: ChatGPTService) {}

    @Get()
    public async handleAddIndustry() {

        try {
            const response = await this.chatGPTService.generateResponse('extract beneficial owners');
            return response;
        } catch (e) {
            console.log(`Error: ${e.message}`);
        }
    }
}