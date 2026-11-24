"use client";
import { useEffect, useState } from "react";
export default function TeamActivity({report}:{report:string}) {
  const [data,setData]=useState<{completed:number;actions:number;activeMinutes:number}|null>(null);
  const [error,setError]=useState(false);
  useEffect(()=>{
    const controller=new AbortController();
    fetch("/api/admin/team-activity?report="+encodeURIComponent(report),{signal:controller.signal,cache:"no-store"}).then(async r=>{
      if(r.status===404 || r.status===403) return;
      if(!r.ok) throw Error();
      const d=await r.json();if(!controller.signal.aborted)setData(d);
    }).catch(()=>{if(!controller.signal.aborted)setError(true);});
    return ()=>controller.abort();
  },[report]);
  if(error) return <p>Team activity unavailable for this report.</p>;
  if(!data) return null;
  return <section className="ws-panel p-5"><h2 className="ws-h2">Eimear’s workspace activity</h2><p>{data.completed} tasks completed · {data.actions} recorded actions · {data.activeMinutes} minutes between nearby actions</p>
    <p className="ws-meta">Private to Marc. Estimated active minutes count intervals up to five minutes between recorded workspace actions. Reading, offline work and idle sign-in time are outside this measure.</p></section>;
}
