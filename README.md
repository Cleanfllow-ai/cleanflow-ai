# RightRev — Data Quality Platform

RightRev ingests CSV files, automatically detects and fixes data quality issues, quarantines unresolvable rows for human review, and exports clean data to your ERP or data warehouse.

## Tech Stack

- **Frontend**: Next.js 15 (App Router), TypeScript, Tailwind CSS
- **Auth**: AWS Cognito
- **Storage**: Amazon S3
- **Database**: DynamoDB
- **AI Chatbot**: Groq (llama-3.3-70b) + Pinecone RAG (llama-text-embed-v2)
- **Deployment**: Vercel

## Getting Started

```bash
# Install dependencies
pnpm install

# Copy env template and fill in values
cp .env.sample .env.local

# Start dev server
pnpm dev
```

## Environment Variables

See [.env.sample](.env.sample) for all required keys.

## Key Features

- CSV upload with automatic data quality scoring
- 33 universal DQ rules + custom rules
- Quarantine editor with real-time collaborative editing
- Augmentation (AI-powered column enrichment)
- ERP connectors: QuickBooks, Zoho Books
- Warehouse connector: Snowflake
- RAG-powered in-app assistant
