#!/usr/bin/env bash
# Exercise actual migrations against a disposable Unix-socket-only PostgreSQL database.
set -euo pipefail
repo=$(cd "$(dirname "$0")/.." && pwd)
fixture=$(mktemp -d /tmp/cbb-engagement.XXXXXXXX)
cleanup() {
  if [ -f "$fixture/pg/postmaster.pid" ]; then pg_ctl -D "$fixture/pg" -m fast -w stop >/dev/null; fi
  rm -rf -- "$fixture"
}
trap cleanup EXIT
initdb -D "$fixture/pg" --no-locale -A trust -U fixture >/dev/null
pg_ctl -D "$fixture/pg" -o "-k '$fixture' -c listen_addresses=''" -l "$fixture/log" -w start >/dev/null
psql_fixture() { psql -Xq -h "$fixture" -U fixture -d postgres -v ON_ERROR_STOP=1 "$@"; }
psql_fixture <<'SQL'
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT NULL::uuid $$;
CREATE TABLE public.users(id uuid PRIMARY KEY,role text,email text,full_name text);
CREATE TABLE public.client_profiles(id uuid PRIMARY KEY,user_id uuid REFERENCES users(id),business_name text,
  archived_at timestamptz,created_at timestamptz DEFAULT now(),last_checkin timestamptz);
CREATE TABLE public.checkins(id uuid PRIMARY KEY,client_id uuid REFERENCES client_profiles(id),week_number int,
  mood text,responses jsonb,wins text,challenges text,questions text,admin_reply text,created_at timestamptz DEFAULT now());
SQL
for name in 019_ops_tasks 020_client_admin_signals 20261015100000_atomic_checkin_submission 20261123180000_weekly_reminder_delivery 20261123180100_engagement_tasks 20261124112000_profile_checkin_prompts; do
  psql_fixture -f "$repo/supabase/migrations/$name.sql" >/dev/null
done
psql_fixture <<'SQL'
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO service_role;
INSERT INTO client_profiles(id,business_name,created_at,payment_status)
 SELECT ('00000000-0000-4000-8000-'||lpad(i::text,12,'0'))::uuid, 'Fictional client',now()-interval '20 days',
 CASE i WHEN 2 THEN 'paused' WHEN 3 THEN 'cancelled' ELSE 'current' END FROM generate_series(1,5) i;
UPDATE client_profiles SET archived_at=now() WHERE right(id::text,1)='4';
UPDATE client_profiles SET created_at=now() WHERE right(id::text,1)='5';
SQL
sweep() { psql_fixture -Atc "SET ROLE service_role; SELECT * FROM ops_reconcile_engagement_tasks();" >/dev/null; }
client=00000000-0000-4000-8000-000000000001
sweep_pids=()
for i in 1 2 3 4; do sweep & sweep_pids+=("$!"); done
for pid in "${sweep_pids[@]}"; do wait "$pid"; done
flag=$(psql_fixture -Atc "SELECT id FROM ops_tasks WHERE client_id='$client'")
[ "$(psql_fixture -Atc "SELECT count(*) FROM ops_tasks")" = 1 ]
[ "$(psql_fixture -Atc "SELECT assignee||'/'||status FROM ops_tasks WHERE id='$flag'")" = eimear/open ]
echo 'PASS concurrent sweeps created one Eimear flag and skipped paused, cancelled, archived and new clients'
psql_fixture <<SQL
UPDATE ops_tasks SET decision_note='Staff note retained' WHERE id='$flag';
INSERT INTO ops_tasks(kind,status,area,assignee,title,source,client_id,external_ref,created_by)
 VALUES ('flag','open','engagement','marc','Separate staff work','human','$client','engagement:$client:2026-W01','staff');
INSERT INTO ops_tasks(kind,status,area,title,source,client_id,external_ref,created_by)
 VALUES ('flag','open','engagement','Old system flag','system','$client','engagement:$client:2025-W52','system');
