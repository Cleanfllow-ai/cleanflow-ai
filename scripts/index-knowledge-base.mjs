/**
 * One-time script — chunks RAG_CHATBOT_KNOWLEDGE_BASE.md and uploads to Pinecone.
 * Pinecone handles embedding automatically via llama-text-embed-v2 (integrated embedding).
 *
 * Run from the project root:
 *   $env:PINECONE_API_KEY="your-key-here"; node scripts/index-knowledge-base.mjs
 *
 * Re-run any time the knowledge base doc is updated.
 */

import { Pinecone } from '@pinecone-database/pinecone'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const PINECONE_API_KEY = process.env.PINECONE_API_KEY
const INDEX_NAME = 'rightrev-docs'

if (!PINECONE_API_KEY) {
  console.error('❌  PINECONE_API_KEY is not set.')
  console.error('    Run: $env:PINECONE_API_KEY="your-key"; node scripts/index-knowledge-base.mjs')
  process.exit(1)
}

const pc = new Pinecone({ apiKey: PINECONE_API_KEY })
const index = pc.index(INDEX_NAME).namespace('__default__')

// Read the knowledge base markdown
const mdPath = resolve(ROOT, 'docs/RAG_CHATBOT_KNOWLEDGE_BASE.md')
const md = readFileSync(mdPath, 'utf8')

// Split on every ## heading — one chunk per section
const chunks = md.split(/\n(?=## )/).filter(c => c.trim().length > 0)

const records = chunks.map((chunk, i) => ({
  id: `rightrev-kb-${String(i).padStart(3, '0')}`,
  text: chunk.trim(),
  section: chunk.split('\n')[0].replace(/^##\s*/, '').trim(),
  version: '1.0',
  indexed_at: new Date().toISOString().split('T')[0],
}))

console.log(`📄  Found ${records.length} chunks to index into "${INDEX_NAME}"`)

// Upsert in batches of 10
const BATCH_SIZE = 10
for (let i = 0; i < records.length; i += BATCH_SIZE) {
  const batch = records.slice(i, i + BATCH_SIZE)
  await index.upsertRecords(batch)
  console.log(`✅  Upserted chunks ${i + 1}–${Math.min(i + BATCH_SIZE, records.length)}`)
}

console.log(`\n🎉  Done! ${records.length} chunks indexed. Your chatbot is ready.`)
