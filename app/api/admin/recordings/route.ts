import {adminActor,respond} from "@/lib/ops/http";
import {listLessons} from "@/lib/ops/lessons";
export async function GET(){return respond(async()=>{await adminActor();return {lessons:await listLessons()};});}
