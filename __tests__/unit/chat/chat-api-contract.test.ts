/**
 * Unit tests for POST /api/chat body contract
 * Covers: request URL, required body shape, conversationHistory format,
 *         page context field, response shape (reply + sources)
 */

// Env vars must be set before any module that reads them at import time
process.env.GROQ_API_KEY = 'test-groq-key'
process.env.PINECONE_API_KEY = 'test-pinecone-key'
process.env.PINECONE_INDEX_NAME = 'test-index'
process.env.HUGGINGFACE_API_KEY = 'test-hf-key'

const mockQuery = jest.fn()
jest.mock('@pinecone-database/pinecone', () => ({
  Pinecone: jest.fn().mockImplementation(() => ({
    Index: jest.fn().mockReturnValue({ query: mockQuery }),
  })),
}))

jest.mock('@/app/api/chat/_lib/embeddings', () => ({
  generateFallbackEmbedding: jest.fn().mockReturnValue(new Array(384).fill(0.1)),
}))

jest.mock('next/server', () => ({
  NextRequest: jest.fn(),
  NextResponse: {
    json: (data: any, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => data,
      _data: data,
    }),
  },
}))

import { POST } from '@/app/api/chat/route'

const originalFetch = global.fetch
function mockFetch(groqReply: string) {
  global.fetch = jest.fn().mockImplementation(async (url: string) => {
    if (typeof url === 'string' && url.includes('huggingface')) {
      return new Response(JSON.stringify(new Array(384).fill(0.5)), { status: 200 })
    }
    return new Response(
      JSON.stringify({ choices: [{ message: { content: groqReply } }] }),
      { status: 200 }
    )
  }) as any
}

beforeEach(() => {
  mockQuery.mockResolvedValue({ matches: [] })
  mockFetch('default reply')
})
afterEach(() => {
  global.fetch = originalFetch
  jest.clearAllMocks()
})

function makeReq(body: any) {
  return { json: async () => body } as any
}

