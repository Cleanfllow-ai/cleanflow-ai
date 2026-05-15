import { NextRequest, NextResponse } from 'next/server'
import { Pinecone } from '@pinecone-database/pinecone'
import { generateFallbackEmbedding } from './_lib/embeddings'
import { buildStaticKnowledgeBlock } from './_lib/product-context'

const GROQ_API_KEY = process.env.GROQ_API_KEY || ''
const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME || 'cleanflowai-docs'

// Lazy-initialize Pinecone to prevent build errors when env var is not set
let pinecone: Pinecone | null = null
function getPinecone(): Pinecone {
  if (!pinecone) {
    const apiKey = process.env.PINECONE_API_KEY
    if (!apiKey) {
      throw new Error('PINECONE_API_KEY environment variable is not set')
    }
    pinecone = new Pinecone({ apiKey })
  }
  return pinecone
}

// Helper function to generate embeddings using HuggingFace
async function generateEmbedding(text: string): Promise<number[]> {
  const model = 'sentence-transformers/all-MiniLM-L6-v2'
  const hfToken = process.env.HUGGINGFACE_API_KEY || ''

  try {
    const response = await fetch('https://api-inference.huggingface.co/pipeline/feature-extraction', {
      headers: { Authorization: `Bearer ${hfToken}` },
      method: 'POST',
      body: JSON.stringify({ inputs: text, options: { wait_for_model: true } }),
    })

    if (!response.ok) {
      console.warn('HuggingFace embedding failed, using fallback')
      return generateFallbackEmbedding(text)
    }

    const result = await response.json()
    return Array.isArray(result) ? result : result[0]
  } catch (error) {
    console.warn('Error generating embedding:', error)
    return generateFallbackEmbedding(text)
  }
}

// Helper function to query Groq for chat completion
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

  const groqUrl = 'https://api.groq.com/openai/v1/chat/completions'

  try {
    console.log(`📤 Calling Groq API at ${groqUrl}...`)

    const response = await fetch(groqUrl, {
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
      signal: AbortSignal.timeout(30000), // 30 second timeout
    })

    if (!response.ok) {
      const error = await response.text()
      console.error(`❌ Groq API error (${response.status}):`, error)
      throw new Error(`Groq API error: ${response.status} - ${error}`)
    }

    const data = await response.json()
    console.log(`✅ Groq response received`)
    return data.choices[0]?.message?.content || 'No response generated'
  } catch (error) {
    console.error('❌ Groq fetch error:', error)

    // Provide helpful error messages
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('Groq API request timed out. Please try again.')
      }
      if (error.message.includes('ENOTFOUND') || error.message.includes('ETIMEDOUT')) {
        throw new Error('Cannot reach Groq API. Check your internet connection and API key.')
      }
    }

    throw error
  }
}

// Render the page-context payload as a compact, model-friendly block.
// Defensive: ignore malformed shapes silently so a bad client never breaks the route.
function renderPageContext(context: unknown): string {
  if (!context || typeof context !== 'object') return ''
  try {
    const ctx = context as Record<string, unknown>
    const route = typeof ctx.route === 'string' ? ctx.route : null
    if (!route) return ''
    const lines: string[] = [`route: ${route}`]
    // Only include `summary` and `file` blocks if they are plain objects.
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

    console.log('Chat request received')

    // Check if API key exists
    if (!GROQ_API_KEY) {
      console.error('❌ GROQ_API_KEY not set in environment')
      return NextResponse.json(
        { error: 'Groq API key not configured. Please set GROQ_API_KEY in .env.local' },
        { status: 500 }
      )
    }

    // Resolve the page route up front — both RAG and the static fallback
    // use it (RAG to filter sources by section, static to pick the right
    // Q&A pack).
    const pageRoute =
      pageContext && typeof pageContext === 'object' && typeof (pageContext as { route?: unknown }).route === 'string'
        ? ((pageContext as { route: string }).route)
        : null

    // RAG context retrieval is best-effort: if Pinecone isn't configured (or
    // its query fails), fall through to a static product-knowledge block +
    // per-route Q&A pack so the model still answers like RAG hit relevant chunks.
    let context = ''
    const sources: Array<{ score: number | undefined; section: string }> = []
    let usedStaticFallback = false

    if (process.env.PINECONE_API_KEY) {
      try {
        const index = getPinecone().Index(PINECONE_INDEX_NAME)
        console.log('📝 Generating embedding...')
        const queryEmbedding = await generateEmbedding(message)
        console.log('🔍 Querying Pinecone index...')
        const queryResponse = await index.query({
          vector: queryEmbedding,
          topK: 5,
          includeMetadata: true,
        })
        if (queryResponse.matches && queryResponse.matches.length > 0) {
          console.log(`✅ Found ${queryResponse.matches.length} relevant documents`)
          context = 'Based on the documentation:'
          for (const match of queryResponse.matches) {
            if (match.metadata?.text) {
              context += `\n\n${match.metadata.text}`
              sources.push({
                score: match.score,
                section: (match.metadata.section as string) || 'Unknown',
              })
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

    // Build system prompt
    const pageContextBlock = renderPageContext(pageContext)
    const systemPrompt = `You are RightRev's in-product assistant. You help users with file uploads, data quality (DQ), quarantine remediation, jobs, and ERP/warehouse/storage connectors.

Output formatting rules — VERY IMPORTANT, follow exactly:
- Default to a short opening sentence (≤ 1 line) that directly answers the question, then a bulleted list for any details. Do NOT write run-on paragraphs.
- Use Markdown. Bullets ("- item"), bold for feature names ("**Quarantine Editor**"), inline code for status values ("\`PARTIAL\`", "\`AWAITING_REVIEW\`") and route paths ("\`/jobs\`").
- Keep each bullet to one sentence (≤ 18 words). If you need more, add another bullet.
- Cap total length at ~80 words unless the user explicitly asks for more detail.
- Never produce a single block of 4+ sentences glued together. If you have 3+ items, ALWAYS break them into a bulleted list.
- Don't repeat the question back. Don't add filler like "Great question!" or "I'd be happy to help".
- End with at most one short follow-up sentence (e.g. "Want the steps?") only if it adds real value.

Content rules:
- When you reference a feature, use the exact name shown in the UI sidebar ("Dashboard", "Data Catalog", "Jobs", "Admin").
- Prefer answers grounded in the product reference and per-page Q&A below. If the user's question matches one of the canonical Q&A entries closely, answer with that content (paraphrased naturally — don't quote verbatim).
- If the user asks something the reference doesn't cover, say "That isn't covered in the in-product reference; check the Help docs" rather than guessing.
- Never invent file names, scores, run IDs, or counts. Only reference numbers that appear in the page context block below.

${context}${pageContextBlock ? `\n\nCurrent page context (what the user is looking at right now):\n${pageContextBlock}` : ''}

Be professional and supportive.`

    // Query Groq LLM for response
    console.log(`🚀 Calling Groq LLM...`)
    const reply = await queryGroqLLM(systemPrompt, message, conversationHistory)

    console.log(`✅ Response generated successfully\n`)
    return NextResponse.json({
      reply,
      sources,
    })
  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      { error: 'AI service temporarily unavailable' },
      { status: 500 }
    )
  }
}
