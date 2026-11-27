import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { InMemoryPrismaMock } from './in-memory-prisma.mock';

export interface AuthSessionHandle {
  cookies: string[];
  token?: string;
  user?: Record<string, unknown>;
}

export async function createE2eTestApp(): Promise<{
  app: INestApplication;
  prismaMock: InMemoryPrismaMock;
}> {
  process.env.JWT_ACCESS_SECRET ||=
    'test-access-secret-vintage-aesthetics-256-bit-minimum';
  process.env.JWT_REFRESH_SECRET ||=
    'test-refresh-secret-vintage-aesthetics-256-bit-minimum';
  process.env.DATA_ENCRYPTION_KEY ||=
    '0000000000000000000000000000000000000000000000000000000000000000';
  process.env.QR_HMAC_SECRET ||=
    'test-qr-hmac-secret-vintage-aesthetics-256-bit-minimum';
  process.env.AI_PROVIDER = 'mock';

  const prismaMock = new InMemoryPrismaMock();

  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(PrismaService)
    .useValue(prismaMock)
    .compile();

  const app = moduleFixture.createNestApplication();
  app.use(cookieParser());
  app.setGlobalPrefix('api', { exclude: ['health'] });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();

  return { app, prismaMock };
}

export async function loginAs(
  app: INestApplication,
  identifier: string,
  password = 'Vintage@2026',
): Promise<AuthSessionHandle> {
  const res = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ identifier, password });

  if (res.status < 200 || res.status >= 300) {
    throw new Error(
      `Login failed for ${identifier} with status ${res.status}: ${JSON.stringify(res.body)}`,
    );
  }

  const rawCookies = res.headers['set-cookie'];
  const cookies = Array.isArray(rawCookies)
    ? rawCookies
    : typeof rawCookies === 'string'
      ? [rawCookies]
      : [];

  return {
    cookies,
    token: (res.body as { accessToken?: string })?.accessToken,
    user: (res.body as { user?: Record<string, unknown> })?.user,
  };
}

export function withAuth(
  req: request.Test,
  auth: AuthSessionHandle,
): request.Test {
  if (auth.cookies.length > 0) {
    req.set('Cookie', auth.cookies);
  }
  if (auth.token) {
    req.set('Authorization', `Bearer ${auth.token}`);
  }
  return req;
}
