-- Rich-text (Google Docs-style) content for "My Work" Notion-style pages.
-- Stores sanitized HTML produced by the Tiptap editor. The old block-based
-- `blocks` column is kept for backward compatibility with existing pages —
-- the client converts legacy blocks to HTML on first open, then writes back
-- to doc_html going forward.

ALTER TABLE public.employee_work_sheets
  ADD COLUMN IF NOT EXISTS doc_html text;

COMMENT ON COLUMN public.employee_work_sheets.doc_html IS
  'Rich-text HTML content for document-type pages, authored via the Tiptap editor.';

NOTIFY pgrst, 'reload schema';
