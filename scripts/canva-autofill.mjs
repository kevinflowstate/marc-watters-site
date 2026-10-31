import {readFile,writeFile} from 'node:fs/promises';
import {autofillCanva} from '../lib/ops/canva.ts';
const file=process.argv[2];if(!file)throw Error('Usage: node scripts/canva-autofill.mjs input.json [--execute]');const input=JSON.parse(await readFile(file,'utf8')),execute=process.argv.includes('--execute');
if(execute)await writeFile(file+".attempt.json",JSON.stringify({created_at:new Date().toISOString()}),{flag:"wx"});
const result=await autofillCanva(input,{dryRun:!execute,token:process.env.CANVA_ACCESS_TOKEN,onJob:async(type,id)=>{await writeFile(file+'.'+type+'-receipt.json',JSON.stringify({type,id,created_at:new Date().toISOString()},null,2),{flag:'wx'});}});console.log(JSON.stringify(result,null,2));
