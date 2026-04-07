// Shared embedding utilities for chat API routes

// Fallback embedding function (generates deterministic vector for testing)
export function generateFallbackEmbedding(text: string): number[] {
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

// Split text into chunks by sentence boundaries
export function chunkText(text: string, chunkSize: number = 500): string[] {
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
