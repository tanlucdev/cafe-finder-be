import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

function withPoolDefaults(url: string) {
  try {
    const parsed = new URL(url);
    if (!parsed.searchParams.has('connection_limit')) {
      parsed.searchParams.set('connection_limit', '5');
    }
    if (!parsed.searchParams.has('pool_timeout')) {
      parsed.searchParams.set('pool_timeout', '5');
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

const queryLoggingEnabled = () => process.env.QUERY_LOGGING === 'true';
const slowQueryMs = () => Number(process.env.SLOW_QUERY_MS || 100);
const elapsedMs = (started: bigint) => Number(process.hrtime.bigint() - started) / 1_000_000;
const poolSettings = (url?: string) => {
  if (!url) {
    return {};
  }

  try {
    const parsed = new URL(withPoolDefaults(url));
    return {
      connectionLimit: parsed.searchParams.get('connection_limit'),
      poolTimeout: parsed.searchParams.get('pool_timeout'),
    };
  } catch {
    return { url: 'unparseable' };
  }
};

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly constructedAt = process.hrtime.bigint();

  constructor() {
    const databaseUrl = process.env.DATABASE_URL;
    const queryLogging = queryLoggingEnabled();
    const started = process.hrtime.bigint();
    super({
      ...(databaseUrl
        ? {
            datasources: {
              db: { url: withPoolDefaults(databaseUrl) },
            },
          }
        : {}),
      ...(queryLogging ? { log: [{ emit: 'event', level: 'query' }] } : {}),
    } as Prisma.PrismaClientOptions);
    console.log(JSON.stringify({ type: 'prisma.init', ms: Math.round(elapsedMs(started)) }));
    console.log(JSON.stringify({ type: 'prisma.pool', ...poolSettings(databaseUrl) }));

    if (queryLogging) {
      (
        this as unknown as { $on(event: 'query', cb: (event: Prisma.QueryEvent) => void): void }
      ).$on('query', (event) => {
        if (event.duration < slowQueryMs()) {
          return;
        }
        console.log(
          JSON.stringify({
            type: 'prisma.query',
            ms: event.duration,
            query: event.query,
          }),
        );
      });
    }
  }

  async onModuleInit() {
    const started = process.hrtime.bigint();
    console.log(
      JSON.stringify({
        type: 'prisma.connect.start',
        sinceInitMs: Math.round(elapsedMs(this.constructedAt)),
      }),
    );
    try {
      await this.$connect();
      console.log(
        JSON.stringify({ type: 'prisma.connect.done', ms: Math.round(elapsedMs(started)) }),
      );
    } catch (error) {
      console.error(
        JSON.stringify({
          type: 'prisma.connect.error',
          ms: Math.round(elapsedMs(started)),
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
