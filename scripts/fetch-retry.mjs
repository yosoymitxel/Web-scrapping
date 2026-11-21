const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);
const isTransientNetworkError = error =>
  error?.name === 'AbortError' || error?.name === 'TimeoutError' || error instanceof TypeError;

export const fetchWithRetry = async (url, init = {}, options = {}) => {
  const {
    attempts = 3,
    timeoutMs = 30_000,
    fetchImpl = fetch,
    wait = sleep,
    onRetry = () => {},
    baseDelayMs = 1_500,
    maxDelayMs = 12_000,
  } = options;

  if (!Number.isInteger(attempts) || attempts < 1) {
    throw new RangeError('attempts debe ser un entero mayor o igual a 1');
  }

  for (let attempt = 1; attempt <= attempts; attempt++) {
    let response;
    try {
      response = await fetchImpl(url, {
        ...init,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      if (attempt === attempts || !isTransientNetworkError(error)) throw error;
      const delay = Math.min(baseDelayMs * (2 ** (attempt - 1)), maxDelayMs);
      onRetry({ url, attempt, attempts, error, delay });
      await wait(delay);
      continue;
    }

    if (!RETRYABLE_STATUSES.has(response.status) || attempt === attempts) {
      return response;
    }

    const retryAfterSeconds = Number(response.headers?.get('retry-after'));
    const fallbackDelay = response.status === 429
      ? 8_000
      : baseDelayMs * (2 ** (attempt - 1));
    const delay = Math.min(
      Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
        ? retryAfterSeconds * 1_000
        : fallbackDelay,
      maxDelayMs,
    );
    onRetry({ url, attempt, attempts, status: response.status, delay });
    await wait(delay);
  }

  throw new Error(`No se pudo completar la solicitud: ${url}`);
};
