/**
 * Unit tests for app/api/chat/route.ts
 * Covers: POST handler — message validation, Groq LLM call, Pinecone query,
 *         embedding generation, error handling
 */

// Set env vars FIRST — jest.mock is hoisted, and the route reads env at import time
// but process.env assignments at top-level are also hoisted before jest.mock factories run
process.env.GROQ_API_KEY = 'test-groq-key'
process.env.PINECONE_API_KEY = 'test-pinecone-key'
process.env.PINECONE_INDEX_NAME = 'test-index'
process.env.HUGGINGFACE_API_KEY = 'test-hf-key'

// Mock Pinecone before imports
const mockQuery = jest.fn()
const mockIndex = jest.fn().mockReturnValue({ query: mockQuery })

jest.mock('@pinecone-database/pinecone', () => ({
  Pinecone: jest.fn().mockImplementation(() => ({
    Index: mockIndex,
  })),
}))

// Mock the fallback embeddings module
jest.mock('@/app/api/chat/_lib/embeddings', () => ({
  generateFallbackEmbedding: jest.fn().mockReturnValue(new Array(384).fill(0.1)),
}))

// Mock NextResponse.json to return a plain object we can inspect
jest.mock('next/server', () => {
  return {
    NextRequest: jest.fn(),
    NextResponse: {
      json: (data: any, init?: { status?: number }) => ({
        status: init?.status ?? 200,
        json: async () => data,
        _data: data,
      }),
    },
  }
})

// Set env vars before import
process.env.GROQ_API_KEY = 'test-groq-key'
process.env.PINECONE_API_KEY = 'test-pinecone-key'
process.env.PINECONE_INDEX_NAME = 'test-index'
process.env.HUGGINGFACE_API_KEY = 'test-hf-key'

import { POST } from '@/app/api/chat/route'

const originalFetch = global.fetch
function mockFetch(impl: (...args: any[]) => Promise<any>) {
  global.fetch = jest.fn(impl) as any
}

afterEach(() => {
  global.fetch = originalFetch
  jest.clearAllMocks()
})

/** Minimal request mock — the route only calls req.json() */
function makeRequest(body: any) {
  return { json: async () => body } as any
}

describe('POST /api/chat', () => {
  it('returns 400 when message is missing', async () => {
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('Message is required')
  })

  it('returns 400 when message is empty string', async () => {
    const res = await POST(makeRequest({ message: '' }))
    expect(res.status).toBe(400)
  })

  it('returns successful reply with sources when everything works', async () => {
    mockFetch(async (url: string) => {
      if (typeof url === 'string' && url.includes('huggingface')) {
        return new Response(JSON.stringify(new Array(384).fill(0.5)), { status: 200 })
      }
      return new Response(JSON.stringify({
        choices: [{ message: { content: 'Here is how to upload a file...' } }],
      }), { status: 200 })
    })

    mockQuery.mockResolvedValue({
      matches: [
        { score: 0.92, metadata: { text: 'Upload your CSV...', section: 'File Upload' } },
        { score: 0.85, metadata: { text: 'Click browse button...', section: 'File Upload' } },
      ],
    })

    const res = await POST(makeRequest({ message: 'How do I upload a file?' }))
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.reply).toBe('Here is how to upload a file...')
    expect(body.sources).toHaveLength(2)
    expect(body.sources[0].section).toBe('File Upload')
    expect(body.sources[0].score).toBe(0.92)
  })

  it('handles empty Pinecone results gracefully', async () => {
    mockFetch(async (url: string) => {
      if (typeof url === 'string' && url.includes('huggingface')) {
        return new Response(JSON.stringify(new Array(384).fill(0.5)), { status: 200 })
      }
      return new Response(JSON.stringify({
        choices: [{ message: { content: 'I could not find specific docs...' } }],
      }), { status: 200 })
    })

    mockQuery.mockResolvedValue({ matches: [] })

    const res = await POST(makeRequest({ message: 'Something obscure' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.sources).toEqual([])
  })

  it('falls back to fallback embedding when HuggingFace fails', async () => {
    mockFetch(async (url: string) => {
      if (typeof url === 'string' && url.includes('huggingface')) {
        return new Response('', { status: 503 })
      }
      return new Response(JSON.stringify({
        choices: [{ message: { content: 'Response with fallback' } }],
      }), { status: 200 })
    })

    mockQuery.mockResolvedValue({ matches: [] })

    const res = await POST(makeRequest({ message: 'test' }))
    expect(res.status).toBe(200)
  })

  it('passes conversationHistory to Groq', async () => {
    mockFetch(async (url: string, opts?: RequestInit) => {
      if (typeof url === 'string' && url.includes('huggingface')) {
        return new Response(JSON.stringify(new Array(384).fill(0)), { status: 200 })
      }
      const requestBody = JSON.parse(opts?.body as string)
      // system + 2 history + user = 4 messages
      expect(requestBody.messages).toHaveLength(4)
      expect(requestBody.messages[1].role).toBe('user')
      expect(requestBody.messages[1].content).toBe('Previous question')
      expect(requestBody.messages[2].role).toBe('assistant')
      expect(requestBody.messages[2].content).toBe('Previous answer')
      return new Response(JSON.stringify({
        choices: [{ message: { content: 'Follow-up response' } }],
      }), { status: 200 })
    })

    mockQuery.mockResolvedValue({ matches: [] })

    const res = await POST(makeRequest({
      message: 'Follow-up question',
      conversationHistory: [
        { role: 'user', content: 'Previous question' },
        { role: 'assistant', content: 'Previous answer' },
      ],
    }))
    expect(res.status).toBe(200)
  })

  it('returns 500 when Groq API fails', async () => {
    mockFetch(async (url: string) => {
      if (typeof url === 'string' && url.includes('huggingface')) {
        return new Response(JSON.stringify(new Array(384).fill(0)), { status: 200 })
      }
      return new Response('Server Error', { status: 500 })
    })

    mockQuery.mockResolvedValue({ matches: [] })

    const res = await POST(makeRequest({ message: 'test' }))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('AI service temporarily unavailable')
  })

  it('skips Pinecone matches without text metadata', async () => {
    mockFetch(async (url: string) => {
      if (typeof url === 'string' && url.includes('huggingface')) {
        return new Response(JSON.stringify(new Array(384).fill(0)), { status: 200 })
      }
      return new Response(JSON.stringify({
        choices: [{ message: { content: 'Response' } }],
      }), { status: 200 })
    })

    mockQuery.mockResolvedValue({
      matches: [
        { score: 0.9, metadata: {} },
        { score: 0.8, metadata: { text: 'Valid doc', section: 'Help' } },
      ],
    })

    const res = await POST(makeRequest({ message: 'test' }))
    const body = await res.json()
    expect(body.sources).toHaveLength(1)
    expect(body.sources[0].section).toBe('Help')
  })
})
