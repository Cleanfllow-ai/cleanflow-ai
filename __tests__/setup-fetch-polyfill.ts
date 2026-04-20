/**
 * Polyfill Response, Headers, Request, and fetch for jest-environment-jsdom.
 * Node 24 has these globally, but jsdom strips them from the global scope.
 * This file restores them so tests can mock fetch with real Response objects.
 *
 * Also sets test env vars needed by modules that capture process.env at import time.
 */

// Set test API keys so modules that read them at import time get non-empty values
// Polyfill AbortSignal.timeout (not available in jsdom)
if (typeof AbortSignal !== 'undefined' && !AbortSignal.timeout) {
  AbortSignal.timeout = (ms: number) => {
    const controller = new AbortController()
    setTimeout(() => controller.abort(new DOMException('TimeoutError', 'TimeoutError')), ms)
    return controller.signal
  }
}

if (!process.env.GROQ_API_KEY) process.env.GROQ_API_KEY = 'test-groq-key'
if (!process.env.PINECONE_API_KEY) process.env.PINECONE_API_KEY = 'test-pinecone-key'
if (!process.env.PINECONE_INDEX_NAME) process.env.PINECONE_INDEX_NAME = 'test-index'
if (!process.env.HUGGINGFACE_API_KEY) process.env.HUGGINGFACE_API_KEY = 'test-hf-key'

// Try to pull web API classes from undici (bundled in Node 18+)
try {
  const undici = require('undici')
  if (typeof globalThis.Response === 'undefined' && undici.Response) {
    globalThis.Response = undici.Response
  }
  if (typeof globalThis.Headers === 'undefined' && undici.Headers) {
    globalThis.Headers = undici.Headers
  }
  if (typeof globalThis.Request === 'undefined' && undici.Request) {
    globalThis.Request = undici.Request
  }
} catch {
  // Minimal shims if undici is not available
  if (typeof globalThis.Headers === 'undefined') {
    class MockHeaders {
      private map: Record<string, string> = {}
      constructor(init?: Record<string, string>) {
        if (init) Object.entries(init).forEach(([k, v]) => (this.map[k.toLowerCase()] = v))
      }
      get(name: string) { return this.map[name.toLowerCase()] || null }
      set(name: string, value: string) { this.map[name.toLowerCase()] = value }
      has(name: string) { return name.toLowerCase() in this.map }
    }
    globalThis.Headers = MockHeaders as any
  }

  if (typeof globalThis.Response === 'undefined') {
    class MockResponse {
      public status: number
      public statusText: string
      public ok: boolean
      public headers: any
      private _body: string

      constructor(body?: string | null, init?: { status?: number; statusText?: string; headers?: any }) {
        this._body = body || ''
        this.status = init?.status ?? 200
        this.statusText = init?.statusText ?? ''
        this.ok = this.status >= 200 && this.status < 300
        this.headers = init?.headers instanceof globalThis.Headers
          ? init.headers
          : new (globalThis.Headers as any)(init?.headers || {})
      }

      async text() { return this._body }
      async json() { return JSON.parse(this._body) }
      async blob() {
        return {
          text: async () => this._body,
          size: this._body.length,
          type: this.headers?.get?.('content-type') || '',
        }
      }
    }
    // Add static json() method used by NextResponse.json()
    ;(MockResponse as any).json = function(data: any, init?: { status?: number }) {
      const body = JSON.stringify(data)
      return new MockResponse(body, {
        status: init?.status ?? 200,
        headers: { 'content-type': 'application/json' } as any,
      })
    }
    globalThis.Response = MockResponse as any
  }

  if (typeof globalThis.Request === 'undefined') {
    class MockRequest {
      public url: string
      public method: string
      public headers: any
      private _body: string

      constructor(url: string, init?: { method?: string; headers?: any; body?: string }) {
        this.url = url
        this.method = init?.method || 'GET'
        this.headers = init?.headers || {}
        this._body = init?.body || ''
      }

      async json() { return JSON.parse(this._body) }
      async text() { return this._body }
    }
    globalThis.Request = MockRequest as any
  }
}
