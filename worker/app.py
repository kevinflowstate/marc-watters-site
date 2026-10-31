import hmac
import os
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from threading import Lock
from uuid import UUID

from fastapi import FastAPI, HTTPException, Header
from pydantic import BaseModel, Field
from render import process_job, allowed_url

executor=ThreadPoolExecutor(max_workers=1)
lock=Lock()
states={}

@asynccontextmanager
async def lifespan(app):
    yield
    executor.shutdown(wait=True,cancel_futures=True)

app=FastAPI(lifespan=lifespan)

class Job(BaseModel):
    job_id: UUID
    job_type: str = 'render'
    source_url: str | None = None
    fathom: dict | None = None
    cut_list: list[dict] = Field(default_factory=list,max_length=500)
    callback_url: str
    upload: dict
    output_storage_path: str

@app.get('/health')
def health():return {'ok':True}

def run(job):
    key=job['job_id']
    try:
        process_job(job)
        with lock:states[key]='done'
    except Exception:
        with lock:states[key]='failed'

@app.post('/jobs',status_code=202)
def jobs(job:Job,x_render_secret:str | None=Header(default=None)):
    secret=os.getenv('RENDER_HOST_SECRET')
    if not secret or not x_render_secret or not hmac.compare_digest(secret,x_render_secret):raise HTTPException(401,'Unauthorized')
    if job.job_type not in ('render','copy_source'):raise HTTPException(400,'Invalid job type')
    try:
        allowed_url(job.callback_url,'callback')
        if job.source_url:allowed_url(job.source_url,'media')
    except ValueError as e:raise HTTPException(400,str(e)) from None
    data=job.model_dump(mode='json');key=data['job_id']
    with lock:
        if states.get(key) in ('queued','running','done'):return {'job_id':key,'status':states[key]}
        if sum(s in ('queued','running') for s in states.values())>=3:raise HTTPException(429,'Worker queue full; retry later')
        # Bound the duplicate receipt cache; database remains the source of truth.
        if len(states)>1000:
            for old in list(states):
                if states[old] in ('done','failed'):del states[old]
        states[key]='queued'
    executor.submit(run,data)
    return {'job_id':key,'status':'queued'}
