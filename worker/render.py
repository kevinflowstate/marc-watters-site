"""Bounded-memory media transfer and conservative, deterministic ffmpeg cuts."""
import base64
import json
import math
import os
from pathlib import Path
import subprocess
import tempfile
import time
from urllib.parse import urlparse

import requests


def keep_segments(duration, cuts):
    if not math.isfinite(duration) or duration <= 0:
        raise ValueError("Invalid source duration")
    removed = []
    for cut in cuts:
        start, end = float(cut['start_s']), float(cut['end_s'])
        if not all(math.isfinite(v) for v in (start, end)) or start < 0 or end > duration + 0.1 or end <= start:
            raise ValueError("Invalid cut bounds")
        if not cut.get('keep', False):
            removed.append((start, min(end, duration)))
    merged = []
    for start, end in sorted(removed):
        if merged and start <= merged[-1][1]:
            merged[-1] = (merged[-1][0], max(end, merged[-1][1]))
        else:
            merged.append((start, end))
    result, cursor = [], 0
    for start, end in merged:
        if start > cursor:
            result.append((cursor, start))
        cursor = max(cursor, end)
    if cursor < duration:
        result.append((cursor, duration))
    if not result or sum(b-a for a,b in result) < .1:
        raise ValueError("Cuts remove the entire recording")
    return result


def probe(path):
    result = subprocess.run(['ffprobe', '-v', 'error', '-show_format', '-show_streams', '-of', 'json', str(path)], capture_output=True, text=True, check=True)
    return json.loads(result.stdout)


def render(source, output, cuts, on_progress=lambda n: None):
    metadata = probe(source)
    duration = float(metadata['format']['duration'])
    segments = keep_segments(duration, cuts)
    expected = sum(end-start for start,end in segments)
    audio = any(s['codec_type'] == 'audio' for s in metadata['streams'])
    filters, inputs = [], []
    for i,(start,end) in enumerate(segments):
        filters.append(f'[0:v]trim=start={start}:end={end},setpts=PTS-STARTPTS[v{i}]')
        filters.append(f'[0:a]atrim=start={start}:end={end},asetpts=PTS-STARTPTS[a{i}]' if audio else f'anullsrc=r=48000:cl=stereo,atrim=duration={end-start}[a{i}]')
        inputs.append(f'[v{i}][a{i}]')
    filters.append(''.join(inputs)+f'concat=n={len(segments)}:v=1:a=1[v][a]')
    command = ['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(source),'-filter_complex',';'.join(filters),'-map','[v]','-map','[a]','-c:v','libx264','-crf','20','-preset','veryfast','-pix_fmt','yuv420p','-c:a','aac','-b:a','160k','-movflags','+faststart','-progress','pipe:1',str(output)]
    with tempfile.TemporaryFile(mode='w+') as errors:
        process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=errors, text=True)
        try:
            for line in process.stdout:
                if line.startswith('out_time_us='):
                    try: on_progress(min(95, int(float(line.split('=')[1]) / 1e6 / expected * 95)))
                    except ValueError: pass
            if process.wait() != 0:
                raise RuntimeError('ffmpeg render failed')
        finally:
            if process.poll() is None:
                process.terminate()
                process.wait(timeout=15)
    actual = float(probe(output)['format']['duration'])
    if abs(actual-expected) > .5:
        raise RuntimeError('Rendered duration is outside tolerance')
    return {'source_duration': duration, 'expected_duration': expected, 'actual_duration': actual, 'keep_segments': segments}


def allowed_url(url, purpose):
    parsed = urlparse(url)
    local = os.getenv('WORKER_ALLOW_LOCAL') == 'true' and parsed.hostname in ('127.0.0.1','localhost')
    if local and parsed.scheme == 'http': return url
    if parsed.scheme != 'https' or parsed.username or parsed.password: raise ValueError('HTTPS URL required')
    if purpose == 'callback':
        base = os.getenv('PORTAL_BASE_URL','')
        if not base or urlparse(base).netloc != parsed.netloc: raise ValueError('Callback host is not configured portal')
    elif not (parsed.hostname or '').endswith(('.supabase.co','.fathom.ai')):
        raise ValueError('Media host is not allowed')
    return url


