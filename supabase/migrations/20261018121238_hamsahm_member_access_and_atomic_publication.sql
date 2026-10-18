-- Hamsahm member access foundation. Apply only to the selected Supabase project.
-- This is not a bank verifier or an automatic migration of the offline ledger.
begin;
create schema if not exists hamsahm_private;
revoke all on schema hamsahm_private from public, anon;
grant usage on schema hamsahm_private to authenticated;

create table public.hamsahm_funds (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id),
 name text not null check (length(btrim(name)) between 1 and 100),
 payment_url text not null default '' check (payment_url='' or (length(payment_url)<=2000 and payment_url ~ '^https://[^/@[:space:]]+([/?#]|$)')),
 snapshot_revision bigint not null default 0,
 created_at timestamptz not null default now()
);
create table public.hamsahm_memberships (
 id uuid primary key default gen_random_uuid(),
 fund_id uuid not null references public.hamsahm_funds(id),
 user_id uuid not null references auth.users(id),
 display_name text not null check (length(btrim(display_name)) between 1 and 100),
 status text not null default 'pending' check (status in ('pending','approved','rejected','suspended')),
 local_member_id text check (length(local_member_id) between 1 and 100),
 decision_note text not null default '' check(length(decision_note)<=500),
 decided_by uuid references auth.users(id),
 decided_at timestamptz,
 created_at timestamptz not null default now(),
 unique(fund_id,user_id), unique(fund_id,local_member_id), unique(fund_id,id),
 check(status<>'approved' or (local_member_id is not null and decided_by is not null and decided_at is not null))
);
create table public.hamsahm_confirmations (
 id uuid primary key default gen_random_uuid(),
 fund_id uuid not null,
 membership_id uuid not null,
 source_reference text not null check(length(btrim(source_reference)) between 1 and 100),
 kind text not null check(kind in ('deposit','repayment')),
 amount bigint not null check(amount between 1 and 1000000000000),
 payment_date date not null check(payment_date between '1900-01-01' and '2200-12-31'),
 confirmed_by uuid not null references auth.users(id),
 confirmed_at timestamptz not null default now(),
 revoked_at timestamptz, revoke_reason text check(length(revoke_reason)<=500),
 foreign key(fund_id,membership_id) references public.hamsahm_memberships(fund_id,id),
 unique(fund_id,source_reference)
);
create index hamsahm_confirmations_gate on public.hamsahm_confirmations(fund_id,membership_id) where revoked_at is null;
create table public.hamsahm_fund_summaries (
 fund_id uuid primary key references public.hamsahm_funds(id),
 balance bigint not null check(balance between 0 and 9007199254740991),
 total_deposits bigint not null check(total_deposits between 0 and 9007199254740991),
 total_repayments bigint not null check(total_repayments between 0 and 9007199254740991),
 total_loans bigint not null check(total_loans between 0 and 9007199254740991),
 total_expenses bigint not null check(total_expenses between 0 and 9007199254740991),
 as_of date not null check(as_of between '1900-01-01' and '2200-12-31'),
 check(balance=total_deposits+total_repayments-total_loans-total_expenses)
);
create table public.hamsahm_account_summaries (
 fund_id uuid not null,
 membership_id uuid not null,
 total_deposits bigint not null check(total_deposits between 0 and 9007199254740991),
 share_debt bigint not null check(share_debt between 0 and 9007199254740991),
 loan_debt bigint not null check(loan_debt between 0 and 9007199254740991),
 overdue bigint not null check(overdue between 0 and loan_debt),
 next_due date, next_amount bigint,
 as_of date not null check(as_of between '1900-01-01' and '2200-12-31'),
 primary key(fund_id,membership_id),
 foreign key(fund_id,membership_id) references public.hamsahm_memberships(fund_id,id),
 check ((next_due is null and next_amount is null) or (next_due is not null and next_amount is not null and next_amount between 1 and 1000000000000))
);
create table public.hamsahm_access_audit (
 id uuid primary key default gen_random_uuid(), fund_id uuid not null references public.hamsahm_funds(id),
 actor_id uuid not null references auth.users(id), event text not null,
 subject_id uuid, details jsonb not null default '{}', created_at timestamptz not null default now()
);

