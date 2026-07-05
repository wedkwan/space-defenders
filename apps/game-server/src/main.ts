import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const port = parseInt(process.env.GAME_SERVER_PORT ?? '4000', 10);
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  await app.listen(port);
  console.log(`Game Server rodando em: http://localhost:${port}`);
}
bootstrap();
