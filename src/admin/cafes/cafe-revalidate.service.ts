import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CafeRevalidateService {
  constructor(private config: ConfigService) {}

  async trigger(slug?: string | null) {
    const url = this.config.get<string>('FRONTEND_REVALIDATE_URL');
    const secret = this.config.get<string>('REVALIDATE_SECRET');
    if (!url || !secret) {
      console.warn(
        'Cafe revalidate webhook skipped: missing FRONTEND_REVALIDATE_URL or REVALIDATE_SECRET',
      );
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

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
      if (!response.ok) throw new Error(`Revalidate failed: ${response.status}`);
      console.log(
        JSON.stringify({
          type: 'cafe.revalidate.done',
          status: response.status,
          slug: slug ?? null,
        }),
      );
    } catch (error) {
      console.error('Cafe revalidate webhook failed:', error);
    } finally {
      clearTimeout(timeout);
    }
  }
}
