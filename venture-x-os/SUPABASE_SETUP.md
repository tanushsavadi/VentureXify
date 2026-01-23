# Supabase Backend Setup for VentureX OS

This guide explains how to set up the Supabase backend for VentureX OS, which provides:
- **Edge Functions** for proxying API calls (Groq AI) - keeps API keys server-side
- **pgvector** for semantic search (replaces Pinecone)

## Prerequisites

1. A Supabase account (free tier works fine)
2. Supabase CLI installed: `npm install -g supabase`
3. API keys ready:
   - Groq API key (for chat)
   - HuggingFace API key (for embeddings)

## 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note down:
   - **Project URL**: `https://your-project-ref.supabase.co`
   - **Anon Key**: Found in Settings > API > `anon` key

## 2. Set Up Database Schema

Run the SQL migration to create the knowledge embeddings table:

```sql
-- File: supabase/migrations/001_initial_schema.sql

-- Enable pgvector extension
create extension if not exists vector;

-- Knowledge embeddings table for RAG
create table if not exists knowledge_embeddings (
  id text primary key,
  embedding vector(384),
  content text not null,
  title text not null,
  source text not null check (source in ('reddit-post', 'reddit-comment', 'capitalone', 'custom')),
  url text,
  author text,
  score real,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Index for vector similarity search
create index if not exists knowledge_embeddings_embedding_idx 
  on knowledge_embeddings 
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Full-text search index
create index if not exists knowledge_embeddings_content_idx 
  on knowledge_embeddings 
  using gin (to_tsvector('english', content));

-- Function for semantic search
create or replace function search_knowledge(
  query_embedding vector(384),
  match_threshold float default 0.3,
  match_count int default 5
)
returns table (
  id text,
  content text,
  title text,
  source text,
  url text,
  author text,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    ke.id,
    ke.content,
    ke.title,
    ke.source,
    ke.url,
    ke.author,
    1 - (ke.embedding <=> query_embedding) as similarity
  from knowledge_embeddings ke
  where 1 - (ke.embedding <=> query_embedding) > match_threshold
  order by ke.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- Function for upserting documents
create or replace function upsert_knowledge(
  p_id text,
  p_embedding vector(384),
  p_content text,
  p_title text,
  p_source text,
  p_url text default null,
  p_author text default null,
  p_score real default null
)
returns void
language plpgsql
as $$
begin
  insert into knowledge_embeddings (id, embedding, content, title, source, url, author, score, updated_at)
  values (p_id, p_embedding, p_content, p_title, p_source, p_url, p_author, p_score, now())
  on conflict (id) do update set
    embedding = excluded.embedding,
    content = excluded.content,
    title = excluded.title,
    source = excluded.source,
    url = excluded.url,
    author = excluded.author,
    score = excluded.score,
    updated_at = now();
end;
$$;
```

Run this in the Supabase SQL Editor (Dashboard > SQL Editor).

## 3. Deploy Edge Functions

### Link your project:

```bash
cd venture-x-os
supabase login
supabase link --project-ref your-project-ref
```

### Set environment secrets:

```bash
# Required for AI chat
supabase secrets set GROQ_API_KEY=gsk_your_groq_key

# Required for embeddings
supabase secrets set HF_API_KEY=hf_your_huggingface_key
```

### Deploy the functions:

```bash
supabase functions deploy venturex-chat
supabase functions deploy venturex-search
supabase functions deploy venturex-embed
supabase functions deploy venturex-upsert
```

## 4. Configure Extension

Update [`src/config/supabase.ts`](src/config/supabase.ts):

```typescript
// Replace with your actual project URL and anon key
export const SUPABASE_URL = 'https://your-project-ref.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...your-anon-key';
```

## 5. Test the Setup

### Test chat endpoint:

```bash
curl -X POST 'https://your-project-ref.supabase.co/functions/v1/venturex-chat' \
  -H 'Authorization: Bearer your-anon-key' \
  -H 'Content-Type: application/json' \
  -d '{"message": "What is Travel Eraser?"}'
```

### Test search endpoint:

```bash
curl -X POST 'https://your-project-ref.supabase.co/functions/v1/venturex-search' \
  -H 'Authorization: Bearer your-anon-key' \
  -H 'Content-Type: application/json' \
  -d '{"query": "portal vs direct booking", "topK": 3}'
```

## Edge Function Details

### venturex-chat
- Proxies requests to Groq API
- Includes VentureX knowledge context
- Input: `{ message, context?, ragContext?, conversationHistory? }`
- Output: `{ success, response?, error?, usage? }`

### venturex-search
- Semantic search using pgvector
- Generates query embedding via HuggingFace
- Input: `{ query, topK?, threshold? }`
- Output: `{ success, results?, error? }`

### venturex-embed
- Generates embeddings for text
- Uses HuggingFace sentence-transformers
- Input: `{ texts: string[] }`
- Output: `{ success, embeddings?, error? }`

### venturex-upsert
- Stores documents with embeddings
- Uses upsert for idempotency
- Input: `{ documents: Array<{id, embedding, content, title, source, url?, author?, score?}> }`
- Output: `{ success, upserted?, errors?, error? }`

## Architecture Overview

```
┌──────────────────────┐
│  Chrome Extension    │
│  (VentureX OS)       │
└──────────┬───────────┘
           │
           │ HTTPS (anon key)
           ▼
┌──────────────────────┐
│  Supabase Edge       │
│  Functions           │
│  ┌────────────────┐  │
│  │ venturex-chat  │◄─┼── Groq API (GROQ_API_KEY)
│  ├────────────────┤  │
│  │ venturex-search│◄─┼── HuggingFace (HF_API_KEY)
│  ├────────────────┤  │   + pgvector search
│  │ venturex-embed │◄─┼── HuggingFace
│  ├────────────────┤  │
│  │ venturex-upsert│  │
│  └────────────────┘  │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  Supabase Database   │
│  (PostgreSQL +       │
│   pgvector)          │
└──────────────────────┘
```

## Cost Considerations

- **Supabase Free Tier**: 500MB database, 2 Edge Function invocations/sec
- **Groq Free Tier**: 14,400 requests/day, very fast inference
- **HuggingFace Inference API**: Free tier available

For a personal project or small user base, this setup can run entirely on free tiers.

## Troubleshooting

### "Supabase not configured" error
- Ensure `SUPABASE_URL` and `SUPABASE_ANON_KEY` are set in `src/config/supabase.ts`

### Edge function returns 401
- Check that the anon key is correct
- Verify the function is deployed: `supabase functions list`

### Search returns no results
- Run the knowledge base update from Settings panel
- Check that embeddings were generated (look at `knowledge_embeddings` table)

### AI responses are slow
- Groq is usually very fast (<1s)
- Check Edge Function logs: `supabase functions logs venturex-chat`

## Security Notes

1. **API Keys**: Groq and HuggingFace keys are stored as Supabase secrets, never exposed to the client
2. **Anon Key**: The Supabase anon key is safe to include in client code - it only allows access to permitted operations
3. **Row Level Security**: Consider adding RLS policies if storing user-specific data
4. **Rate Limiting**: Supabase Edge Functions have built-in rate limiting

## Updating the Knowledge Base

The extension can update its knowledge base from:
1. **Reddit r/VentureX**: Scraped posts and comments
2. **Capital One Documentation**: Curated information

To update:
1. Open the extension sidebar
2. Click Settings (⚙️)
3. Click "Update Knowledge Base"

This will:
- Scrape fresh content
- Generate embeddings via Supabase
- Store in pgvector for search
