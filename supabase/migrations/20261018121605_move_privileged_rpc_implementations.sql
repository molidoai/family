-- Expose only invoker RPC wrappers; privileged implementations stay in a non-exposed schema.
begin;
alter function public.hamsahm_create_fund(text,text) set schema hamsahm_private;
create function public.hamsahm_create_fund(fund_name text,payment_url text default '') returns uuid
language sql security invoker set search_path='' as $$ select hamsahm_private.hamsahm_create_fund(fund_name,payment_url); $$;
revoke all on function public.hamsahm_create_fund(text,text) from public,anon,authenticated;
grant execute on function public.hamsahm_create_fund(text,text) to authenticated;
alter function public.hamsahm_request_membership(uuid,text) set schema hamsahm_private;
create function public.hamsahm_request_membership(fid uuid,member_name text) returns uuid
language sql security invoker set search_path='' as $$ select hamsahm_private.hamsahm_request_membership(fid,member_name); $$;
revoke all on function public.hamsahm_request_membership(uuid,text) from public,anon,authenticated;
grant execute on function public.hamsahm_request_membership(uuid,text) to authenticated;
alter function public.hamsahm_decide_membership(uuid,text,text,text) set schema hamsahm_private;
create function public.hamsahm_decide_membership(mid uuid,new_status text,member_key text,reason text) returns void
language sql security invoker set search_path='' as $$ select hamsahm_private.hamsahm_decide_membership(mid,new_status,member_key,reason); $$;
revoke all on function public.hamsahm_decide_membership(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.hamsahm_decide_membership(uuid,text,text,text) to authenticated;
alter function public.hamsahm_confirm_payment(uuid,text,text,bigint,date) set schema hamsahm_private;
create function public.hamsahm_confirm_payment(mid uuid,source_ref text,payment_kind text,payment_amount bigint,paid_on date) returns uuid
language sql security invoker set search_path='' as $$ select hamsahm_private.hamsahm_confirm_payment(mid,source_ref,payment_kind,payment_amount,paid_on); $$;
revoke all on function public.hamsahm_confirm_payment(uuid,text,text,bigint,date) from public,anon,authenticated;
grant execute on function public.hamsahm_confirm_payment(uuid,text,text,bigint,date) to authenticated;
alter function public.hamsahm_revoke_payment(uuid,text) set schema hamsahm_private;
create function public.hamsahm_revoke_payment(cid uuid,reason text) returns void
language sql security invoker set search_path='' as $$ select hamsahm_private.hamsahm_revoke_payment(cid,reason); $$;
revoke all on function public.hamsahm_revoke_payment(uuid,text) from public,anon,authenticated;
grant execute on function public.hamsahm_revoke_payment(uuid,text) to authenticated;
alter function public.hamsahm_my_access(uuid) set schema hamsahm_private;
create function public.hamsahm_my_access(fid uuid) returns table(membership_status text,unlocked boolean,fund_name text,payment_url text)
language sql security invoker set search_path='' as $$ select * from hamsahm_private.hamsahm_my_access(fid); $$;
revoke all on function public.hamsahm_my_access(uuid) from public,anon,authenticated;
grant execute on function public.hamsahm_my_access(uuid) to authenticated;
alter function public.hamsahm_publish_snapshot(uuid,bigint,text,text,jsonb,jsonb,jsonb) set schema hamsahm_private;
create function public.hamsahm_publish_snapshot(fid uuid,expected_revision bigint,fund_name text,payment_link text,summary jsonb,accounts jsonb,payments jsonb) returns bigint
language sql security invoker set search_path='' as $$ select hamsahm_private.hamsahm_publish_snapshot(fid,expected_revision,fund_name,payment_link,summary,accounts,payments); $$;
revoke all on function public.hamsahm_publish_snapshot(uuid,bigint,text,text,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.hamsahm_publish_snapshot(uuid,bigint,text,text,jsonb,jsonb,jsonb) to authenticated;
notify pgrst, 'reload schema';
commit;
