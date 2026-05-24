import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface RouteDistanceDestination {
  id: string;
  lat: number;
  lng: number;
}

export interface RouteDistanceResult {
  id: string;
  distanceKm: number;
  durationMin: number;
}

interface OsrmTableResponse {
  code?: string;
  message?: string;
  distances?: Array<Array<number | null>>;
  durations?: Array<Array<number | null>>;
}

interface RouteDistanceCacheEntry {
  expiresAt: number;
  value: RouteDistanceResult[];
}

@Injectable()
export class RouteDistanceService {
  private readonly logger = new Logger(RouteDistanceService.name);
  private readonly cache = new Map<string, RouteDistanceCacheEntry>();
  private lastRequestAt = 0;

  constructor(private readonly config: ConfigService) {}

  private get baseUrl() {
    return this.config.get<string>('OSRM_BASE_URL', '').replace(/\/$/, '');
  }

  private get profile() {
    return this.config.get<string>('OSRM_PROFILE', 'driving');
  }

  private get timeoutMs() {
    const raw = Number(this.config.get<string>('OSRM_TIMEOUT_MS', '2500'));
    return Number.isFinite(raw) && raw > 0 ? raw : 2500;
  }

  private get maxDestinations() {
    const raw = Number(this.config.get<string>('OSRM_MAX_DESTINATIONS', '20'));
    return Number.isFinite(raw) && raw > 0 ? raw : 20;
  }

  private get minIntervalMs() {
    const configured = this.config.get<string>('OSRM_MIN_INTERVAL_MS');
    const raw = configured == null ? (this.isPublicDemoServer ? 1000 : 0) : Number(configured);
    return Number.isFinite(raw) && raw > 0 ? raw : 0;
  }

  private get cacheTtlMs() {
    const raw = Number(this.config.get<string>('OSRM_CACHE_TTL_MS', '300000'));
    return Number.isFinite(raw) && raw > 0 ? raw : 300000;
  }

  private get maxCacheEntries() {
    const raw = Number(this.config.get<string>('OSRM_CACHE_MAX_ENTRIES', '500'));
    return Number.isFinite(raw) && raw > 0 ? raw : 500;
  }

  private get isPublicDemoServer() {
    return this.baseUrl.includes('router.project-osrm.org');
  }

  isConfigured() {
    return Boolean(this.baseUrl);
  }

  private routeCacheKey(
    origin: { lat: number; lng: number },
    destinations: RouteDistanceDestination[],
  ) {
    const roundedOrigin = `${origin.lat.toFixed(3)},${origin.lng.toFixed(3)}`;
    const destinationKey = destinations.map((destination) => destination.id).join(',');
    return `${this.profile}:${roundedOrigin}:${destinationKey}`;
  }

  private getCached(cacheKey: string) {
    const cached = this.cache.get(cacheKey);
    if (!cached) return null;

    if (cached.expiresAt <= Date.now()) {
      this.cache.delete(cacheKey);
      return null;
    }

    return cached.value;
  }

  private setCached(cacheKey: string, value: RouteDistanceResult[]) {
    this.cache.set(cacheKey, {
      expiresAt: Date.now() + this.cacheTtlMs,
      value,
    });

    while (this.cache.size > this.maxCacheEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (!oldestKey) break;
      this.cache.delete(oldestKey);
    }
  }

  private reserveRequestSlot() {
    const minIntervalMs = this.minIntervalMs;
    if (minIntervalMs <= 0) return true;

    const now = Date.now();
    if (now - this.lastRequestAt < minIntervalMs) return false;

    this.lastRequestAt = now;
    return true;
  }

  async getDrivingDistances(
    origin: { lat: number; lng: number },
    destinations: RouteDistanceDestination[],
  ): Promise<RouteDistanceResult[] | null> {
    if (!this.isConfigured() || destinations.length === 0) return null;

    const limited = destinations.slice(0, this.maxDestinations);
    const cacheKey = this.routeCacheKey(origin, limited);
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    if (!this.reserveRequestSlot()) {
      this.logger.warn('OSRM request skipped by rate limit; falling back to straight distance');
      return null;
    }

    const coordinates = [
      `${origin.lng},${origin.lat}`,
      ...limited.map((destination) => `${destination.lng},${destination.lat}`),
    ].join(';');
    const destinationIndexes = limited.map((_, index) => String(index + 1)).join(';');
    const url =
      `${this.baseUrl}/table/v1/${this.profile}/${coordinates}` +
      `?sources=0&destinations=${destinationIndexes}&annotations=distance,duration`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        this.logger.warn(`OSRM returned ${response.status}`);
        return null;
      }

      const data = (await response.json()) as OsrmTableResponse;
      if (data.code !== 'Ok' || !data.distances?.[0] || !data.durations?.[0]) {
        this.logger.warn(`OSRM table failed: ${data.message ?? data.code ?? 'unknown error'}`);
        return null;
      }

      const routes = limited.flatMap((destination, index) => {
        const distanceMeters = data.distances?.[0]?.[index];
        const durationSeconds = data.durations?.[0]?.[index];

        if (distanceMeters == null || durationSeconds == null) return [];

        return [
          {
            id: destination.id,
            distanceKm: Math.round((distanceMeters / 1000) * 100) / 100,
            durationMin: Math.max(1, Math.round(durationSeconds / 60)),
          },
        ];
      });
      this.setCached(cacheKey, routes);
      return routes;
    } catch (error) {
      this.logger.warn(`OSRM request failed: ${(error as Error).message}`);
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }
}
