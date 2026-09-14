-- Run once in your Supabase project's SQL Editor. All application access is
-- authorized by Netlify server routes. No browser role can read these tables.
begin;
create table if not exists public.castora_events (
 id uuid primary key, owner uuid not null references auth.users(id),
 title text not null check (char_length(title) between 1 and 120),
 description text not null default '', mode text not null check(mode in ('broadcast','interactive')),
 access text not null check(access in ('public','private')), invite uuid not null,
 start timestamptz not null, status text not null default 'scheduled' check(status in ('scheduled','live','ended')),
 created timestamptz not null default now()
);
create index if not exists castora_events_owner on public.castora_events(owner);
create table if not exists public.castora_attendance (
 event uuid not null references public.castora_events(id), "user" uuid not null references auth.users(id),
 name text not null, joined bigint not null, last_seen bigint not null,
 seconds bigint not null default 0, banned boolean not null default false, speaker boolean not null default false,
 primary key(event,"user")
);
create table if not exists public.castora_recordings (
 id uuid primary key, event uuid not null references public.castora_events(id), owner uuid not null references auth.users(id),
 title text not null, key text not null unique, status text not null default 'pending' check(status in ('pending','ready')),
 created timestamptz not null default now()
);
create index if not exists castora_recordings_owner on public.castora_recordings(owner);
alter table public.castora_events enable row level security;
alter table public.castora_attendance enable row level security;
alter table public.castora_recordings enable row level security;
revoke all on public.castora_events,public.castora_attendance,public.castora_recordings from anon,authenticated;
grant all on public.castora_events,public.castora_attendance,public.castora_recordings to service_role;
create or replace function public.castora_heartbeat(p_event uuid,p_user uuid) returns void language sql set search_path='' as $$
 update public.castora_attendance set seconds=seconds+least(35,greatest(0,extract(epoch from now())::bigint-last_seen)),last_seen=extract(epoch from now())::bigint
 where event=p_event and "user"=p_user and not banned;
$$;
create or replace function public.castora_stage_permission(p_event uuid,p_user uuid,p_publish boolean) returns boolean language plpgsql set search_path='' as $$
declare n bigint; host_id uuid;
begin
 select owner into host_id from public.castora_events where id=p_event for update;
 if not found or p_user=host_id then return false; end if;
 if not exists(select 1 from public.castora_attendance where event=p_event and "user"=p_user and not banned) then return false; end if;
 if p_publish then
  select count(*) into n from public.castora_attendance where event=p_event and speaker and "user"<>p_user and "user"<>host_id;
  if n>=9 then return false; end if;
 end if;
 update public.castora_attendance set speaker=p_publish where event=p_event and "user"=p_user;
 return true;
end;
$$;
revoke all on function public.castora_heartbeat(uuid,uuid), public.castora_stage_permission(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.castora_heartbeat(uuid,uuid), public.castora_stage_permission(uuid,uuid,boolean) to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('castora-recordings','castora-recordings',false,52428800,array['video/webm','video/mp4','audio/webm','audio/mpeg','audio/mp4'])
on conflict(id) do update set public=false,file_size_limit=52428800,allowed_mime_types=excluded.allowed_mime_types;


-- Production broadcasting extensions -------------------------------------------------
create table if not exists public.castora_event_controls (
 event uuid primary key references public.castora_events(id) on delete cascade,
 owner uuid not null references auth.users(id),
 slow_mode_seconds integer not null default 3 check(slow_mode_seconds between 0 and 60),
 stage_locked boolean not null default false,
 chat_enabled boolean not null default true,
 qa_enabled boolean not null default true,
 updated timestamptz not null default now()
);
create table if not exists public.castora_invites (
 id uuid primary key, event uuid not null references public.castora_events(id) on delete cascade,
 owner uuid not null references auth.users(id), email text not null,
 status text not null default 'queued' check(status in ('queued','sent','failed')),
 sent_at timestamptz, remind_at timestamptz, reminder_sent boolean not null default false,
 created timestamptz not null default now(), unique(event,email)
);
create index if not exists castora_invites_due on public.castora_invites(remind_at) where reminder_sent=false;
create table if not exists public.castora_metrics (
 event uuid not null references public.castora_events(id) on delete cascade,
 bucket timestamptz not null,
 peak_connected integer not null default 0,
 heartbeat_count bigint not null default 0,
 primary key(event,bucket)
);
create table if not exists public.castora_cloud_recordings (
 id uuid primary key, event uuid not null references public.castora_events(id) on delete cascade,
 owner uuid not null references auth.users(id), egress_id text not null unique,
 object_key text not null, status text not null default 'recording' check(status in ('recording','stopping','complete','failed')),
 created timestamptz not null default now(), stopped timestamptz
);

alter table public.castora_event_controls enable row level security;
alter table public.castora_invites enable row level security;
alter table public.castora_metrics enable row level security;
alter table public.castora_cloud_recordings enable row level security;
revoke all on public.castora_event_controls,public.castora_invites,public.castora_metrics,public.castora_cloud_recordings from anon,authenticated;
grant all on public.castora_event_controls,public.castora_invites,public.castora_metrics,public.castora_cloud_recordings to service_role;

create or replace function public.castora_heartbeat(p_event uuid,p_user uuid) returns void language plpgsql set search_path='' as $$
declare active_count integer; minute_bucket timestamptz;
begin
 update public.castora_attendance
 set seconds=seconds+least(35,greatest(0,extract(epoch from now())::bigint-last_seen)),last_seen=extract(epoch from now())::bigint
 where event=p_event and "user"=p_user and not banned;
 select count(*)::integer into active_count from public.castora_attendance
 where event=p_event and not banned and last_seen >= extract(epoch from now())::bigint-45;
 minute_bucket:=date_trunc('minute',now());
 insert into public.castora_metrics(event,bucket,peak_connected,heartbeat_count)
 values(p_event,minute_bucket,active_count,1)
 on conflict(event,bucket) do update set
   peak_connected=greatest(public.castora_metrics.peak_connected,excluded.peak_connected),
   heartbeat_count=public.castora_metrics.heartbeat_count+1;
end;
$$;

create or replace function public.castora_stage_permission(p_event uuid,p_user uuid,p_publish boolean) returns boolean language plpgsql set search_path='' as $$
declare n bigint; host_id uuid; locked boolean;
begin
 select owner into host_id from public.castora_events where id=p_event for update;
 if not found or p_user=host_id then return false; end if;
 if not exists(select 1 from public.castora_attendance where event=p_event and "user"=p_user and not banned) then return false; end if;
 select coalesce(stage_locked,false) into locked from public.castora_event_controls where event=p_event;
 if p_publish and locked then return false; end if;
 if p_publish then
  select count(*) into n from public.castora_attendance where event=p_event and speaker and "user"<>p_user and "user"<>host_id;
  if n>=9 then return false; end if;
 end if;
 update public.castora_attendance set speaker=p_publish where event=p_event and "user"=p_user;
 return true;
end;
$$;

commit;