create index hamsahm_funds_owner on public.hamsahm_funds(owner_id);
create index hamsahm_memberships_user on public.hamsahm_memberships(user_id);
create index hamsahm_memberships_decider on public.hamsahm_memberships(decided_by);
create index hamsahm_confirmations_member on public.hamsahm_confirmations(fund_id,membership_id);
create index hamsahm_confirmations_actor on public.hamsahm_confirmations(confirmed_by);
create index hamsahm_audit_fund on public.hamsahm_access_audit(fund_id);
create index hamsahm_audit_actor on public.hamsahm_access_audit(actor_id);

create function hamsahm_private.is_owner(fid uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.hamsahm_funds where id=fid and owner_id=(select auth.uid()));
$$;
create function hamsahm_private.can_view(fid uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.hamsahm_memberships m where m.fund_id=fid and m.user_id=(select auth.uid()) and m.status='approved'
 and exists(select 1 from public.hamsahm_confirmations c where c.fund_id=m.fund_id and c.membership_id=m.id and c.revoked_at is null));
$$;
create function hamsahm_private.is_own_membership(fid uuid,mid uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.hamsahm_memberships m where m.fund_id=fid and m.id=mid and m.user_id=(select auth.uid()));
$$;
revoke all on function hamsahm_private.is_owner(uuid),hamsahm_private.can_view(uuid),hamsahm_private.is_own_membership(uuid,uuid) from public,anon,authenticated;
grant execute on function hamsahm_private.is_owner(uuid),hamsahm_private.can_view(uuid),hamsahm_private.is_own_membership(uuid,uuid) to authenticated;

alter table public.hamsahm_funds enable row level security;
alter table public.hamsahm_memberships enable row level security;
alter table public.hamsahm_confirmations enable row level security;
alter table public.hamsahm_fund_summaries enable row level security;
alter table public.hamsahm_account_summaries enable row level security;
alter table public.hamsahm_access_audit enable row level security;
revoke all on public.hamsahm_funds,public.hamsahm_memberships,public.hamsahm_confirmations,public.hamsahm_fund_summaries,public.hamsahm_account_summaries,public.hamsahm_access_audit from public,anon,authenticated;
grant select on public.hamsahm_funds,public.hamsahm_memberships,public.hamsahm_confirmations,public.hamsahm_fund_summaries,public.hamsahm_account_summaries,public.hamsahm_access_audit to authenticated;
grant insert,update on public.hamsahm_fund_summaries,public.hamsahm_account_summaries to authenticated;
-- Owner identity, membership decisions and confirmations have no direct client write path.
create policy funds_owner_read on public.hamsahm_funds for select to authenticated using(owner_id=(select auth.uid()));
create policy membership_read on public.hamsahm_memberships for select to authenticated using(user_id=(select auth.uid()) or hamsahm_private.is_owner(fund_id));
create policy confirmations_read on public.hamsahm_confirmations for select to authenticated using(hamsahm_private.is_owner(fund_id) or (hamsahm_private.can_view(fund_id) and hamsahm_private.is_own_membership(fund_id,membership_id)));
create policy summary_read on public.hamsahm_fund_summaries for select to authenticated using(hamsahm_private.is_owner(fund_id) or hamsahm_private.can_view(fund_id));
create policy summary_insert on public.hamsahm_fund_summaries for insert to authenticated with check(hamsahm_private.is_owner(fund_id));
create policy summary_update on public.hamsahm_fund_summaries for update to authenticated using(hamsahm_private.is_owner(fund_id)) with check(hamsahm_private.is_owner(fund_id));
create policy account_read on public.hamsahm_account_summaries for select to authenticated using(hamsahm_private.is_owner(fund_id) or (hamsahm_private.can_view(fund_id) and hamsahm_private.is_own_membership(fund_id,membership_id)));
create policy account_insert on public.hamsahm_account_summaries for insert to authenticated with check(hamsahm_private.is_owner(fund_id));
create policy account_update on public.hamsahm_account_summaries for update to authenticated using(hamsahm_private.is_owner(fund_id)) with check(hamsahm_private.is_owner(fund_id));
create policy audit_owner_read on public.hamsahm_access_audit for select to authenticated using(hamsahm_private.is_owner(fund_id));

