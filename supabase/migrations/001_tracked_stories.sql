-- Migration: Tracked Stories
-- Jalankan di Supabase SQL Editor
-- Branch: feature/tracked-stories
-- Task 1: Database Migration
--
-- Actual schema as defined in Supabase (revision per user's Supabase changes)

-- Enable pgvector extension jika belum aktif
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- Tabel: stories
-- Menyimpan entitas story lintas-hari
-- ============================================================
CREATE TABLE IF NOT EXISTS stories (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title            TEXT NOT NULL,
  embedding        VECTOR(1536) NOT NULL,    -- text-embedding-3-small: 1536 dimensi
  snapshot_count   INTEGER NOT NULL DEFAULT 1,
  article_count    INTEGER NOT NULL DEFAULT 0,
  source_count     INTEGER NOT NULL DEFAULT 0,
  first_seen_at    DATE NOT NULL,
  last_seen_at     DATE NOT NULL,
  status           TEXT NOT NULL DEFAULT 'NEW'
                     CHECK (status IN ('NEW', 'ACTIVE', 'RESOLVED')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index HNSW untuk vector similarity search (cosine)
CREATE INDEX IF NOT EXISTS idx_stories_embedding
  ON stories USING hnsw (embedding vector_cosine_ops);

-- ============================================================
-- Tabel: story_snapshots
-- Menyimpan catatan harian per story
-- ============================================================
CREATE TABLE IF NOT EXISTS story_snapshots (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id      UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  cluster_name  TEXT NOT NULL,
  embedding     VECTOR(1536) NOT NULL,
  article_count INTEGER NOT NULL,
  source_count  INTEGER NOT NULL,
  summary       TEXT,               -- NULL jika LLM gagal generate
  entities      JSONB NOT NULL DEFAULT '[]'::jsonb,
  keywords      JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(story_id, snapshot_date)   -- satu snapshot per story per hari
);

-- Index untuk JOIN query (ambil semua snapshot sebuah story)
CREATE INDEX IF NOT EXISTS idx_story_snapshots_story_id
  ON story_snapshots(story_id);

-- Index untuk filter tanggal (staleness check + homepage filter)
CREATE INDEX IF NOT EXISTS idx_story_snapshots_snapshot_date
  ON story_snapshots(snapshot_date DESC);