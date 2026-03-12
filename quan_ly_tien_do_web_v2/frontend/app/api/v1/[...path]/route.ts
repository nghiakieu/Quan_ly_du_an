import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:8000';

export async function GET(request: NextRequest, context: unknown) {
  return proxy(request, context);
}

export async function POST(request: NextRequest, context: unknown) {
  return proxy(request, context);
}

export async function PUT(request: NextRequest, context: unknown) {
  return proxy(request, context);
}

export async function DELETE(request: NextRequest, context: unknown) {
  return proxy(request, context);
}

export async function PATCH(request: NextRequest, context: unknown) {
  return proxy(request, context);
}

async function proxy(request: NextRequest, _context?: unknown) {
  const url = new URL(request.url);
  const match = url.pathname.match(/^\/api\/v1\/(.*)$/);
  const pathStr = (match?.[1] ?? '').replace(/\/$/, '');
  const backendPath = `${BACKEND_URL}/api/v1/${pathStr}${url.search}`;

  try {
    const headers = new Headers();
    request.headers.forEach((v, k) => {
      if (!['host', 'connection'].includes(k.toLowerCase())) {
        headers.set(k, v);
      }
    });
    const auth = request.headers.get('authorization') || request.headers.get('Authorization');
    if (auth) headers.set('Authorization', auth);

    let reqBody: ArrayBuffer | undefined;
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      reqBody = await request.arrayBuffer();
    }

    const res = await fetch(backendPath, {
      method: request.method,
      headers,
      body: reqBody && reqBody.byteLength > 0 ? reqBody : undefined,
    });

    const data = await res.text();
    const contentType = res.headers.get('content-type') || '';

    // Đảm bảo trả về JSON hợp lệ (tránh "Unexpected end of JSON input")
    const isJson = contentType.includes('application/json');
    let responseBody = data;
    if (!isJson || (data.trim() === '' && res.status >= 400)) {
      const msg = data.trim()
        ? (data.startsWith('<') ? 'Lỗi máy chủ (Backend trả về HTML)' : data.slice(0, 200))
        : (res.status >= 500 ? 'Lỗi máy chủ (Backend). Kiểm tra kết nối DB/Supabase.' : `HTTP ${res.status}`);
      responseBody = JSON.stringify({ detail: msg });
    }

    return new NextResponse(responseBody, {
      status: res.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const isConnRefused = /ECONNREFUSED|fetch failed|Unable to connect/i.test(msg);
    return NextResponse.json(
      {
        detail: isConnRefused
          ? 'Backend chưa chạy. Vui lòng khởi động Backend (port 8000) trước.'
          : msg,
      },
      { status: 503 }
    );
  }
}