create function public.hamsahm_create_fund(fund_name text,payment_url text default '') returns uuid
language plpgsql security definer set search_path='' as $$
declare fid uuid; uid uuid:=auth.uid();
begin
 if uid is null then raise exception 'Authentication required' using errcode='42501';end if;
 insert into public.hamsahm_funds(owner_id,name,payment_url) values(uid,btrim(fund_name),payment_url) returning id into fid;
 insert into public.hamsahm_access_audit(fund_id,actor_id,event) values(fid,uid,'fund_created');
 return fid;
end;$$;
create function public.hamsahm_request_membership(fid uuid,member_name text) returns uuid
language plpgsql security definer set search_path='' as $$
declare mid uuid; uid uuid:=auth.uid();
begin
 if uid is null then raise exception 'Authentication required' using errcode='42501';end if;
 insert into public.hamsahm_memberships(fund_id,user_id,display_name) values(fid,uid,btrim(member_name)) on conflict(fund_id,user_id) do nothing;
 select id into mid from public.hamsahm_memberships where fund_id=fid and user_id=uid;return mid;
end;$$;
create function public.hamsahm_decide_membership(mid uuid,new_status text,member_key text,reason text) returns void
language plpgsql security definer set search_path='' as $$
declare m public.hamsahm_memberships;uid uuid:=auth.uid();
begin
 select * into m from public.hamsahm_memberships where id=mid for update;
 if not found or not hamsahm_private.is_owner(m.fund_id) then raise exception 'Owner required' using errcode='42501';end if;
 if new_status not in ('approved','rejected','suspended') or reason is null or length(btrim(reason))=0 then raise exception 'Invalid decision';end if;
 if m.local_member_id is distinct from member_key and exists(select 1 from public.hamsahm_confirmations where membership_id=mid) then raise exception 'Cannot relink a confirmed account';end if;
 update public.hamsahm_memberships set status=new_status,local_member_id=member_key,decision_note=btrim(reason),decided_by=uid,decided_at=now() where id=mid;
 insert into public.hamsahm_access_audit(fund_id,actor_id,event,subject_id,details) values(m.fund_id,uid,'membership_decision',mid,jsonb_build_object('status',new_status,'reason',btrim(reason)));
end;$$;
create function public.hamsahm_confirm_payment(mid uuid,source_ref text,payment_kind text,payment_amount bigint,paid_on date) returns uuid
language plpgsql security definer set search_path='' as $$
declare m public.hamsahm_memberships;cid uuid;uid uuid:=auth.uid();
begin
 select * into m from public.hamsahm_memberships where id=mid for update;
 if not found or not hamsahm_private.is_owner(m.fund_id) then raise exception 'Owner required' using errcode='42501';end if;
 if m.status<>'approved' then raise exception 'Approved membership required';end if;
 if paid_on>(now() at time zone 'Asia/Tehran')::date then raise exception 'Future payments cannot unlock access';end if;
 insert into public.hamsahm_confirmations(fund_id,membership_id,source_reference,kind,amount,payment_date,confirmed_by) values(m.fund_id,mid,btrim(source_ref),payment_kind,payment_amount,paid_on,uid) returning id into cid;
 insert into public.hamsahm_access_audit(fund_id,actor_id,event,subject_id) values(m.fund_id,uid,'payment_confirmed',cid);return cid;
