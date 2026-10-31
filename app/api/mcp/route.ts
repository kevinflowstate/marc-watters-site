import {createMcpHandler} from "mcp-handler";
import {z} from "zod";
import {requireOps} from "@/lib/ops/auth";
import {respond} from "@/lib/ops/http";
import {createTask,listTasks,updateTask,attachOutput,OpsError} from "@/lib/ops/tasks";
import {areas,assignees,statuses} from "@/lib/ops/types";
import {getClient,listClientsNeedingAttention} from "@/lib/ops/clients";
import {getLesson,listLessons,proposeCuts} from "@/lib/ops/lessons";
import {createReportDraft} from "@/lib/ops/reports";
export const runtime="nodejs";
const id=z.string().uuid(),link=z.object({label:z.string(),url:z.string(),type:z.enum(["video","image","doc","json"]).optional()});
const task={title:z.string().min(1).max(300),area:z.enum(areas),detail:z.string().optional(),assignee:z.enum(assignees).optional(),external_ref:z.string().optional(),client_id:id.optional(),due_at:z.string().optional(),links:z.array(link).optional()};
const handler=createMcpHandler(server=>{
 const run=(fn:()=>Promise<unknown>)=>fn().then(data=>({content:[{type:"text" as const,text:JSON.stringify(data)}]})).catch(e=>({isError:true,content:[{type:"text" as const,text:e instanceof OpsError?e.message:"Operation unavailable"}]}));
 server.registerTool("create_task",{description:"Add a piece of work to the team queue.",inputSchema:z.object({...task,kind:z.enum(["task","approval","flag"]).default("task")})},a=>run(()=>createTask({...a,source:"ai"},"mcp")));
 server.registerTool("list_tasks",{description:"See work filtered by status, area or owner.",inputSchema:z.object({status:z.enum(statuses).optional(),area:z.enum(areas).optional(),assignee:z.enum(assignees).optional(),clientId:id.optional()})},a=>run(()=>listTasks(a)));
 server.registerTool("update_task",{description:"Change a work item’s title, owner, due date or progress.",inputSchema:z.object({id,updates:z.object({...Object.fromEntries(Object.entries(task).map(([k,v])=>[k,v.optional()])),status:z.enum(["open","in_progress","awaiting_approval","done","cancelled"]).optional()})})},a=>run(()=>updateTask(a.id,a.updates,"mcp")));
 server.registerTool("request_approval",{description:"Put a proposed output in the human approval queue.",inputSchema:z.object(task)},a=>run(()=>createTask({...a,kind:"approval",source:"ai",status:"awaiting_approval"},"mcp")));
 server.registerTool("attach_output",{description:"Attach a finished file or design link to a work item.",inputSchema:z.object({id,output:link})},a=>run(()=>attachOutput(a.id,a.output,"mcp")));
 server.registerTool("get_client",{description:"Read a client’s payment, onboarding and engagement summary.",inputSchema:z.object({id})},a=>run(()=>getClient(a.id)));
 server.registerTool("list_clients_needing_attention",{description:"Find clients who need payment, onboarding or engagement follow-up.",inputSchema:z.object({})},()=>run(()=>listClientsNeedingAttention()));
 server.registerTool("get_lesson",{description:"Read a recording, transcript and proposed editing cuts.",inputSchema:z.object({id})},a=>run(()=>getLesson(a.id)));
 server.registerTool("list_lessons",{description:"See lesson recordings and their preparation status.",inputSchema:z.object({})},()=>run(()=>listLessons()));
 server.registerTool("propose_lesson_cuts",{description:"Prepare conservative transcript cuts for human review.",inputSchema:z.object({id})},a=>run(()=>proposeCuts(a.id)));
 server.registerTool("create_report_draft",{description:"Gather the weekly numbers into a report for review.",inputSchema:z.object({})},()=>run(()=>createReportDraft()));
},{serverInfo:{name:"cbb-ops",version:"1.0.0"}});
async function handle(request:Request){try{requireOps(request);}catch(e){return respond(async()=>{throw e;});}return handler(request);}
export {handle as GET,handle as POST,handle as DELETE};
