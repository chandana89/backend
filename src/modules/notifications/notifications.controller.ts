import { Body, Controller, Post } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
    constructor(private readonly notiySvc: NotificationsService) { }
    @Post()
    async send(@Body() body: { token: string; title: string; message: string }) {
        return this.notiySvc.sendNotification(body.token, body.title, body.message);
    }
}
