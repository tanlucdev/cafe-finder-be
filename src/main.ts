import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import compression = require('compression');

type ListenError = NodeJS.ErrnoException & { port?: number | string };

const normalizeOrigin = (origin?: string) => origin?.replace(/\/$/, '');
const getHostname = (origin: string) => {
  try {
    return new URL(origin).hostname;
  } catch {
    return origin;
  }
};

const isLocalOrigin = (origin: string) => {
  try {
    const { hostname, protocol } = new URL(origin);
    return (
      ['http:', 'https:'].includes(protocol) &&
      (['localhost', '127.0.0.1', '::1'].includes(hostname) ||
        /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(hostname))
    );
  } catch {
    return false;
  }
};

const getPort = () => {
  const port = Number(process.env.PORT || 3005);

  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid PORT: ${process.env.PORT}`);
  }

  return port;
};

const requestTiming = (req: Request, res: Response, next: NextFunction) => {
  const started = process.hrtime.bigint();
  const requestId = (req.header('x-request-id') || randomUUID()).toString();

  res.setHeader('x-request-id', requestId);
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - started) / 1_000_000;
    console.log(
      JSON.stringify({
        type: 'request',
        requestId,
        method: req.method,
        path: req.originalUrl || req.url,
        status: res.statusCode,
        ms: Math.round(ms),
      }),
    );
  });
  next();
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(requestTiming);
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
        isLocalOrigin(requestOrigin) ||
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

  const port = getPort();
  const host = process.env.HOST || '0.0.0.0';

  await app.listen(port, host);
  console.log(`🚀 Server: http://localhost:${port}/api`);
  console.log(`📖 Swagger: http://localhost:${port}/docs`);
}
bootstrap().catch((error: ListenError) => {
  if (error.code === 'EADDRINUSE') {
    const port = error.port || process.env.PORT || 3005;
    console.error(`Port ${port} is already in use.`);
    console.error(`Find the process: lsof -nP -iTCP:${port} -sTCP:LISTEN`);
    console.error(`Stop it or start this app with another port: PORT=3002 yarn start:dev`);
    process.exit(1);
  }

  console.error(error);
  process.exit(1);
});
