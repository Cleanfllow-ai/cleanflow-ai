# RightRev — Data Quality Platform

RightRev ingests CSV files, automatically detects and fixes data quality issues, quarantines unresolvable rows for human review, and exports clean data to your ERP or data warehouse.

Live: [rightrev.vercel.app](https://rightrev.vercel.app)

## Tech Stack

- **Frontend**: Next.js 15 (App Router), TypeScript, Tailwind CSS
- **Auth**: AWS Cognito (us-east-2)
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

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Environment Variables

See [.env.sample](.env.sample) for all required keys. All `NEXT_PUBLIC_*` variables are baked in at build time — a Vercel redeploy is required after any changes.

## Key Features

- CSV upload with automatic data quality scoring (DQ score 0–100)
- 33 universal DQ rules + custom and cross-field rules
- Quarantine editor with real-time collaborative editing (up to 10 users)
- Augmentation — AI-powered column enrichment via natural language prompts
- ERP connectors: QuickBooks Online, Zoho Books
- Warehouse connector: Snowflake (import/export up to 100 GB)
- Storage connector: Google Drive
- RAG-powered in-app assistant (Pinecone + Groq)

## Branch

Active development branch: `frontend-rightrev`