SQL
submit() { psql_fixture -Atc "SET ROLE service_role; SELECT submit_checkin_atomic('$client','$1','good','{}');" >/dev/null; }
submission=00000000-0000-4000-8000-000000000099
submit "$submission" & submission_pid=$!
sweep & sweep_pid=$!
wait "$submission_pid"; wait "$sweep_pid"
submit "$submission"; sweep
[ "$(psql_fixture -Atc "SELECT status||'/'||decision_note FROM ops_tasks WHERE id='$flag'")" = 'done/Staff note retained' ]
[ "$(psql_fixture -Atc "SELECT count(*) FROM ops_tasks WHERE source='system' AND status='open'")" = 0 ]
[ "$(psql_fixture -Atc "SELECT count(*) FROM ops_tasks WHERE source='human' AND status='open'")" = 1 ]
[ "$(psql_fixture -Atc "SELECT count(*) FROM checkins WHERE id='$submission' AND admin_reply IS NULL")" = 1 ]
echo 'PASS submitted check-in closes new and legacy flags, preserves staff work, leaves coaching reply open and survives retries'
psql_fixture -c "UPDATE ops_tasks SET created_at=now()-interval '18 days' WHERE source='system'; UPDATE checkins SET created_at=now()-interval '16 days'; UPDATE client_profiles SET last_checkin=(SELECT max(created_at) FROM checkins) WHERE id='$client';"
sweep
second=$(psql_fixture -Atc "SELECT id FROM ops_tasks WHERE source='system' AND status='open'")
[[ -n "$second" && "$second" != "$flag" ]]
psql_fixture -c "UPDATE ops_tasks SET status='done' WHERE id='$second'"
sweep
[ "$(psql_fixture -Atc "SELECT count(*) FROM ops_tasks WHERE source='system' AND status='open'")" = 0 ]
echo 'PASS later missed round has its own task; human completion stands on replay'
psql_fixture <<SQL
UPDATE ops_tasks SET status='open' WHERE id='$second';
CREATE FUNCTION block_fixture_task() RETURNS trigger LANGUAGE plpgsql AS \$\$ BEGIN RAISE EXCEPTION 'synthetic task failure'; END; \$\$;
CREATE TRIGGER block_fixture_task BEFORE UPDATE ON ops_tasks FOR EACH ROW EXECUTE FUNCTION block_fixture_task();
SQL
later=00000000-0000-4000-8000-000000000100
submit "$later"
[ "$(psql_fixture -Atc "SELECT count(*) FROM checkins WHERE id='$later'")" = 1 ]
[ "$(psql_fixture -Atc "SELECT status FROM ops_tasks WHERE id='$second'")" = open ]
psql_fixture -c "DROP TRIGGER block_fixture_task ON ops_tasks"
sweep
[ "$(psql_fixture -Atc "SELECT status FROM ops_tasks WHERE id='$second'")" = done ]
echo 'PASS task failure cannot roll back the check-in; next daily sweep repairs the task'
psql_fixture <<'SQL'
INSERT INTO client_profiles(id,created_at) VALUES ('00000000-0000-4000-8000-000000000006',now()-interval '21 days');
INSERT INTO ops_tasks(kind,area,title,source,assignee,client_id,external_ref,created_by)
 SELECT 'flag','engagement','Staff-owned collision','human','marc',id,
        'engagement:'||id||':gap-'||(extract(epoch FROM created_at)*1000000)::bigint,'staff'
 FROM client_profiles WHERE right(id::text,1)='6';
SQL
sweep
[ "$(psql_fixture -Atc "SELECT title||'/'||assignee||'/'||status FROM ops_tasks WHERE right(client_id::text,1)='6'")" = 'Staff-owned collision/marc/open' ]
echo 'PASS exact external-reference collision leaves a staff-owned task untouched'
if psql_fixture -c "SET ROLE authenticated; SELECT * FROM ops_reconcile_engagement_tasks();" >/dev/null 2>&1; then
  echo 'Unexpected browser access to engagement RPC' >&2; exit 1
fi
echo 'PASS browser role cannot invoke the reconciliation RPC'

# Changing the preference should suppress both cron channels without touching history.
psql_fixture -c "INSERT INTO users VALUES ('11111111-1111-4111-8111-111111111111','client','test@example.test','Fixture'); UPDATE client_profiles SET user_id='11111111-1111-4111-8111-111111111111' WHERE id='$client';"
psql_fixture -c "SET ROLE service_role; SELECT ops_set_checkin_prompts('$client',false,'fixture');" >/dev/null
for channel in email push; do
  [ "$(psql_fixture -Atc "SET ROLE service_role; SELECT claim_weekly_checkin_reminder('$client',date_trunc('week',now() AT TIME ZONE 'Europe/London')::date,'$channel')")" = ineligible ]
done
sweep >/dev/null
[ "$(psql_fixture -Atc "SELECT count(*) FROM ops_tasks WHERE source='system' AND client_id='$client' AND status='open'")" = 0 ]
[ "$(psql_fixture -Atc "SELECT count(*)>0 FROM checkins WHERE client_id='$client'")" = t ]
psql_fixture -c "SET ROLE service_role; SELECT ops_set_checkin_prompts('$client',true,'fixture');" >/dev/null
[ "$(psql_fixture -Atc "SELECT checkin_prompts_enabled AND checkin_prompts_resumed_at IS NOT NULL FROM client_profiles WHERE id='$client'")" = t ]
echo 'PASS disable skips both delivery channels, suppresses overdue tasks and preserves check-in history; re-enable restarts the interval'
