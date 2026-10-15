"""Exercise the committed check-in migration against local PostgreSQL and repository schema/RLS.
No network listener, production credentials, production data or repository edits.
"""
import concurrent.futures
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import uuid

ROOT = Path(__file__).resolve().parents[1]
work = Path(tempfile.mkdtemp(prefix='.pg-proof-', dir=ROOT))
socket = Path(tempfile.mkdtemp(prefix='cbb-pg-', dir='/tmp'))
data = work / 'data'
started = False
pid = None
checks = []

def command(args, **kwargs):
    return subprocess.run(args, text=True, capture_output=True, check=True, **kwargs)

def sql(query, expect_error=None):
    result = subprocess.run(['psql', '-XAt', '-h', str(socket), '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'],
                            input=query, text=True, capture_output=True)
    if expect_error:
        assert result.returncode and expect_error in result.stderr, result.stderr
        return None
    assert result.returncode == 0, result.stderr
    return result.stdout.strip()

def submit(client, sid, answer='new', expect_error=None):
    # Only synthetic fixed fixtures and generated UUIDs enter this test SQL.
    return sql(f"SELECT public.submit_checkin_atomic('{client}', '{sid}', 'good', '{{\"answer\":\"{answer}\"}}');", expect_error)

def passed(name):
    checks.append(name)
    print('PASS', name, flush=True)

