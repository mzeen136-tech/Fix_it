-- Add telegram_chat_id to technicians
ALTER TABLE public.technicians
  ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;

-- Index for telegram lookups
CREATE INDEX IF NOT EXISTS idx_techs_telegram
  ON public.technicians (telegram_chat_id)
  WHERE telegram_chat_id IS NOT NULL;