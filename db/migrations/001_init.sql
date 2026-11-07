-- Hawker schema. The database enforces the claim's shape (D-005): four states, and an ended hold
-- (Paid or Passed) can never change again. PayPal stays authoritative for payment (rule 12).

create table stalls (
  id text primary key,
  name text not null,
  payment_window_seconds int not null default 600 check (payment_window_seconds between 30 and 86400),
  is_demo boolean not null default true,
  created_at timestamptz not null default now()
);

create table items (
  id serial primary key,
  stall_id text not null references stalls(id),
  code text not null,
  name text not null,
  price_cents int not null check (price_cents > 0),
  position int not null default 0,
  unique (stall_id, code)
);

create table variants (
  id serial primary key,
  item_id int not null references items(id),
  label text not null,
  stock int not null check (stock >= 0),
  unique (item_id, label)
);

create table shows (
  id serial primary key,
  stall_id text not null references stalls(id),
  title text not null,
  on_screen_item_id int references items(id),
  status text not null default 'live' check (status in ('live', 'ended')),
  started_at timestamptz not null default now()
);

create table buyers (
  id uuid primary key default gen_random_uuid(),
  stall_id text not null references stalls(id),
  handle text not null check (char_length(handle) between 2 and 25),
  device_hash text not null,
  created_at timestamptz not null default now(),
  unique (stall_id, handle)
);

-- seq is arrival order: the chat order decides who holds an item.
create table comments (
  seq bigserial primary key,
  show_id int not null references shows(id),
  buyer_id uuid not null references buyers(id),
  text text not null check (char_length(text) between 1 and 280),
  on_screen_code text,
  received_at timestamptz not null default now(),
  intent text check (intent in ('claim', 'cancel', 'question', 'unclear', 'other')),
  parsed jsonb,
  parse_source text check (parse_source in ('fast', 'groq', 'gemini', 'unavailable')),
  parse_ms int,
  outcome text
);

create table invoices (
  id text primary key,
  payer_link text not null,
  status text not null,
  total_cents int not null check (total_cents > 0),
  transaction_id text,
  last_read_at timestamptz,
  created_at timestamptz not null default now()
);

create table holds (
  id bigserial primary key,
  serial int not null,
  stall_id text not null references stalls(id),
  show_id int not null references shows(id),
  buyer_id uuid not null references buyers(id),
  variant_id int not null references variants(id),
  qty int not null check (qty between 1 and 20),
  comment_seq bigint not null references comments(seq),
  state text not null check (state in ('Waiting', 'Holding', 'Paid', 'Passed')),
  invoice_id text references invoices(id),
  waiting_since timestamptz not null default now(),
  holding_since timestamptz,
  deadline_at timestamptz,
  ended_at timestamptz,
  end_reason text check (end_reason in ('paid', 'expired', 'cancelled')),
  passed_to_hold_id bigint references holds(id),
  unique (stall_id, serial),
  -- Holding and Paid always have a PayPal invoice and a start time.
  check (state not in ('Holding', 'Paid') or (invoice_id is not null and holding_since is not null)),
  -- Holding always has a deadline and is not ended.
  check (state <> 'Holding' or (deadline_at is not null and ended_at is null)),
  -- Exactly the two endings carry an end time and reason.
  check ((state in ('Paid', 'Passed')) = (ended_at is not null and end_reason is not null)),
  check (state <> 'Paid' or end_reason = 'paid'),
  check (state <> 'Passed' or end_reason in ('expired', 'cancelled'))
);

create index holds_variant_state on holds (variant_id, state);
create index holds_due on holds (deadline_at) where state = 'Holding';
create index holds_buyer on holds (buyer_id, state);

-- Ended holds are final; Holding never goes back to Waiting.
create function holds_transition_guard() returns trigger language plpgsql as $$
begin
  if old.state in ('Paid', 'Passed') and new.state is distinct from old.state then
    raise exception 'hold_ended: hold % is % and cannot become %', old.id, old.state, new.state
      using errcode = 'check_violation';
  end if;
  if old.state = 'Holding' and new.state = 'Waiting' then
    raise exception 'hold_regressed: hold % cannot go from Holding back to Waiting', old.id
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

create trigger holds_transition_guard before update on holds
  for each row execute function holds_transition_guard();

create table events (
  id bigserial primary key,
  stall_id text not null references stalls(id),
  kind text not null,
  hold_id bigint references holds(id),
  payload jsonb not null default '{}',
  at timestamptz not null default now()
);

create index events_stall_at on events (stall_id, at desc);
