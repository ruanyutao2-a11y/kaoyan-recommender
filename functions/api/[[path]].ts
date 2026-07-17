// Pages Function (API proxy) — /api/* → Cloudflare Worker
// Deployed alongside the frontend; runs on Pages edge, forwards to Worker
// on Cloudflare's internal network, bypassing workers.dev DNS blocking.
export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  // Strip leading /api and forward everything to the Worker
  const workerUrl = 'https://kaoyan-api.ruanyutao2.workers.dev' + url.pathname + url.search;

  // Clone the request with only the essential headers
  const headers = new Headers();
  headers.set('Content-Type', request.headers.get('Content-Type') || 'application/json');
  // Forward admin auth header for /api/admin/* routes
  const adminPassword = request.headers.get('X-Admin-Password');
  if (adminPassword) {
    headers.set('X-Admin-Password', adminPassword);
  }

  const body = request.method !== 'GET' && request.method !== 'HEAD'
    ? await request.clone().text()
    : undefined;

  const workerResp = await fetch(workerUrl, {
    method: request.method,
    headers,
    body,
  });

  const respHeaders = new Headers(workerResp.headers);
  respHeaders.set('Access-Control-Allow-Origin', '*');
  respHeaders.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  respHeaders.set('Access-Control-Allow-Headers', 'Content-Type');

  return new Response(workerResp.body, {
    status: workerResp.status,
    headers: respHeaders,
  });
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}
