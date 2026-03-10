import { readFile } from 'fs/promises'
import path from 'path'

const PINECONE_API_KEY = process.env.PINECONE_API_KEY
const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME || 'cleanflowai-docs'

// Fallback embedding function
function generateFallbackEmbedding(text: string): number[] {
  const seed = text
    .split('')
    .reduce((acc, char) => acc + char.charCodeAt(0), 0)
  const random = Math.sin(seed) * 10000
  const embedding: number[] = []
  for (let i = 0; i < 384; i++) {
    embedding.push(
      Math.sin(random + i) * 0.5 + Math.cos(random * i) * 0.5
    )
  }
  return embedding
}

// Generate embeddings
async function generateEmbedding(text: string): Promise<number[]> {
  const hfToken = process.env.HUGGINGFACE_API_KEY || ''

  try {
    const response = await fetch('https://api-inference.huggingface.co/pipeline/feature-extraction', {
      headers: { Authorization: `Bearer ${hfToken}` },
      method: 'POST',
      body: JSON.stringify({ inputs: text, options: { wait_for_model: true } }),
    })

    if (!response.ok) {
      return generateFallbackEmbedding(text)
    }

    const result = await response.json()
    return Array.isArray(result) ? result : result[0]
  } catch (error) {
    return generateFallbackEmbedding(text)
  }
}

// Split text into chunks
function chunkText(text: string, chunkSize: number = 500): string[] {
  const chunks: string[] = []
  let currentChunk = ''

  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text]

  for (const sentence of sentences) {
    if ((currentChunk + sentence).length > chunkSize) {
      if (currentChunk) chunks.push(currentChunk.trim())
      currentChunk = sentence
    } else {
      currentChunk += sentence
    }
  }

  if (currentChunk) chunks.push(currentChunk.trim())
  return chunks
}

// Check if Pinecone index is seeded
async function isIndexSeeded(): Promise<boolean> {
  if (!PINECONE_API_KEY) return false

  try {
    const response = await fetch(
      `https://api.pinecone.io/indexes/${PINECONE_INDEX_NAME}`,
      {
        headers: {
          'Api-Key': PINECONE_API_KEY,
        },
      }
    )

    if (!response.ok) return false

    const data = await response.json()
    return data.stats?.totalRecordCount > 0
  } catch (error) {
    return false
  }
}

// Seed Pinecone index
export async function seedPineconeIndex() {
  if (!PINECONE_API_KEY) {
    console.warn('⚠️  PINECONE_API_KEY not set. Skipping auto-seed.')
    return
  }

  // Check if already seeded
  const seeded = await isIndexSeeded()
  if (seeded) {
    console.log('✅ Pinecone index already seeded')
    return
  }

  console.log('🌱 Starting Pinecone index auto-seed...')

  const documentationFiles = [
    { path: 'docs/chatbot-knowledge-base.md', source: 'knowledge-base' },
    { path: 'docs/application-flow.md', source: 'application-flow' },
  ]

  let totalChunksProcessed = 0

  for (const doc of documentationFiles) {
    try {
      const filePath = path.join(process.cwd(), doc.path)
      const content = await readFile(filePath, 'utf-8')

      if (!content.trim()) {
        console.warn(`⚠️  File ${doc.path} is empty, skipping`)
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

      // Upsert to Pinecone
      const response = await fetch(
        `https://${PINECONE_INDEX_NAME}-*.pinecone.io/vectors/upsert`,
        {
          method: 'POST',
          headers: {
            'Api-Key': PINECONE_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            vectors: upsertData,
          }),
        }
      )

      if (!response.ok) {
        console.warn(`⚠️  Failed to upsert ${doc.path}`)
        continue
      }

      console.log(`✅ Seeded ${doc.path}: ${chunks.length} chunks`)
      totalChunksProcessed += chunks.length
    } catch (error) {
      console.warn(`⚠️  Could not seed ${doc.path}:`, error)
    }
  }

  console.log(`✅ Auto-seed complete! ${totalChunksProcessed} chunks indexed`)
}
