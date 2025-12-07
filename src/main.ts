import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  //enable CORS
  app.enableCors({ origin: true, credentials: true });
  await app.listen(process.env.PORT || 8001);
}
bootstrap();
