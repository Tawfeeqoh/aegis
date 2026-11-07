create schema if not exists aegis_private;
revoke all on schema aegis_private from public,anon,authenticated;
create table aegis_private.configuration(id boolean primary key default true check(id),secret_hash text not null);
create table aegis_private.workspaces(id text primary key,state jsonb not null,revision bigint not null default 0);
create table aegis_private.credentials(digest text primary key,workspace text not null,agent text not null,expires bigint not null);
alter table aegis_private.configuration enable row level security;
alter table aegis_private.workspaces enable row level security;
alter table aegis_private.credentials enable row level security;
create or replace function public.aegis_gateway(p_auth text,p_action text,p_workspace text default null,p_state jsonb default null,p_revision bigint default null,p_digest text default null,p_agent text default null,p_expires bigint default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;changed integer;
begin
 if p_auth is null or not exists(select 1 from aegis_private.configuration where secret_hash=encode(extensions.digest(p_auth,'sha256'),'hex')) then raise exception 'Not authorized' using errcode='42501';end if;
 if p_state is not null and octet_length(p_state::text)>2000000 then raise exception 'Workspace too large';end if;
 if p_action='read' then
  insert into aegis_private.workspaces(id,state) values(p_workspace,p_state) on conflict do nothing;
  select jsonb_build_object('state',state,'revision',revision) into result from aegis_private.workspaces where id=p_workspace;
 elsif p_action='cas' then
  update aegis_private.workspaces set state=p_state,revision=revision+1 where id=p_workspace and revision=p_revision;
  get diagnostics changed=row_count;result=jsonb_build_object('changed',changed=1);
 elsif p_action='credential_create' then
  if (select count(*) from aegis_private.credentials where workspace=p_workspace and expires>(extract(epoch from now())*1000)::bigint)>100 then raise exception 'Credential limit';end if;
  insert into aegis_private.credentials(digest,workspace,agent,expires) values(p_digest,p_workspace,p_agent,p_expires);result='{}';
 elsif p_action='credential_find' then
  select jsonb_build_object('workspace',workspace,'agent',agent,'expires',expires) into result from aegis_private.credentials where digest=p_digest and expires>(extract(epoch from now())*1000)::bigint;
 elsif p_action='lab_cleanup' and p_workspace like 'lab:%' then delete from aegis_private.workspaces where id=p_workspace;result='{}';
 else raise exception 'Unknown operation';end if;
 return result;
end;$$;
revoke all on function public.aegis_gateway(text,text,text,jsonb,bigint,text,text,bigint) from public;
grant execute on function public.aegis_gateway(text,text,text,jsonb,bigint,text,text,bigint) to anon;

revoke all on function public.aegis_gateway(text,text,text,jsonb,bigint,text,text,bigint) from authenticated;
