alter table public.charging_sessions
  add column if not exists payment_status text not null default 'UNPAID',
  add column if not exists razorpay_order_id text,
  add column if not exists razorpay_payment_id text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.charging_sessions'::regclass
      and conname = 'charging_sessions_payment_status_check'
  ) then
    alter table public.charging_sessions
      add constraint charging_sessions_payment_status_check
      check (payment_status in ('UNPAID', 'PENDING', 'PAID'));
  end if;
end;
$$;

create unique index if not exists charging_sessions_razorpay_payment_id_idx
  on public.charging_sessions (razorpay_payment_id)
  where razorpay_payment_id is not null;

revoke update on public.charging_sessions from authenticated;
notify pgrst, 'reload schema';
