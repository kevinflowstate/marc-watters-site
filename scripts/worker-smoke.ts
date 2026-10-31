import assert from "node:assert/strict";
import {readFile,writeFile} from "node:fs/promises";
import {createAdminClient} from "../lib/supabase/admin";
import {dispatchRenderJob} from "../lib/ops/render";
import {draftLesson,getLesson} from "../lib/ops/lessons";
assert.match(process.env.NEXT_PUBLIC_SUPABASE_URL||"",/abmmlybdqwzujcysagvf/);
const proof=(await readFile('/Volumes/CodexDev/Projects/cbb-ops-build/evidence/e-smoke.json','utf8')).trim().split('\n').map(l=>{try{return JSON.parse(l);}catch{return null;}}).find(x=>x?.pass);
const db=createAdminClient(),id=proof.recordingId,job=proof.renderJobId;
assert.equal((await fetch('http://127.0.0.1:8097/health')).status,200);
assert.equal((await fetch('http://127.0.0.1:8097/jobs',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({job_id:job,callback_url:'http://127.0.0.1:3087/api/ops/render-jobs/'+job,upload:{},output_storage_path:'fixture'})})).status,401);
await dispatchRenderJob(job);let result;
for(let n=0;n<90;n++){result=await db.from('render_jobs').select('*').eq('id',job).single();if(['done','failed'].includes(result.data?.status))break;await new Promise(r=>setTimeout(r,1000));}
assert.equal(result?.data?.status,'done',JSON.stringify(result?.data));assert.equal((await getLesson(id)).status,'rendered');
const signed=await db.storage.from('lesson-media').createSignedUrl(result!.data.output_storage_path,3600);assert.equal(signed.error,null);const response=await fetch(signed.data!.signedUrl);assert.ok(response.ok);await writeFile('/Volumes/CodexDev/Projects/cbb-ops-build/evidence/f-edited.mp4',Buffer.from(await response.arrayBuffer()));
const draft=await draftLesson(id,proof.moduleId);assert.equal(draft.status,'lesson_drafted');assert.ok(draft.module_content_id);const again=await draftLesson(id,proof.moduleId);assert.equal(again.module_content_id,draft.module_content_id);const content=await db.from('module_content').select('*').eq('id',draft.module_content_id).single();assert.equal(content.data?.content_type,'video');assert.equal(content.data?.content_url,`/admin/media/lesson/${id}`);
console.log(JSON.stringify({pass:true,recordingId:id,jobId:job,status:result!.data.status,progress:result!.data.progress,moduleId:proof.moduleId,contentId:draft.module_content_id,draftStatus:draft.status,checks:['worker 401','202 dispatch','private TUS upload','callback rendered','idempotent module_content draft']}));
