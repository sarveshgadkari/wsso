-- Company contact / legal fields for Assignment Instructions
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS ein_number        text,
  ADD COLUMN IF NOT EXISTS physical_address  text,
  ADD COLUMN IF NOT EXISTS mailing_address   text,
  ADD COLUMN IF NOT EXISTS phone             text,
  ADD COLUMN IF NOT EXISTS email             text;

COMMENT ON COLUMN public.companies.ein_number       IS 'Employer Identification Number (EIN)';
COMMENT ON COLUMN public.companies.physical_address IS 'Physical / street address';
COMMENT ON COLUMN public.companies.mailing_address  IS 'Mailing address (may match physical)';
COMMENT ON COLUMN public.companies.phone            IS 'Company phone number';
COMMENT ON COLUMN public.companies.email            IS 'Company email address';
