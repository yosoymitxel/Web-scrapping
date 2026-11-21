import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchWithRetry } from './fetch-retry.mjs';

test('reintenta timeouts de red y continúa cuando la fuente vuelve', async () => {
  let calls = 0;
  const delays = [];
  const response = await fetchWithRetry('https://example.test/cines', {}, {
    fetchImpl: async () => {
      calls++;
      if (calls === 1) {
        const error = new Error('The operation was aborted due to timeout');
        error.name = 'TimeoutError';
        throw error;
      }
      return new Response('ok', { status: 200 });
    },
    wait: async ms => delays.push(ms),
  });

  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'ok');
  assert.equal(calls, 2);
  assert.deepEqual(delays, [1_500]);
});

test('reintenta fallos temporales HTTP y respeta Retry-After', async () => {
  let calls = 0;
  const delays = [];
  const response = await fetchWithRetry('https://example.test/promos', {}, {
    fetchImpl: async () => {
      calls++;
      return calls === 1
        ? new Response('rate limited', { status: 429, headers: { 'retry-after': '5' } })
        : new Response('ok', { status: 200 });
    },
    wait: async ms => delays.push(ms),
  });

  assert.equal(response.status, 200);
  assert.equal(calls, 2);
  assert.deepEqual(delays, [5_000]);
});

test('no reintenta errores HTTP permanentes', async () => {
  let calls = 0;
  const response = await fetchWithRetry('https://example.test/missing', {}, {
    fetchImpl: async () => {
      calls++;
      return new Response('not found', { status: 404 });
    },
    wait: async () => assert.fail('no debe esperar ni reintentar'),
  });

  assert.equal(response.status, 404);
  assert.equal(calls, 1);
});

test('agota los intentos ante un timeout persistente', async () => {
  let calls = 0;
  const error = new Error('network timeout');
  error.name = 'TimeoutError';

  await assert.rejects(
    fetchWithRetry('https://example.test/offline', {}, {
      fetchImpl: async () => { calls++; throw error; },
      wait: async () => {},
    }),
    /network timeout/,
  );
  assert.equal(calls, 3);
});

test('no reintenta errores de programación u otros errores no transitorios', async () => {
  let calls = 0;
  await assert.rejects(
    fetchWithRetry('https://example.test/bad', {}, {
      fetchImpl: async () => { calls++; throw new Error('bad request configuration'); },
      wait: async () => assert.fail('no debe reintentar'),
    }),
    /bad request configuration/,
  );
  assert.equal(calls, 1);
});
