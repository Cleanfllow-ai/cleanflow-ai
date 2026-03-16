import { NextRequest, NextResponse } from 'next/server'
import { Pinecone } from '@pinecone-database/pinecone'
import { readFile } from 'fs/promises'
import path from 'path'
import { generateFallbackEmbedding, chunkText } from '../_lib/embeddings'

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

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    const source = (formData.get('source') as string) || 'unknown'

    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 })
    }

    // Read file content
    const text = await file.text()

    if (!text.trim()) {
      return NextResponse.json({ error: 'File is empty' }, { status: 400 })
    }

    // Chunk the text
    const chunks = chunkText(text)

    // Get Pinecone index
    const index = getPinecone().Index(PINECONE_INDEX_NAME)

    // Upsert chunks to Pinecone
    const upsertData = []
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      const embedding = await generateEmbedding(chunk)

      upsertData.push({
        id: `${source}-chunk-${i}`,
        values: embedding,
        metadata: {
          text: chunk,
          section: `${source} - Section ${i + 1}`,
          source,
          chunkIndex: i,
          chunkCount: chunks.length,
        },
      })
    }

    // Batch upsert (Pinecone has limits on batch size)
    const batchSize = 100
    for (let i = 0; i < upsertData.length; i += batchSize) {
      const batch = upsertData.slice(i, i + batchSize)
      await index.upsert(batch)
    }

    return NextResponse.json({
      success: true,
      chunksProcessed: chunks.length,
      message: `Successfully processed and indexed ${chunks.length} chunks from ${file.name}`,
    })
  } catch (error) {
    console.error('Embed API error:', error)
    return NextResponse.json(
      {
        error: 'Failed to process and embed file',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const index = getPinecone().Index(PINECONE_INDEX_NAME)
    const stats = await index.describeIndexStats()

    return NextResponse.json({
      indexName: PINECONE_INDEX_NAME,
      totalVectors: stats.totalRecordCount,
      dimensions: stats.dimension,
      stats,
    })
  } catch (error) {
    console.error('Embed GET error:', error)
    return NextResponse.json(
      {
        error: 'Failed to get index statistics',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
