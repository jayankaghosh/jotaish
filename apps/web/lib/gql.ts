const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/graphql';
const TOKEN_KEY = 'jotaish_token';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Private browsing can block storage; the session just won't persist.
  }
}

export class GqlError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message);
  }
}

export async function gql<T = any>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ query, variables }),
    });
  } catch {
    throw new GqlError('We could not reach Jotaish. Please check your connection and try again.');
  }
  const json = await res.json().catch(() => ({}));
  if (json.errors?.length) {
    const err = json.errors[0];
    throw new GqlError(err.message, err.extensions?.code);
  }
  if (!res.ok) throw new GqlError('Something went wrong. Please try again.');
  return json.data as T;
}

// Runs a GraphQL subscription over server-sent events, calling onData for
// each result until the server completes the stream.
export async function gqlStream<T = any>(query: string, variables: Record<string, unknown>, onData: (data: T) => void): Promise<void> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ query, variables }),
    });
  } catch {
    throw new GqlError('We could not reach Jotaish. Please check your connection and try again.');
  }
  if (!res.ok || !res.body) throw new GqlError('Something went wrong. Please try again.');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return;
    buffer += decoder.decode(value, { stream: true });
    let end: number;
    while ((end = buffer.indexOf('\n\n')) >= 0) {
      const block = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      let event = 'message';
      let data = '';
      for (const line of block.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) data += line.slice(5).trim();
      }
      if (event === 'complete') return;
      if (!data) continue;
      const json = JSON.parse(data);
      if (json.errors?.length) throw new GqlError(json.errors[0].message, json.errors[0].extensions?.code);
      if (json.data) onData(json.data as T);
    }
  }
}
