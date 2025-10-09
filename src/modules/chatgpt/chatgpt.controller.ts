import { Controller, Post, Body, HttpCode, HttpStatus, Req, Get, UseInterceptors, UploadedFile } from '@nestjs/common';
import { ChatGPTService } from './chatgpt.service';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('chatgpt')
export class ChatGPTController {
  constructor(private chatGPTService: ChatGPTService) {}

    @Get()
    public async generateResponse() {

        try {
            const response = await this.chatGPTService.GenerateResponse('extract beneficial owners');
            return response;
        } catch (e) {
            console.log(`Error: ${e.message}`);
        }
    }

    @Post()
    @UseInterceptors(FileInterceptor('asic'))
    public async uploadFile(@Req() req: Request, @Body() body: {asic?: any},@UploadedFile() asic: any,) {

        try {
            const response = await this.chatGPTService.UploadFile(asic);
            return response;
        } catch (e) {
            console.log(`Error: ${e.message}`);
        }
    }

    @Post('url')
    public async ExtractBOs(@Req() req: Request, @Body() body: {fileURL: string}) {

        try {
            const response = await this.chatGPTService.ExtractBeneficialOwnerUsingURL(body.fileURL);
            return response;
        } catch (e) {
            console.log(`Error: ${e.message}`);
        }
    }
}