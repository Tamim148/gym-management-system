CREATE EXTENSION IF NOT EXISTS vector;

CREATE INDEX IF NOT EXISTS knowledge_chunk_embedding_idx
  ON "KnowledgeChunk"
  USING hnsw (embedding vector_cosine_ops);
