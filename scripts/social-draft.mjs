import {readFile,writeFile} from 'node:fs/promises';
import {createSocialDraft} from '../lib/ops/social-planner.ts';
const file=process.argv[2];if(!file)throw Error('Usage: node scripts/social-draft.mjs input.json [--execute-flowstate]');const input=JSON.parse(await readFile(file,'utf8')),execute=process.argv.includes('--execute-flowstate');
if(execute)await writeFile(file+'.attempt.json',JSON.stringify({created_at:new Date().toISOString(),locationId:input.locationId}),{flag:'wx'});
const result=await createSocialDraft(input,{dryRun:!execute,token:process.env.FLOWSTATE_SOCIAL_TOKEN});if(execute)await writeFile(file+'.receipt.json',JSON.stringify(result,null,2),{flag:'wx'});console.log(JSON.stringify(result,null,2));
