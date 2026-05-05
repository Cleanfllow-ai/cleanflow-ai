/**
 * Seed Script for RAG Chatbot
 * 
 * This script reads the application-flow.md documentation and uploads it to Pinecone
 * for use with the RAG chatbot.
 * 
 * Usage:
 * 1. Make sure you have set the environment variables in .env.local:
 *    - GROQ_API_KEY (for chat completion)
 *    - HUGGINGFACE_API_KEY (for embeddings — optional; falls back to a deterministic stub)
 *    - PINECONE_API_KEY
 *    - PINECONE_INDEX_NAME (default: cleanflowai-docs)
 *
 * 2. Run the script:
 *    npx ts-node --skip-project scripts/seed-rag.ts
 *
 *    Or use the API endpoint:
 *    curl -X POST http://localhost:3000/api/chat/embed \
 *      -F "file=@docs/application-flow.md" \
 *      -F "source=application-flow"
 *
 * Note: The Pinecone index must be created with dimension 384 (for sentence-transformers/all-MiniLM-L6-v2).
 */

import fs from 'fs'
import path from 'path'

async function seedDocumentation() {
  const docPath = path.join(process.cwd(), 'docs', 'application-flow.md')
  
  if (!fs.existsSync(docPath)) {
    console.error('Documentation file not found:', docPath)
    process.exit(1)
  }

  const content = fs.readFileSync(docPath, 'utf-8')
  
  console.log('Documentation loaded:', content.length, 'characters')
  console.log('\nTo seed this documentation, either:')
  console.log('1. Use the chat drawer upload feature in the app')
  console.log('2. Or run the following curl command:\n')
  console.log(`curl -X POST http://localhost:3000/api/chat/embed \\
  -F "file=@docs/application-flow.md" \\
  -F "source=application-flow"`)
}

seedDocumentation()
