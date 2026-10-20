import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Validates DTO-typed request bodies; handlers with plain object types are unaffected.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));

  //enable CORS
  app.enableCors({ origin: true, credentials: true });
  await app.listen(process.env.PORT || 8001);
}
bootstrap();
