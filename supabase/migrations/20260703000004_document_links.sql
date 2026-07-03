-- Allow documents table to store external links in addition to uploaded files.

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'file'
    CHECK (source_type IN ('file', 'link')),
  ADD COLUMN IF NOT EXISTS external_url text;

ALTER TABLE public.documents
  ALTER COLUMN file_path DROP NOT NULL;

ALTER TABLE public.documents
  ADD CONSTRAINT documents_source_check CHECK (
    (source_type = 'file' AND file_path IS NOT NULL AND external_url IS NULL) OR
    (source_type = 'link' AND external_url IS NOT NULL)
  );

COMMENT ON COLUMN public.documents.source_type IS 'file = uploaded to storage; link = external URL';
COMMENT ON COLUMN public.documents.external_url IS 'HTTPS URL when source_type = link';
