import {respond} from "@/lib/ops/http";
import {requireOps} from "@/lib/ops/auth";
import {createTask,listTasks} from "@/lib/ops/tasks";
import {taskFilters} from "@/lib/ops/http";
export async function GET(request:Request){return respond(async()=>{requireOps(request);return ({tasks:await listTasks(taskFilters(request))});});}
export async function POST(request:Request){return respond(async()=>{requireOps(request);return ({task:await createTask(await request.json(),"ops-token")});});}
