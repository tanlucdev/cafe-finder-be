import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import compression from 'compression';

const normalizeOrigin = (origin?: string) => origin?.replace(/\/$/, '');
const getHostname = (origin: string) => {
  try {
    return new URL(origin).hostname;
  } catch {
    return origin;
  }
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(compression());
  app.setGlobalPrefix('api');

  app.enableCors({
    origin: (origin, callback) => {
      const allowed = [
        normalizeOrigin(process.env.FRONTEND_URL),
        normalizeOrigin(process.env.CMS_URL),
        'http://localhost:3000',
        'http://localhost:5173',
        'http://localhost:4173',
      ].filter(Boolean);

      const requestOrigin = normalizeOrigin(origin);
      const requestHostname = requestOrigin ? getHostname(requestOrigin) : '';

      if (
        !requestOrigin ||
        allowed.includes(requestOrigin) ||
        /\.vercel\.app$/.test(requestOrigin) ||
        requestHostname === 'cafemaps.net' ||
        requestHostname.endsWith('.cafemaps.net')
      ) {
        callback(null, true);
      } else {
        callback(new Error(`CORS blocked: ${requestOrigin}`));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new GlobalExceptionFilter());

  const config = new DocumentBuilder()
    .setTitle('Cafe Finder HCMC API')
    .setDescription('REST API for the HCMC cafe finder website')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`🚀 Server: http://localhost:${port}/api`);
  console.log(`📖 Swagger: http://localhost:${port}/docs`);
}
bootstrap();
