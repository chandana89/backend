import { Injectable } from '@nestjs/common';
import * as admin from 'firebase-admin';

@Injectable()
export class NotificationsService {

    constructor() {
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

    async sendNotification(token: string, title: string, body: string) {
        const message = {
            notification: { title, body },
            token,
        };

        try {
            const response = await admin.messaging().send(message);
            console.log(`Notification sent successfully: ${response}`);
            return response;
        } catch (error) {
            console.error('Error sending notification', error);
        }
    }

}
