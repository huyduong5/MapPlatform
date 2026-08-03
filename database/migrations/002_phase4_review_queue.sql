-- Phase 4: review queue for crawl WARNING logs
ALTER TABLE crawl_logs
  ADD COLUMN IF NOT EXISTS review_status TEXT
    CHECK (review_status IS NULL OR review_status IN ('open', 'resolved', 'ignored'));

ALTER TABLE crawl_logs
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

ALTER TABLE crawl_logs
  ADD COLUMN IF NOT EXISTS review_note TEXT;

CREATE INDEX IF NOT EXISTS crawl_logs_warning_open_idx
  ON crawl_logs (level, review_status)
  WHERE level = 'WARNING';

CREATE UNIQUE INDEX IF NOT EXISTS locations_source_record_uidx
  ON locations (source_id, source_record_id)
  WHERE source_record_id IS NOT NULL;

COMMENT ON COLUMN crawl_logs.review_status IS 'Phase 4 review queue: open|resolved|ignored (mainly for WARNING)';
