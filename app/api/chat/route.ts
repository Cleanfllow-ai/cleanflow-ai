import { NextRequest, NextResponse } from 'next/server'
import { Pinecone } from '@pinecone-database/pinecone'
import { buildStaticKnowledgeBlock } from './_lib/product-context'

const GROQ_API_KEY = process.env.GROQ_API_KEY || ''
const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME || 'rightrev-docs'

// Lazy-initialize Pinecone to prevent build errors when env var is not set
let pinecone: Pinecone | null = null
function getPinecone(): Pinecone {
  if (!pinecone) {
    const apiKey = process.env.PINECONE_API_KEY
    if (!apiKey) throw new Error('PINECONE_API_KEY environment variable is not set')
    pinecone = new Pinecone({ apiKey })
  }
  return pinecone
}

// Query Groq for a chat completion
async function queryGroqLLM(
  systemPrompt: string,
  userMessage: string,
  conversationHistory: Array<{ role: string; content: string }>
): Promise<string> {
  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory,
    { role: 'user', content: userMessage },
  ]

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages,
      temperature: 0.7,
      max_tokens: 1024,
    }),
    signal: AbortSignal.timeout(30000),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Groq API error: ${response.status} - ${error}`)
  }

  const data = await response.json()
  return data.choices[0]?.message?.content || 'No response generated'
}

// Render the page-context payload as a compact, model-friendly block
function renderPageContext(context: unknown): string {
  if (!context || typeof context !== 'object') return ''
  try {
    const ctx = context as Record<string, unknown>
    const route = typeof ctx.route === 'string' ? ctx.route : null
    if (!route) return ''
    const lines: string[] = [`route: ${route}`]
    for (const key of ['summary', 'file'] as const) {
      const block = ctx[key]
      if (block && typeof block === 'object' && !Array.isArray(block)) {
        const pairs = Object.entries(block as Record<string, unknown>)
          .filter(([, v]) => v !== undefined && v !== null && v !== '')
          .map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
        if (pairs.length > 0) lines.push(`${key}: { ${pairs.join(', ')} }`)
      }
    }
    return lines.join('\n')
  } catch {
    return ''
  }
}

export async function POST(req: NextRequest) {
  try {
    const { message, conversationHistory = [], context: pageContext } = await req.json()

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    if (!GROQ_API_KEY) {
      return NextResponse.json(
        { error: 'Groq API key not configured. Please set GROQ_API_KEY in environment variables.' },
        { status: 500 }
      )
    }

    const pageRoute =
      pageContext && typeof pageContext === 'object' && typeof (pageContext as { route?: unknown }).route === 'string'
        ? (pageContext as { route: string }).route
        : null

    // RAG via Pinecone integrated embedding (llama-text-embed-v2).
    // Falls back to static product context if Pinecone is not configured or fails.
    let context = ''
    const sources: Array<{ score: number | undefined; section: string }> = []
    let usedStaticFallback = false

    if (process.env.PINECONE_API_KEY) {
      try {
        console.log('🔍 Querying Pinecone with integrated embedding...')
        const ns = getPinecone().index(PINECONE_INDEX_NAME).namespace('__default__')

        // searchRecords uses Pinecone's hosted llama-text-embed-v2 — no local embedding needed
        const results = await (ns as any).searchRecords({
          query: {
            inputs: { text: message },
            topK: 5,
          },
          fields: ['text', 'section'],
        })

        const hits = results?.result?.hits ?? []
        if (hits.length > 0) {
          console.log(`✅ Found ${hits.length} relevant chunks`)
          context = 'Based on the RightRev knowledge base:'
          for (const hit of hits) {
            const text = hit.fields?.text
            const section = hit.fields?.section ?? 'Unknown'
            if (text) {
              context += `\n\n${text}`
              sources.push({ score: hit._score, section })
            }
          }
        } else {
          console.warn('⚠️  No Pinecone matches — using static product context')
          usedStaticFallback = true
        }
      } catch (ragErr) {
        console.warn('Pinecone RAG lookup failed; using static product context:', ragErr)
        usedStaticFallback = true
      }
    } else {
      console.log('ℹ️  PINECONE_API_KEY not set — using static product context')
      usedStaticFallback = true
    }

    if (usedStaticFallback) {
      context = buildStaticKnowledgeBlock(pageRoute)
    }

    const pageContextBlock = renderPageContext(pageContext)
    const systemPrompt = `You are RightRev's in-product assistant. You help users with file uploads, data quality (DQ), quarantine remediation, jobs, and ERP/warehouse/storage connectors.

Output formatting rules — VERY IMPORTANT, follow exactly:
- Default to a short opening sentence (≤ 1 line) that directly answers the question, then a bulleted list for any details. Do NOT write run-on paragraphs.
- Use Markdown. Bullets ("- item"), bold for feature names ("**Quarantine Editor**"), inline code for status values (\`PARTIAL\`, \`AWAITING_REVIEW\`) and route paths (\`/jobs\`).
- Keep each bullet to one sentence (≤ 18 words). If you need more, add another bullet.
- Cap total length at ~80 words unless the user explicitly asks for more detail.
- Never produce a single block of 4+ sentences glued together. If you have 3+ items, ALWAYS break them into a bulleted list.
- Don't repeat the question back. Don't add filler like "Great question!" or "I'd be happy to help".
- End with at most one short follow-up sentence (e.g. "Want the steps?") only if it adds real value.

Content rules:
- When you reference a feature, use the exact name shown in the UI sidebar ("Dashboard", "Data Catalog", "Jobs", "Admin").
- Answer only from the knowledge base context provided below. Do not guess or make up information.
- If the user asks something the knowledge base doesn't cover, say "That isn't covered in the in-product reference; check the Help docs or email support@infiniqon.com" rather than guessing.
- Never invent file names, scores, run IDs, or counts. Only reference numbers that appear in the page context block below.

${context}${pageContextBlock ? `\n\nCurrent page context (what the user is looking at right now):\n${pageContextBlock}` : ''}

Be professional and supportive.`

    console.log('🚀 Calling Groq LLM...')
    const reply = await queryGroqLLM(systemPrompt, message, conversationHistory)

    return NextResponse.json({ reply, sources })
  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      { error: 'AI service temporarily unavailable' },
      { status: 500 }
    )
  }
}