try:
    command(['initdb', '-D', str(data), '-A', 'trust', '--no-locale'])
    command(['pg_ctl', '-D', str(data), '-l', str(work/'postgres.log'), '-o',
             f"-k {socket} -c listen_addresses='' -c max_connections=40", '-w', 'start'])
    started = True
    pid = int((data/'postmaster.pid').read_text().splitlines()[0])
    sql("""CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
      CREATE SCHEMA auth;
      CREATE TABLE auth.users(id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb DEFAULT '{}');
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS 'SELECT NULL::uuid';
      CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS 'SELECT current_user::text';
      CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS 'SELECT jsonb_build_object(''role'', current_user)';""")
    migrations = ['supabase/migration.sql', 'supabase/migration-v2.sql', 'supabase/migration-v3.sql',
      'supabase/migrations/004_push_subscriptions.sql', 'supabase/migrations/011_client_invites.sql',
      'supabase/migrations/20260721110000_client_archiving.sql',
      'supabase/migrations/20261015100000_atomic_checkin_submission.sql']
    for migration in migrations:
        sql((ROOT/migration).read_text())
    sql("""ALTER TABLE public.checkins ADD CONSTRAINT checkins_client_week_unique UNIQUE(client_id,week_number);
      GRANT USAGE ON SCHEMA public TO service_role, anon, authenticated;
      GRANT SELECT, INSERT, UPDATE ON public.checkins, public.client_profiles TO service_role;
      ALTER TABLE public.client_profiles ADD COLUMN simulate_update_failure boolean DEFAULT false;
      CREATE FUNCTION fail_test_update() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        IF OLD.simulate_update_failure THEN RAISE EXCEPTION 'simulated_profile_failure'; END IF;
        RETURN NEW; END; $$;
      CREATE TRIGGER fail_test_update BEFORE UPDATE ON public.client_profiles
        FOR EACH ROW EXECUTE FUNCTION fail_test_update();""")
    client, other, broken, archived = [str(uuid.uuid4()) for _ in range(4)]
    for c in [client, other, broken, archived]:
        uid=str(uuid.uuid4())
        sql(f"INSERT INTO auth.users(id,email) VALUES('{uid}','{uid}@example.invalid');")
        sql(f"UPDATE public.client_profiles SET id='{c}',simulate_update_failure={str(c==broken).lower()},archived_at={'now()' if c==archived else 'NULL'} WHERE user_id='{uid}';")
    sid = str(uuid.uuid4())
    first = json.loads(submit(client,sid))
    assert first['id']==sid and first['week_number']==1 and not first['replayed']
    passed('normal save returns persisted ID, timestamp and week')
    repeat=json.loads(submit(client,sid))
    assert repeat['replayed'] and repeat['created_at']==first['created_at']
    assert sql(f"SELECT count(*) FROM checkins WHERE client_id='{client}';")=='1'
    passed('lost-response retry returns original receipt without duplicate')
    submit(client,sid,'changed',expect_error='submission_conflict')
    passed('same submission ID with changed answers cannot silently discard or overwrite')
    submit(other,sid,expect_error='submission_conflict')
    passed('submission ID cannot be reused for another client')
    concurrent_id=str(uuid.uuid4())
    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
        results=list(pool.map(lambda _:json.loads(submit(client,concurrent_id)), range(12)))
    assert sum(not r['replayed'] for r in results)==1
    assert len({r['id'] for r in results})==1
    passed('12 concurrent identical retries create exactly one record')
    ids=[str(uuid.uuid4()) for _ in range(12)]
    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
        results=list(pool.map(lambda i:json.loads(submit(client,i)), ids))
    assert sorted(r['week_number'] for r in results)==list(range(3,15))
    passed('12 concurrent distinct submissions all save with unique consecutive weeks')
    failed_id=str(uuid.uuid4())
    submit(broken,failed_id,expect_error='simulated_profile_failure')
    assert sql(f"SELECT count(*) FROM checkins WHERE id='{failed_id}';")=='0'
    passed('dashboard timestamp failure rolls back check-in instead of partial save')
    submit(archived,str(uuid.uuid4()),expect_error='client_archived')
    submit(str(uuid.uuid4()),str(uuid.uuid4()),expect_error='client_not_found')
    passed('archived and missing clients cannot submit')
    for role in ['anon','authenticated']:
        sql(f"SET ROLE {role}; SELECT public.submit_checkin_atomic('{client}','{uuid.uuid4()}','good','{{}}');",expect_error='permission denied')
    passed('RPC denied to public browser roles')
    receipt=sql(f"SET ROLE service_role; SELECT public.submit_checkin_atomic('{client}','{uuid.uuid4()}','good','{{}}');")
    assert 'week_number' in receipt
    passed('server role can execute atomic save')
    sql(f"SELECT public.submit_checkin_atomic('{client}','{uuid.uuid4()}','good','[]');",expect_error='invalid_submission')
    passed('malformed response payload fails without write')
    cancel_id=str(uuid.uuid4())
    cancelled=json.loads(sql(f"SELECT public.submit_checkin_atomic('{client}','{cancel_id}','good','{{}}',true);"))
    assert cancelled['cancelled']
    assert json.loads(sql(f"SELECT public.submit_checkin_atomic('{client}','{cancel_id}','good','{{}}');"))['cancelled']
    assert sql(f"SELECT count(*) FROM checkins WHERE id='{cancel_id}';")=='0'
    passed('cancelled pending ID blocks late in-flight saves without losing editable answers')
    settled=json.loads(sql(f"SELECT public.submit_checkin_atomic('{client}','{sid}','good','{{\"answer\":\"new\"}}',true);"))
    assert settled['id']==sid and settled['created_at']==first['created_at']
    passed('validation reconciliation returns an already-saved receipt instead of unlocking')
    race_id=str(uuid.uuid4())
    def race(cancel):
        return json.loads(sql(f"SELECT public.submit_checkin_atomic('{client}','{race_id}','good','{{}}',{str(cancel).lower()});"))
    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
        results=list(pool.map(race, [True,False]*6))
    persisted=int(sql(f"SELECT count(*) FROM checkins WHERE id='{race_id}';"))
    retired=int(sql(f"SELECT count(*) FROM cancelled_checkin_submissions WHERE id='{race_id}';"))
    assert persisted+retired==1
    assert all(r.get('cancelled') for r in results) if retired else all(r.get('id')==race_id for r in results)
    passed('12 concurrent cancellation/save attempts settle on one receipt or one retired ID, never both')

finally:
    if started:
        command(['pg_ctl','-D',str(data),'-m','fast','-w','stop'])
        try:
            os.kill(pid,0)
        except ProcessLookupError:
            pass
        else:
            raise RuntimeError(f'Owned PostgreSQL PID {pid} still running')
    shutil.rmtree(work)
    shutil.rmtree(socket)

(ROOT/'docs/checkin-save-repair/database-proof.json').write_text(json.dumps({
    'scope':'Isolated PostgreSQL 17, repository base/v2/v3/lifecycle migrations and RLS, stub Supabase auth schema, synthetic clients only; no production changes',
    'checks':checks,'passed':len(checks),'owned_postgres_pid':pid,'process_exit_verified':True,
    'limits':'Not a deployed migration or hosted Supabase integration test; auth functions are local stubs, service-role persistence and RPC grants tested with repository table schema/RLS.'},indent=2)+'\n')
print('Cleanup verified; all',len(checks),'checks passed.')
