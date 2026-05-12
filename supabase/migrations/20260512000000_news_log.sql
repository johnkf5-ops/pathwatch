-- news_log — credible-source headlines pulled by /api/news-screener/cron every
-- 15 min. Public-read; no public insert (writes use the service role key).
-- See docs/superpowers/specs/2026-05-12-news-screener-design.md.

CREATE TABLE news_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fetched_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  published_at TIMESTAMPTZ,
  source_domain TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  url_hash TEXT GENERATED ALWAYS AS (md5(url)) STORED,
  query_term TEXT,
  disease TEXT DEFAULT 'hantavirus' NOT NULL
);

CREATE UNIQUE INDEX idx_news_log_url_hash ON news_log (url_hash);
CREATE INDEX idx_news_log_disease_published_at
  ON news_log (disease, published_at DESC NULLS LAST);

ALTER TABLE news_log ENABLE ROW LEVEL SECURITY;

-- Anonymous read; writes go through the service role key in the cron route.
CREATE POLICY news_log_public_read ON news_log FOR SELECT USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE news_log;

COMMENT ON TABLE news_log IS
  'Credible-source news headlines surfaced in the dashboard NewsScreener strip. '
  'Inserted by /api/news-screener/cron; deduped by url_hash; filtered to ~15 '
  'allowed domains and a 72h published_at window.';
