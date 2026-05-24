import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { RouteDistanceService } from '../src/cafes/route-distance.service';

function createService(values: Record<string, string> = {}) {
  return new RouteDistanceService({
    get: (key: string, fallback?: string) => values[key] ?? fallback,
  } as any);
}

test('OSRM distance service returns null when not configured', async () => {
  const service = createService();

  assert.equal(service.isConfigured(), false);
  assert.equal(
    await service.getDrivingDistances({ lat: 10.1, lng: 106.1 }, [
      { id: 'cafe-1', lat: 10.2, lng: 106.2 },
    ]),
    null,
  );
});

test('OSRM distance service calls table endpoint and maps route distances', async () => {
  const service = createService({
    OSRM_BASE_URL: 'http://osrm.test/',
    OSRM_PROFILE: 'driving',
    OSRM_TIMEOUT_MS: '1000',
    OSRM_MAX_DESTINATIONS: '2',
  });
  const originalFetch = global.fetch;
  let calledUrl = '';

  global.fetch = (async (url: string) => {
    calledUrl = url;
    return {
      ok: true,
      json: async () => ({
        code: 'Ok',
        distances: [[2500.4, null]],
        durations: [[720.2, null]],
      }),
    } as Response;
  }) as typeof fetch;

  try {
    const result = await service.getDrivingDistances({ lat: 10.1, lng: 106.1 }, [
      { id: 'cafe-1', lat: 10.2, lng: 106.2 },
      { id: 'cafe-2', lat: 10.3, lng: 106.3 },
      { id: 'cafe-3', lat: 10.4, lng: 106.4 },
    ]);

    assert.match(
      calledUrl,
      /^http:\/\/osrm\.test\/table\/v1\/driving\/106\.1,10\.1;106\.2,10\.2;106\.3,10\.3\?/,
    );
    assert.match(calledUrl, /sources=0/);
    assert.match(calledUrl, /destinations=1;2/);
    assert.match(calledUrl, /annotations=distance,duration/);
    assert.deepEqual(result, [{ id: 'cafe-1', distanceKm: 2.5, durationMin: 12 }]);
  } finally {
    global.fetch = originalFetch;
  }
});

test('OSRM distance service caches successful table responses by rounded origin', async () => {
  const service = createService({
    OSRM_BASE_URL: 'http://osrm.test/',
    OSRM_PROFILE: 'driving',
    OSRM_CACHE_TTL_MS: '300000',
  });
  const originalFetch = global.fetch;
  let fetchCount = 0;

  global.fetch = (async () => {
    fetchCount += 1;
    return {
      ok: true,
      json: async () => ({
        code: 'Ok',
        distances: [[1500]],
        durations: [[180]],
      }),
    } as Response;
  }) as typeof fetch;

  try {
    const destinations = [{ id: 'cafe-1', lat: 10.2, lng: 106.2 }];
    const first = await service.getDrivingDistances({ lat: 10.1004, lng: 106.1004 }, destinations);
    const second = await service.getDrivingDistances({ lat: 10.1003, lng: 106.1003 }, destinations);

    assert.equal(fetchCount, 1);
    assert.deepEqual(first, [{ id: 'cafe-1', distanceKm: 1.5, durationMin: 3 }]);
    assert.deepEqual(second, first);
  } finally {
    global.fetch = originalFetch;
  }
});

test('OSRM distance service returns null when rate limit is exceeded', async () => {
  const service = createService({
    OSRM_BASE_URL: 'http://osrm.test/',
    OSRM_PROFILE: 'driving',
    OSRM_MIN_INTERVAL_MS: '1000',
  });
  const originalFetch = global.fetch;
  let fetchCount = 0;

  global.fetch = (async () => {
    fetchCount += 1;
    return {
      ok: true,
      json: async () => ({
        code: 'Ok',
        distances: [[1500]],
        durations: [[180]],
      }),
    } as Response;
  }) as typeof fetch;

  try {
    const first = await service.getDrivingDistances({ lat: 10.1, lng: 106.1 }, [
      { id: 'cafe-1', lat: 10.2, lng: 106.2 },
    ]);
    const second = await service.getDrivingDistances({ lat: 10.3, lng: 106.3 }, [
      { id: 'cafe-2', lat: 10.4, lng: 106.4 },
    ]);

    assert.equal(fetchCount, 1);
    assert.deepEqual(first, [{ id: 'cafe-1', distanceKm: 1.5, durationMin: 3 }]);
    assert.equal(second, null);
  } finally {
    global.fetch = originalFetch;
  }
});
