const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'
).replace(/\/+$/, '');

export function getApiBaseUrl(): string {
  return API_BASE_URL;
}

export class ApiError extends Error {
  readonly status: number;
  readonly details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

let refreshPromise: Promise<boolean> | null = null;

async function attemptTokenRefresh(): Promise<boolean> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return response.ok;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export interface ApiFetchOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  skipRefresh?: boolean;
}

function buildUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalized}`;
}

async function parseErrorPayload(response: Response): Promise<{ message: string; details?: unknown }> {
  const fallback = `Request failed (${response.status})`;
  try {
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await response.text();
      return { message: text || fallback };
    }
    const json = (await response.json()) as {
      message?: string | string[];
      error?: string;
    };
    const msg = Array.isArray(json.message)
      ? json.message.join(', ')
      : json.message || json.error || fallback;
    return { message: msg, details: json };
  } catch {
    return { message: fallback };
  }
}

export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { body, headers, skipRefresh = false, ...rest } = options;

  const requestHeaders = new Headers(headers);
  if (body !== undefined && !(body instanceof FormData) && !requestHeaders.has('Content-Type')) {
    requestHeaders.set('Content-Type', 'application/json');
  }

  const serializedBody =
    body === undefined
      ? undefined
      : body instanceof FormData
        ? body
        : JSON.stringify(body);

  const execute = () =>
    fetch(buildUrl(path), {
      ...rest,
      headers: requestHeaders,
      body: serializedBody,
      credentials: 'include',
    });

  let response = await execute();

  const isAuthEndpoint =
    path.includes('/api/auth/refresh') ||
    path.includes('/api/auth/login') ||
    path.includes('/api/auth/register');

  if (response.status === 401 && !skipRefresh && !isAuthEndpoint) {
    const refreshed = await attemptTokenRefresh();
    if (refreshed) {
      response = await execute();
    }
  }

  if (!response.ok) {
    const parsed = await parseErrorPayload(response);
    throw new ApiError(parsed.message, response.status, parsed.details);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return (await response.json()) as T;
  }

  return (await response.text()) as unknown as T;
}

export function apiGet<T>(path: string, options?: ApiFetchOptions): Promise<T> {
  return apiFetch<T>(path, { ...options, method: 'GET' });
}

export function apiPost<T>(path: string, body?: unknown, options?: ApiFetchOptions): Promise<T> {
  return apiFetch<T>(path, { ...options, method: 'POST', body });
}

export function apiPatch<T>(path: string, body?: unknown, options?: ApiFetchOptions): Promise<T> {
  return apiFetch<T>(path, { ...options, method: 'PATCH', body });
}

export function apiDelete<T>(path: string, body?: unknown, options?: ApiFetchOptions): Promise<T> {
  return apiFetch<T>(path, { ...options, method: 'DELETE', body });
}
