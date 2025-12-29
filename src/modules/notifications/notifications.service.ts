import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as admin from 'firebase-admin';
import { User } from 'src/entities/user.entity';
import { Repository } from 'typeorm';

@Injectable()
export class NotificationsService {

    constructor(@InjectRepository(User) private userRepo: Repository<User>) {
        const serviceAccount: admin.ServiceAccount = {
            projectId: process.env.PROJECT_ID,
            privateKey: process.env.PRIVATE_KEY?.replace(/\\n/g, '\n'),
            clientEmail: process.env.CLIENT_EMAIL,
        }


        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
            });
            console.log('Firebase Admin initialized');
        }
    }

    async sendNotification(userName: string, title: string, body: string) {
        const user = await this.userRepo.findOne({ where: { email: userName } });
        if (!user) throw new Error(`Invalid user`);

        const message = {
            notification: { title, body },
            token: user.token,
        };

        try {
            const response = await admin.messaging().send(message);
            console.log(`Notification sent successfully: ${response}`);
            return response;
        } catch (error) {
            console.error('Error sending notification', error);
        }
    }

    async saveToken(userName: string, accessToken: string) {

        try {
            const user = await this.userRepo.findOne({ where: { email: userName } });
            if (!user) throw new Error(`Invalid user`);
            user.token = accessToken;
            return await user.save();
        } catch (error) {
            console.error('Error saving token', error);
        }
    }

}
