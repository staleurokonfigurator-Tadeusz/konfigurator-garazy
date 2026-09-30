import { NextResponse } from 'next/server';

const allowedOrigins = () => new Set(
  (process.env.WP_ALLOWED_ORIGINS || 'https://konfigurator.staleuro.pl')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean)
);

function resolveWordPressOrigin(value: string | null) {
  const fallback = process.env.WP_URL || 'https://konfigurator.staleuro.pl';
  const candidate = value ? decodeURIComponent(value) : fallback;
  const url = new URL(candidate);

  if (url.protocol !== 'https:' && !(process.env.NODE_ENV === 'development' && url.hostname === 'localhost')) {
    throw new Error('WORDPRESS_PROTOCOL_NOT_ALLOWED');
  }
  if (!allowedOrigins().has(url.origin) && !(process.env.NODE_ENV === 'development' && url.hostname === 'localhost')) {
    throw new Error('WORDPRESS_ORIGIN_NOT_ALLOWED');
  }

  return url.origin;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const storeUrl = searchParams.get('store_url');

  try {
    const wpOrigin = resolveWordPressOrigin(storeUrl);
    const res = await fetch(`${wpOrigin}/wp-json/garage/v1/config`, {
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(8_000),
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'StalEuroConfigurator/2.0',
      },
    });

    if (!res.ok) throw new Error(`Serwer WP odrzucił połączenie (Status: ${res.status})`);

    const data = await res.json();
    data.storeUrl = wpOrigin;
    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'UNKNOWN_ERROR';
    const status = message.includes('NOT_ALLOWED') ? 403 : 502;
    console.error('Błąd API konfiguracji:', message);
    return NextResponse.json({ error: 'API_FETCH_FAILED' }, { status });
  }
}