def download(url, path):
    with requests.get(allowed_url(url,'media'), stream=True, timeout=(15,60), allow_redirects=False) as response:
        response.raise_for_status()
        total = 0
        with open(path,'wb') as out:
            for chunk in response.iter_content(1024*1024):
                total += len(chunk)
                if total > int(os.getenv('MAX_SOURCE_BYTES',str(8*1024**3))): raise ValueError('Source exceeds worker limit')
                out.write(chunk)


def upload(path, config):
    if config.get('signed_upload_url'):
        with open(path,'rb') as data:
            r=requests.put(allowed_url(config['signed_upload_url'],'media'),data=data,headers={'Content-Type':'video/mp4'},timeout=(15,300),allow_redirects=False)
            r.raise_for_status()
        return
    options=config['supabase']
    url=allowed_url(options['url'].rstrip('/'),'media')
    key=options.get('service_key') or os.environ['SUPABASE_SERVICE_ROLE_KEY']
    headers={'Authorization':'Bearer '+key,'apikey':key,'Tus-Resumable':'1.0.0','x-upsert':'true'}
    metadata=','.join(k+' '+base64.b64encode(v.encode()).decode() for k,v in {'bucketName':options['bucket'],'objectName':options['path'],'contentType':'video/mp4','cacheControl':'3600'}.items())
    r=requests.post(url+'/storage/v1/upload/resumable',headers={**headers,'Upload-Length':str(Path(path).stat().st_size),'Upload-Metadata':metadata},data=b'',timeout=30,allow_redirects=False)
    r.raise_for_status();location=allowed_url(r.headers['Location'],'media')
    if urlparse(location).hostname not in (urlparse(url).hostname,(urlparse(url).hostname or '').replace('.supabase.co','.storage.supabase.co')):raise ValueError('Unexpected upload host')
    offset=0
    with open(path,'rb') as data:
        while chunk:=data.read(6*1024*1024):
            r=requests.patch(location,headers={**headers,'Content-Type':'application/offset+octet-stream','Upload-Offset':str(offset)},data=chunk,timeout=(15,300),allow_redirects=False)
            r.raise_for_status();offset+=len(chunk)
            if int(r.headers.get('Upload-Offset',-1))!=offset:raise RuntimeError('Upload offset mismatch')


def source_url(job):
    if job.get('source_url'):return job['source_url']
    fathom=job.get('fathom')
    if not fathom:raise ValueError('No source download information')
    key=os.environ.get('FATHOM_API_KEY')
    if not key:raise ValueError('Fathom key is not configured on worker')
    url='https://api.fathom.ai/external/v1/recordings/'+str(fathom['recording_id'])+'/downloads/'+str(fathom['download_id'])
    for _ in range(300):
        r=requests.get(url,headers={'X-Api-Key':key},timeout=30)
        if r.status_code==429:
            time.sleep(min(60,max(2,int(r.headers.get('Retry-After','60')))));continue
        r.raise_for_status();data=r.json()
        if data['status']=='completed':return data['video']['url']
        if data['status'] in ('failed','expired'):raise ValueError('Fathom download failed or expired; retry intake')
        time.sleep(2)
    raise TimeoutError('Fathom download is still processing; retry intake')


def process_job(job):
    callback=allowed_url(job['callback_url'],'callback')
    if urlparse(callback).path != '/api/ops/render-jobs/'+job['job_id']:raise ValueError('Unexpected callback path')
    last=[-1,0.0]
    def update(status,progress=0,**extra):
        now=time.monotonic()
        if status=='running' and progress==last[0] or status=='running' and now-last[1]<2:return
        r=requests.patch(callback,json={'status':status,'progress':progress,**extra},headers={'Authorization':'Bearer '+os.environ['OPS_API_TOKEN']},timeout=30)
        r.raise_for_status();last[:]=[progress,now]
    try:
        update('running',0)
        with tempfile.TemporaryDirectory(prefix='cbb-render-') as tmp:
            source=Path(tmp)/'source.mp4';output=Path(tmp)/'edited.mp4'
            download(source_url(job),source)
            if job.get('job_type')=='copy_source':output=source
            else:render(source,output,job['cut_list'],lambda n:update('running',n))
            upload(output,job['upload'])
        update('done',100,output_storage_path=job['output_storage_path'])
    except Exception:
        # Request errors may contain signed URLs or secrets: never return raw exception text.
        try:update('failed',0,error='Worker could not complete the job; inspect private worker logs and retry.')
        except Exception:pass
        raise RuntimeError('Worker job failed') from None
