import { Body, Controller, Post } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
    constructor(private readonly notiySvc: NotificationsService) { }
    @Post()
    async send(@Body() body: {userName: string, title: string; message: string }) {
        return this.notiySvc.sendNotification(body.userName, body.title, body.message);
    }

    @Post('token')
    async saveToken(@Body() body: { userName: string, token: string }) {
        return this.notiySvc.saveToken(body.userName, body.token);
    }
}
