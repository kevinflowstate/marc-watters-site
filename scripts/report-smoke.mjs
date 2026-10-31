import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createServerClient} from '@supabase/ssr';
const base=process.env.OPS_BASE_URL||'http://127.0.0.1:3087';assert.match(process.env.NEXT_PUBLIC_SUPABASE_URL,/abmmlybdqwzujcysagvf/);assert.notEqual(process.env.OPS_REPORT_SEND_ENABLED,'true');
assert.equal((await fetch(base+'/api/cron/thursday-report')).status,401);
const response=await fetch(base+'/api/cron/thursday-report',{headers:{authorization:'Bearer '+process.env.CRON_SECRET}}),d=await response.json();assert.equal(response.status,200,JSON.stringify(d));assert.ok(d.report.data.clients.connected);assert.ok(d.report.narrative_md.includes('What happened'));assert.ok(d.report.narrative_md.includes('What needs attention'));assert.ok(d.report.narrative_md.includes('Next week'));assert.equal(d.report.data.social_planner.connected,false);
const account=JSON.parse(await readFile('/Volumes/CodexDev/Projects/cbb-ops-build/.test-account.json','utf8')),cookies=[];
const auth=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{cookies:{getAll:()=>cookies,setAll:xs=>{for(const x of xs){const i=cookies.findIndex(c=>c.name===x.name);if(i<0)cookies.push(x);else cookies[i]=x;}}}});assert.equal((await auth.auth.signInWithPassword(account)).error,null);
const headers={cookie:cookies.map(c=>`${c.name}=${c.value}`).join('; '),'content-type':'application/json'};
async function patch(body){const r=await fetch(base+'/api/admin/reports/'+d.report.id,{method:'PATCH',headers,body:JSON.stringify(body)}),out=await r.json();assert.ok(r.ok,JSON.stringify(out));return out;}
await patch({narrative_md:d.report.narrative_md,observations_md:'Synthetic acceptance observation — no email authorised.'});assert.equal((await patch({action:'review'})).report.status,'reviewed');const disabled=await patch({action:'send'});assert.equal(disabled.sent,false);assert.equal(disabled.disabled,true);assert.equal(disabled.report.status,'reviewed');
await writeFile('/Volumes/CodexDev/Projects/cbb-ops-build/evidence/g-report-draft.json',JSON.stringify(d.report,null,2));
console.log(JSON.stringify({pass:true,reportId:d.report.id,status:disabled.report.status,checks:['cron requires auth','populated source data','live AI narrative with required sections','social source not connected','review','send disabled, no email']}));