end;$$;
create function public.hamsahm_revoke_payment(cid uuid,reason text) returns void
language plpgsql security definer set search_path='' as $$
declare c public.hamsahm_confirmations;
begin
 select * into c from public.hamsahm_confirmations where id=cid for update;
 if not found or not hamsahm_private.is_owner(c.fund_id) then raise exception 'Owner required' using errcode='42501';end if;
 if c.revoked_at is not null or reason is null or length(btrim(reason))=0 then raise exception 'Invalid revocation';end if;
 update public.hamsahm_confirmations set revoked_at=now(),revoke_reason=btrim(reason) where id=cid;
 insert into public.hamsahm_access_audit(fund_id,actor_id,event,subject_id,details) values(c.fund_id,auth.uid(),'payment_revoked',cid,jsonb_build_object('reason',btrim(reason)));
end;$$;
create function public.hamsahm_my_access(fid uuid) returns table(membership_status text,unlocked boolean,fund_name text,payment_url text)
language sql stable security definer set search_path='' as $$
 select m.status,hamsahm_private.can_view(fid),case when m.status='approved' then f.name else null end,case when m.status='approved' then f.payment_url else null end
 from public.hamsahm_memberships m join public.hamsahm_funds f on f.id=m.fund_id where m.fund_id=fid and m.user_id=(select auth.uid());
$$;
revoke all on function public.hamsahm_create_fund(text,text),public.hamsahm_request_membership(uuid,text),public.hamsahm_decide_membership(uuid,text,text,text),public.hamsahm_confirm_payment(uuid,text,text,bigint,date),public.hamsahm_revoke_payment(uuid,text),public.hamsahm_my_access(uuid) from public,anon,authenticated;
grant execute on function public.hamsahm_create_fund(text,text),public.hamsahm_request_membership(uuid,text),public.hamsahm_decide_membership(uuid,text,text,text),public.hamsahm_confirm_payment(uuid,text,text,bigint,date),public.hamsahm_revoke_payment(uuid,text),public.hamsahm_my_access(uuid) to authenticated;

