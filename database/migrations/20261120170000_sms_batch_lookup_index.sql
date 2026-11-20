create index if not exists sms_logs_batch_created_id_idx on public.sms_logs (batch_id, created_at, id);
