-- A place in line ends when its item sells (D-024). Paid is final (003), so once a variant's units are
-- all paid for, a Waiting copy that asks for more than can still be sold would wait forever: an
-- ending that is neither Paid nor Passed. holds.ts ends it Passed with the reason 'sold'. This widens
-- the two checks that list Passed's reasons; nothing else about a hold's endings changes.
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'holds'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) like '%end_reason%'
      and pg_get_constraintdef(oid) like '%expired%'
      and pg_get_constraintdef(oid) like '%cancelled%'
  loop
    execute format('alter table holds drop constraint %I', c.conname);
  end loop;
end $$;

alter table holds add constraint holds_end_reason_check
  check (end_reason in ('paid', 'expired', 'cancelled', 'sold'));
alter table holds add constraint holds_passed_reason_check
  check (state <> 'Passed' or end_reason in ('expired', 'cancelled', 'sold'));
-- Only a copy that never held the item (no invoice) can end 'sold'.
alter table holds add constraint holds_sold_never_held_check
  check (end_reason is distinct from 'sold' or invoice_id is null);