-- A single owner-approved publication reconciles offline confirmations and summaries atomically.
create function public.hamsahm_publish_snapshot(fid uuid,expected_revision bigint,fund_name text,payment_link text,summary jsonb,accounts jsonb,payments jsonb) returns bigint
language plpgsql security definer set search_path='' as $$
declare f public.hamsahm_funds; item jsonb;mid uuid;ref text;rev bigint;uid uuid:=auth.uid();
begin
 select * into f from public.hamsahm_funds where id=fid for update;
 if not found or f.owner_id is distinct from uid then raise exception 'Owner required' using errcode='42501';end if;
 if f.snapshot_revision<>expected_revision then raise exception 'Snapshot changed; refresh before publishing';end if;
 if jsonb_typeof(summary) is distinct from 'object' or jsonb_typeof(accounts) is distinct from 'array' or jsonb_typeof(payments) is distinct from 'array' then raise exception 'Invalid snapshot';end if;
 if jsonb_array_length(accounts)>5000 or jsonb_array_length(payments)>50000 then raise exception 'Snapshot too large';end if;
 if jsonb_array_length(accounts)<>(select count(distinct value->>'membership_id') from jsonb_array_elements(accounts)) then raise exception 'Duplicate account';end if;
 if jsonb_array_length(payments)<>(select count(distinct value->>'source_reference') from jsonb_array_elements(payments)) then raise exception 'Duplicate payment';end if;
 -- Lock linked accounts so a decision cannot change their identity midway through publication.
 perform 1 from public.hamsahm_memberships where fund_id=fid order by id for update;
 for item in select value from jsonb_array_elements(accounts) loop
  mid:=(item->>'membership_id')::uuid;
  if not exists(select 1 from public.hamsahm_memberships where id=mid and fund_id=fid and status='approved') then raise exception 'Account must be approved in this fund';end if;
  insert into public.hamsahm_account_summaries(fund_id,membership_id,total_deposits,share_debt,loan_debt,overdue,next_due,next_amount,as_of)
   values(fid,mid,(item->>'total_deposits')::bigint,(item->>'share_debt')::bigint,(item->>'loan_debt')::bigint,(item->>'overdue')::bigint,(item->>'next_due')::date,(item->>'next_amount')::bigint,(summary->>'as_of')::date)
   on conflict(fund_id,membership_id) do update set total_deposits=excluded.total_deposits,share_debt=excluded.share_debt,loan_debt=excluded.loan_debt,overdue=excluded.overdue,next_due=excluded.next_due,next_amount=excluded.next_amount,as_of=excluded.as_of;
 end loop;
 -- Missing account rows are no longer published; no stale private account is exposed.
 delete from public.hamsahm_account_summaries a where a.fund_id=fid and not exists(select 1 from jsonb_array_elements(accounts) j where (j.value->>'membership_id')::uuid=a.membership_id);
 for item in select value from jsonb_array_elements(payments) loop
  mid:=(item->>'membership_id')::uuid;ref:=item->>'source_reference';
  if ref is null or ref !~ '^offline:.+' or not exists(select 1 from jsonb_array_elements(accounts) a where (a.value->>'membership_id')::uuid=mid) then raise exception 'Invalid payment account or reference';end if;
  if (item->>'payment_date')::date>(now() at time zone 'Asia/Tehran')::date then raise exception 'Future payments cannot unlock access';end if;
  if exists(select 1 from public.hamsahm_confirmations c where c.fund_id=fid and c.source_reference=ref and (c.membership_id<>mid or c.kind<>item->>'kind' or c.amount<>(item->>'amount')::bigint or c.payment_date<>(item->>'payment_date')::date or c.revoked_at is not null)) then raise exception 'Payment changed or already revoked';end if;
  insert into public.hamsahm_confirmations(fund_id,membership_id,source_reference,kind,amount,payment_date,confirmed_by)
   values(fid,mid,ref,item->>'kind',(item->>'amount')::bigint,(item->>'payment_date')::date,uid) on conflict(fund_id,source_reference) do nothing;
 end loop;
 -- An offline cancellation must also close the online gate when it was the last valid payment.
 update public.hamsahm_confirmations c set revoked_at=now(),revoke_reason='Offline publication: payment no longer active'
  where c.fund_id=fid and c.revoked_at is null and c.source_reference like 'offline:%'
  and not exists(select 1 from jsonb_array_elements(payments) j where j.value->>'source_reference'=c.source_reference);
 insert into public.hamsahm_fund_summaries(fund_id,balance,total_deposits,total_repayments,total_loans,total_expenses,as_of)
  values(fid,(summary->>'balance')::bigint,(summary->>'total_deposits')::bigint,(summary->>'total_repayments')::bigint,(summary->>'total_loans')::bigint,(summary->>'total_expenses')::bigint,(summary->>'as_of')::date)
  on conflict(fund_id) do update set balance=excluded.balance,total_deposits=excluded.total_deposits,total_repayments=excluded.total_repayments,total_loans=excluded.total_loans,total_expenses=excluded.total_expenses,as_of=excluded.as_of;
 update public.hamsahm_funds set name=btrim(fund_name),payment_url=payment_link,snapshot_revision=snapshot_revision+1 where id=fid returning snapshot_revision into rev;
 insert into public.hamsahm_access_audit(fund_id,actor_id,event,details) values(fid,uid,'snapshot_published',jsonb_build_object('revision',rev,'accounts',jsonb_array_length(accounts),'payments',jsonb_array_length(payments)));
 return rev;
end;$$;
revoke all on function public.hamsahm_publish_snapshot(uuid,bigint,text,text,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.hamsahm_publish_snapshot(uuid,bigint,text,text,jsonb,jsonb,jsonb) to authenticated;

commit;