describe('POST /api/chat — contract: request validation', () => {
  it('returns 400 with error field when message is absent', async () => {
    const res = await POST(makeReq({}))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Message is required')
  })

  it('returns 400 when message is empty string', async () => {
    const res = await POST(makeReq({ message: '' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Message is required')
  })

  it('accepts a minimal body with just message', async () => {
    const res = await POST(makeReq({ message: 'hello' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(typeof body.reply).toBe('string')
    expect(Array.isArray(body.sources)).toBe(true)
  })
})

describe('POST /api/chat — contract: response shape', () => {
  it('response always contains reply (string) and sources (array)', async () => {
    mockFetch('A useful answer.')
    mockQuery.mockResolvedValue({
      matches: [{ score: 0.88, metadata: { text: 'Some doc text', section: 'Upload' } }],
    })

    const res = await POST(makeReq({ message: 'How does upload work?' }))
    expect(res.status).toBe(200)
    const body = await res.json()

    expect(body).toHaveProperty('reply')
    expect(body).toHaveProperty('sources')
    expect(typeof body.reply).toBe('string')
    expect(Array.isArray(body.sources)).toBe(true)
  })

  it('source objects contain score and section fields', async () => {
    mockQuery.mockResolvedValue({
      matches: [{ score: 0.75, metadata: { text: 'Doc', section: 'DQ Rules' } }],
    })

    const res = await POST(makeReq({ message: 'What are DQ rules?' }))
    const body = await res.json()
    expect(body.sources).toHaveLength(1)
    expect(body.sources[0]).toMatchObject({ score: 0.75, section: 'DQ Rules' })
  })

  it('returns empty sources array when Pinecone has no matches', async () => {
    mockQuery.mockResolvedValue({ matches: [] })
    const res = await POST(makeReq({ message: 'obscure query' }))
    const body = await res.json()
    expect(body.sources).toEqual([])
  })
})

describe('POST /api/chat — contract: conversationHistory forwarding', () => {
  it('passes conversationHistory messages to Groq with correct role ordering', async () => {
    let capturedBody: any = null
    global.fetch = jest.fn().mockImplementation(async (url: string, opts?: RequestInit) => {
      if (typeof url === 'string' && url.includes('huggingface')) {
        return new Response(JSON.stringify(new Array(384).fill(0)), { status: 200 })
      }
      capturedBody = JSON.parse(opts?.body as string)
      return new Response(
        JSON.stringify({ choices: [{ message: { content: 'follow-up' } }] }),
        { status: 200 }
      )
    }) as any

    await POST(makeReq({
      message: 'follow-up question',
      conversationHistory: [
        { role: 'user', content: 'first question' },
        { role: 'assistant', content: 'first answer' },
      ],
    }))

    // Groq messages: [system, user-hist, assistant-hist, user-current]
    expect(capturedBody).not.toBeNull()
    expect(capturedBody.messages[0].role).toBe('system')
    expect(capturedBody.messages[1]).toMatchObject({ role: 'user', content: 'first question' })
    expect(capturedBody.messages[2]).toMatchObject({ role: 'assistant', content: 'first answer' })
    expect(capturedBody.messages[3]).toMatchObject({ role: 'user', content: 'follow-up question' })
  })

  it('works with empty conversationHistory (no prior turns)', async () => {
    let capturedMessages: any[] = []
    global.fetch = jest.fn().mockImplementation(async (url: string, opts?: RequestInit) => {
      if (typeof url === 'string' && url.includes('huggingface')) {
        return new Response(JSON.stringify(new Array(384).fill(0)), { status: 200 })
      }
      capturedMessages = JSON.parse(opts?.body as string).messages
      return new Response(
        JSON.stringify({ choices: [{ message: { content: 'reply' } }] }),
        { status: 200 }
      )
    }) as any

    await POST(makeReq({ message: 'cold start', conversationHistory: [] }))
    // system + user only = 2 messages
    expect(capturedMessages).toHaveLength(2)
    expect(capturedMessages[0].role).toBe('system')
    expect(capturedMessages[1]).toMatchObject({ role: 'user', content: 'cold start' })
  })
})

describe('POST /api/chat — contract: page context field', () => {
  it('accepts a context object without error', async () => {
    const res = await POST(makeReq({
      message: 'what am I looking at?',
      context: { route: '/files', summary: { files_total: 3 } },
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(typeof body.reply).toBe('string')
  })

  it('handles missing context field gracefully (no error)', async () => {
    const res = await POST(makeReq({ message: 'no context provided' }))
    expect(res.status).toBe(200)
  })

  it('handles malformed context object without crashing', async () => {
    const res = await POST(makeReq({ message: 'bad ctx', context: null }))
    expect(res.status).toBe(200)
  })
})

describe('POST /api/chat — contract: Groq model configuration', () => {
  it('calls Groq with llama-3.3-70b-versatile model', async () => {
    let model: string | undefined
    global.fetch = jest.fn().mockImplementation(async (url: string, opts?: RequestInit) => {
      if (typeof url === 'string' && url.includes('huggingface')) {
        return new Response(JSON.stringify(new Array(384).fill(0)), { status: 200 })
      }
      const body = JSON.parse(opts?.body as string)
      model = body.model
      return new Response(
        JSON.stringify({ choices: [{ message: { content: 'ok' } }] }),
        { status: 200 }
      )
    }) as any

    await POST(makeReq({ message: 'model check' }))
    expect(model).toBe('llama-3.3-70b-versatile')
  })
})

describe('POST /api/chat — contract: error responses', () => {
  it('returns 500 with error message when Groq API fails', async () => {
    global.fetch = jest.fn().mockImplementation(async (url: string) => {
      if (typeof url === 'string' && url.includes('huggingface')) {
        return new Response(JSON.stringify(new Array(384).fill(0)), { status: 200 })
      }
      return new Response('Internal Server Error', { status: 500 })
    }) as any

    const res = await POST(makeReq({ message: 'test' }))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body).toHaveProperty('error')
    expect(typeof body.error).toBe('string')
  })
})
