-- An ended hold is final (C-5, D-020). 001 refused a change of ending (Paid ↔ Passed); this also
-- refuses ending a hold again, rewriting any part of its record, and erasing it. The one write the
-- app makes after an ending stays allowed: a Passed hold's hand-off link (passed_to_hold_id), set
-- once, from empty, to the hold it was passed to (holds.ts endHolding).
create or replace function holds_transition_guard() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    if old.state in ('Paid', 'Passed') then
      raise exception 'hold_ended: hold % is % and cannot be erased', old.id, old.state
        using errcode = 'check_violation';
    end if;
    return old;
  end if;

  if old.state in ('Paid', 'Passed') and new.state is distinct from old.state then
    raise exception 'hold_ended: hold % is % and cannot become %', old.id, old.state, new.state
      using errcode = 'check_violation';
  end if;

  if old.state in ('Paid', 'Passed') and (
       (new.serial, new.stall_id, new.show_id, new.buyer_id, new.variant_id, new.qty, new.comment_seq,
        new.invoice_id, new.waiting_since, new.holding_since, new.deadline_at, new.ended_at, new.end_reason)
       is distinct from
       (old.serial, old.stall_id, old.show_id, old.buyer_id, old.variant_id, old.qty, old.comment_seq,
        old.invoice_id, old.waiting_since, old.holding_since, old.deadline_at, old.ended_at, old.end_reason)
       or (new.passed_to_hold_id is distinct from old.passed_to_hold_id
           and not (old.state = 'Passed' and old.passed_to_hold_id is null))
     ) then
    raise exception 'hold_ended: hold % ended % and cannot be ended again or rewritten', old.id, old.state
      using errcode = 'check_violation';
  end if;

  if old.state = 'Holding' and new.state = 'Waiting' then
    raise exception 'hold_regressed: hold % cannot go from Holding back to Waiting', old.id
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists holds_transition_guard on holds;
create trigger holds_transition_guard before update or delete on holds
  for each row execute function holds_transition_guard();
