#!/usr/bin/env bash
set -euo pipefail
repo=$(cd "$(dirname "$0")/.." && pwd)
fixture=$(mktemp -d /tmp/cbb-event.XXXXXXXX)
cleanup() {
  if [ -f "$fixture/pg/postmaster.pid" ]; then pg_ctl -D "$fixture/pg" -m fast -w stop >/dev/null; fi
  rm -rf -- "$fixture"
}
trap cleanup EXIT
initdb -D "$fixture/pg" --no-locale -A trust -U fixture >/dev/null
pg_ctl -D "$fixture/pg" -o "-k '$fixture' -c listen_addresses=''" -l "$fixture/log" -w start >/dev/null
db() { psql -XqAt -h "$fixture" -U fixture -d postgres -v ON_ERROR_STOP=1 "$@"; }
db <<'SQL'
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT NULL::uuid $$;
CREATE TABLE public.users(id uuid PRIMARY KEY,role text);
CREATE TABLE public.client_profiles(id uuid PRIMARY KEY);
SQL
db -f "$repo/supabase/migrations/019_ops_tasks.sql" >/dev/null
db -f "$repo/supabase/migrations/20261124114500_event_boards.sql" >/dev/null
db -c "GRANT SELECT,INSERT,UPDATE ON ops_tasks,ops_events TO service_role; GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO service_role;"
board=11111111-1111-4111-8111-111111111111
step=22222222-2222-4222-8222-222222222222
create_board="SELECT ops_create_event_board('$board','Fixture event','2027-01-14','Fixture venue','Agenda','fixture');"
db -c "SET ROLE service_role; $create_board" >/dev/null
db -c "SET ROLE service_role; $create_board" >/dev/null
[ "$(db -c "SELECT count(*) FROM ops_tasks WHERE payload->>'event_board_id'='$board'")" = 7 ]
[ "$(db -c "SELECT count(*) FROM ops_tasks WHERE area='events' AND assignee='eimear' AND due_at IS NULL")" = 7 ]
create_step="SELECT ops_create_event_step('$board','$step','Collect dietary requirements','fixture');"
id=$(db -c "SET ROLE service_role; $create_step")
[ "$(db -c "SET ROLE service_role; $create_step")" = "$id" ]
version=$(db -c "SELECT updated_at FROM ops_tasks WHERE id='$id'")
update_step() { db -c "SET ROLE service_role; SELECT ops_update_event_step('$board','$id','$1','$2','eimear','2027-01-10','$3','fixture')"; }
update_step "$version" awaiting_approval 'Which meal option?' >/dev/null
[ "$(db -c "SELECT status||'/'||assignee||'/'||(payload->>'event_note') FROM ops_tasks WHERE id='$id'")" = 'awaiting_approval/marc/Which meal option?' ]
if update_step "$version" done '' >/dev/null 2>&1; then echo 'Stale change accepted'; exit 1; fi
for next in in_progress done open; do
  version=$(db -c "SELECT updated_at FROM ops_tasks WHERE id='$id'")
  update_step "$version" "$next" 'Menu agreed' >/dev/null
  [ "$(db -c "SELECT status FROM ops_tasks WHERE id='$id'")" = "$next" ]
done
[ "$(db -c "SELECT has_function_privilege('authenticated','ops_create_event_board(uuid,text,date,text,text,text)','execute')")" = f ]
echo 'PASS seven reusable tasks, idempotent board and step creation, four lanes, owner, due date, question notes, stale-edit protection, role restrictions'
