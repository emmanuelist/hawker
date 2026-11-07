-- How a comment was entered: typed by the buyer, or a one-tap claim on the stall, which posts a
-- canonical comment such as "mine gold". The chat marks tapped comments as tapped, never as typed.
alter table comments add column via text not null default 'typed' check (via in ('typed', 'tap'));
