#!/usr/bin/env python3
"""Exercise publication SQL in a temporary local PostgreSQL cluster; no remote DB."""
import hashlib
import os
import random
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BIN = Path(os.environ.get("CBB_TEST_PG_BIN", "/opt/homebrew/opt/postgresql@17/bin"))
if not (BIN / "initdb").is_file():
    raise SystemExit("Set CBB_TEST_PG_BIN to a local PostgreSQL bin directory")

bootstrap = """
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS 'SELECT NULL::uuid';
CREATE TABLE public.users(id uuid PRIMARY KEY,role text NOT NULL);
CREATE TABLE public.client_profiles(id uuid PRIMARY KEY);
CREATE TABLE public.training_modules(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),title text NOT NULL,description text DEFAULT '',order_index integer DEFAULT 0,is_published boolean DEFAULT false);
CREATE TABLE public.module_content(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),module_id uuid NOT NULL REFERENCES training_modules(id) ON DELETE CASCADE,title text NOT NULL,content_type text DEFAULT 'text',content_url text,content_text text,attachments jsonb DEFAULT '[]',order_index integer DEFAULT 0,duration_minutes integer);
CREATE SCHEMA storage;
CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean DEFAULT false);
CREATE TABLE storage.objects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),bucket_id text,name text,metadata jsonb,updated_at timestamptz DEFAULT now());
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
"""
with tempfile.TemporaryDirectory(prefix="cbb-lesson-pg-") as temp:
    temp = Path(temp)
    data, socket = temp / "data", temp / "socket"
    socket.mkdir()
    started = False
    server_pid = None
    try:
        subprocess.run([str(BIN / "initdb"), "-D", str(data), "-A", "trust", "-U", "cbb_lesson_test", "--no-locale", "-E", "UTF8"], check=True, capture_output=True, text=True)
        port = random.randint(20000, 40000)
        subprocess.run([str(BIN / "pg_ctl"), "-D", str(data), "-l", str(temp / "postgres.log"), "-o", f"-k {socket} -p {port} -c listen_addresses='' -c fsync=off", "-w", "start"], check=True, capture_output=True, text=True)
        started = True
        server_pid = int((data / "postmaster.pid").read_text().splitlines()[0])
        command = [str(BIN / "psql"), "-h", str(socket), "-p", str(port), "-U", "cbb_lesson_test", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-q"]
        subprocess.run(command, input=bootstrap, text=True, check=True, capture_output=True)
        for name in ["019_ops_tasks.sql", "021_lesson_pipeline.sql", "023_ops_actions.sql", "025_ops_lesson_publication.sql"]:
            result = subprocess.run(command, input=(ROOT / "supabase/migrations" / name).read_text(), text=True, capture_output=True)
            if result.returncode:
                raise RuntimeError(name + "\n" + result.stderr)
        source = (ROOT / "fixtures/lesson-publication/verified-synthetic.mp4").read_bytes()
        checks = (ROOT / "fixtures/lesson-publication/checks.sql").read_text().replace("__MEDIA_SHA256__", hashlib.sha256(source).hexdigest()).replace("__MEDIA_BYTES__", str(len(source)))
        result = subprocess.run(command, input=checks, text=True, capture_output=True)
        if result.returncode:
            raise RuntimeError(result.stderr)
        print(result.stderr.strip())
    finally:
        if started:
            subprocess.run([str(BIN / "pg_ctl"), "-D", str(data), "-m", "fast", "-w", "stop"], check=True, capture_output=True, text=True)
            try:
                os.kill(server_pid, 0)
            except ProcessLookupError:
                print("PASS: owned temporary PostgreSQL process exited")
            else:
                raise RuntimeError("Owned PostgreSQL process remains: " + str(server_pid))
