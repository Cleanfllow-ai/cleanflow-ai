import { NextRequest, NextResponse } from 'next/server'
import { Pinecone } from '@pinecone-database/pinecone'
import { generateFallbackEmbedding } from './_lib/embeddings'

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

export async function POST(req: NextRequest) {
  try {
    const { message, conversationHistory = [] } = await req.json()

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

    // Get the Pinecone index
    const index = getPinecone().Index(PINECONE_INDEX_NAME)

    // Generate embedding for the user's message
    console.log(`📝 Generating embedding...`)
    const queryEmbedding = await generateEmbedding(message)

    // Query Pinecone for relevant documents
    console.log(`🔍 Querying Pinecone index...`)
    const queryResponse = await index.query({
      vector: queryEmbedding,
      topK: 5,
      includeMetadata: true,
    })

    // Format retrieved context
    let context = 'Based on the documentation:'
    const sources = []

    if (queryResponse.matches && queryResponse.matches.length > 0) {
      console.log(`✅ Found ${queryResponse.matches.length} relevant documents`)
      for (const match of queryResponse.matches) {
        if (match.metadata?.text) {
          context += `\n\n${match.metadata.text}`
          sources.push({
            score: match.score,
            section: match.metadata.section || 'Unknown',
          })
        }
      }
    } else {
      console.warn(`⚠️  No relevant documents found in Pinecone`)
      context = 'I searched the knowledge base but found limited relevant information. '
    }

    // Build system prompt
    const systemPrompt = `You are a helpful assistant for the ERP Transform App. You help users understand how to use the application, transform data, improve quality, and integrate with ERP systems.

${context}

Provide clear, concise, and helpful answers. If you don't know something, say so honestly. Always be professional and supportive.`

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
