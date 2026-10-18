-- Preserve valid confirmations while suspended; still reconcile real cancellations.
begin;
create or replace function hamsahm_private.hamsahm_publish_snapshot(fid uuid,expected_revision bigint,fund_name text,payment_link text,summary jsonb,accounts jsonb,payments jsonb) returns bigint
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
  if not exists(select 1 from public.hamsahm_memberships where id=mid and fund_id=fid and status in ('approved','suspended','rejected') and local_member_id is not null) then raise exception 'Linked account required in this fund';end if;
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
  if exists(select 1 from public.hamsahm_memberships where id=mid and fund_id=fid and status='approved') then
  insert into public.hamsahm_confirmations(fund_id,membership_id,source_reference,kind,amount,payment_date,confirmed_by)
   values(fid,mid,ref,item->>'kind',(item->>'amount')::bigint,(item->>'payment_date')::date,uid) on conflict(fund_id,source_reference) do nothing;
  end if;
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
commit;
