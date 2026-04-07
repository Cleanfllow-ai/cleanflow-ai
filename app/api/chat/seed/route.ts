import { NextRequest, NextResponse } from 'next/server'
import { Pinecone } from '@pinecone-database/pinecone'
import { readFile } from 'fs/promises'
import path from 'path'
import { generateFallbackEmbedding, chunkText } from '../_lib/embeddings'

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

// Helper function to generate embeddings
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
    const { action } = await req.json()

    if (action === 'seed') {
      // Automatic seeding of documentation files
      const documentationFiles = [
        { path: 'docs/chatbot-knowledge-base.md', source: 'knowledge-base' },
        { path: 'docs/application-flow.md', source: 'application-flow' },
        { path: 'docs/unified_bridge.md', source: 'unified-bridge' },
      ]

      const index = getPinecone().Index(PINECONE_INDEX_NAME)
      let totalChunksProcessed = 0

      for (const doc of documentationFiles) {
        try {
          const filePath = path.join(process.cwd(), doc.path)
          const content = await readFile(filePath, 'utf-8')

          if (!content.trim()) {
            console.warn(`File ${doc.path} is empty, skipping`)
            continue
          }

          const chunks = chunkText(content)
          const upsertData = []

          for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i]
            const embedding = await generateEmbedding(chunk)

            upsertData.push({
              id: `${doc.source}-chunk-${i}`,
              values: embedding,
              metadata: {
                text: chunk,
                section: `${doc.source} - Section ${i + 1}`,
                source: doc.source,
                chunkIndex: i,
                chunkCount: chunks.length,
              },
            })
          }

          // Batch upsert
          const batchSize = 100
          for (let i = 0; i < upsertData.length; i += batchSize) {
            const batch = upsertData.slice(i, i + batchSize)
            await index.upsert(batch)
          }

          console.log(
            `✅ Seeded ${doc.path}: ${chunks.length} chunks processed`
          )
          totalChunksProcessed += chunks.length
        } catch (error) {
          console.warn(`⚠️  Could not seed ${doc.path}:`, error)
        }
      }

      return NextResponse.json({
        success: true,
        totalChunksProcessed,
        message: `Seeding complete! ${totalChunksProcessed} chunks indexed`,
      })
    }

    return NextResponse.json(
      { error: 'Unknown action. Use action=seed' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Seed API error:', error)
    return NextResponse.json(
      {
        error: 'Failed to seed documentation',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
