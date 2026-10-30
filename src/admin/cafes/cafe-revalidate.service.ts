import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { setTimeout as delay } from 'node:timers/promises';

@Injectable()
export class CafeRevalidateService {
  constructor(private config: ConfigService) {}

  async trigger(slug?: string | null) {
    const url = this.config.get<string>('FRONTEND_REVALIDATE_URL');
    const secret = this.config.get<string>('REVALIDATE_SECRET');
    if (!url || !secret) {
      console.warn(
        JSON.stringify({
          type: 'cafe.revalidate.skipped',
          slug: slug ?? null,
          status: null,
          attempt: 0,
          reason: 'missing_configuration',
        }),
      );
      return;
    }

    for (let attempt = 1; attempt <= 2; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      let status: number | null = null;
      let retryable = false;
      let revalidated = false;
      try {
        const response = await fetch(url, {
          method: 'POST',
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${secret}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ reason: 'cafe_changed', ...(slug ? { slug } : {}) }),
        });
        status = response.status;
        retryable = status === 429 || (status >= 500 && status <= 599);
        if (response.ok) {
          const body: unknown = await response.json();
          revalidated =
            body !== null &&
            typeof body === 'object' &&
            'revalidated' in body &&
            body.revalidated === true;
        } else {
          await response.body?.cancel();
        }
      } catch {
        retryable ||=
          status === null || (status >= 200 && status < 300 && controller.signal.aborted);
      } finally {
        clearTimeout(timeout);
      }
      const result = JSON.stringify({
        type: revalidated ? 'cafe.revalidate.done' : 'cafe.revalidate.failed',
        slug: slug ?? null,
        status,
        attempt,
      });
      if (revalidated) console.log(result);
      else console.error(result);
      if (revalidated || !retryable || attempt === 2) return;
      await delay(500);
    }
  }
}
