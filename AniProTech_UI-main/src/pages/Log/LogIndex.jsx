import { useEffect, useState } from "react";
import { Bell, Eye, CheckSquare, CalendarDays, ShieldAlert } from "lucide-react";
import { _get } from "../../utils/ApiService";
import { londonToday } from "../../components/Operations/common";
import LiveClientFeed from "../Clients/ViewClients/CarerFeed/LiveClientFeed";
import AuditHistory from "./AuditHistory";
import "./care-log.css";
const daysAgo=()=>new Date(Date.parse(londonToday())-6*86400000).toISOString().slice(0,10);
const defaults=()=>({from:daysAgo(),to:londonToday(),client:"",carer:"",group:"",activity:"all",search:""});
const duration=n=>n==null?"Not recorded":`${Math.floor(n/60)}h ${n%60}m`;
const title=s=>s==="IN_PROGRESS"?"In progress":"Completed";
export default function LogIndex(){
 const [filters,setFilters]=useState(defaults),[status,setStatus]=useState("ALL"),[page,setPage]=useState(1),[data,setData]=useState(null),[selected,setSelected]=useState(null),[loading,setLoading]=useState(false),[error,setError]=useState(""),[refresh,setRefresh]=useState(0),[audit,setAudit]=useState(false),[exporting,setExporting]=useState(false);
 useEffect(()=>{const c=new AbortController();setLoading(true);setError("");const timer=setTimeout(()=>_get("/api/care-log",{params:{...filters,status,page},signal:c.signal}).then(r=>{if(!c.signal.aborted)setData(r.data.results.data)}).catch(e=>{if(!c.signal.aborted)setError(e.response?.data?.message||"Unable to load visits")}).finally(()=>{if(!c.signal.aborted)setLoading(false)}),200);return()=>{clearTimeout(timer);c.abort()}},[filters,status,page,refresh]);
 const change=(key,value)=>{setFilters(f=>({...f,[key]:value}));setPage(1);setSelected(null)};
 const exportPdf=async()=>{
  const win=window.open("","_blank");if(!win){setError("Allow the print window to export visits.");return;}
  win.document.title="Care log";win.document.body.textContent="Preparing visit summary…";setExporting(true);setError("");
  try{let rows=[],p=1,more=true;while(more){const r=(await _get("/api/care-log",{params:{...filters,status,page:p++}})).data.results.data;rows.push(...r.items);more=r.hasMore;if(rows.length>3000)throw new Error("Choose a smaller date range to export up to 3,000 visits.");}
   if(win.closed) return;
   win.document.body.textContent="";const style=win.document.createElement("style");style.textContent="body{font:12px Arial;color:#172a45;margin:30px}article{break-inside:avoid;border-bottom:1px solid #ccc;padding:12px 0}h1{font-size:22px}@page{size:A4;margin:15mm}";win.document.head.append(style);
   const heading=win.document.createElement("h1");heading.textContent="Care log — visit summary";win.document.body.append(heading);
   const note=win.document.createElement("p");note.textContent=`${filters.from} to ${filters.to} · ${rows.length} filtered visits · Europe/London. Summary includes attendance and recorded activity counts; detailed care notes remain in the application.`;win.document.body.append(note);
   for(const v of rows){const a=win.document.createElement("article");a.textContent=`${v.clientName} — ${v.staffName} | ${v.date} ${v.startTime}–${v.endTime} | ${title(v.status)} | Actual ${duration(v.actualMinutes)} / planned ${duration(v.plannedMinutes)} | ${v.alerts} open alerts, ${v.observations} observations, ${v.activities} completed activities`;win.document.body.append(a)}
   win.focus();win.print();
  }catch(e){win.close();setError(e.response?.data?.message||e.message||"Export failed")}finally{setExporting(false)}
 };
 if(audit)return <><button className="log-back" onClick={()=>setAudit(false)}>← Back to care log</button><AuditHistory/></>;
 const counts=data?.counts||{};
 return <div className="care-log">
  <aside className="log-sidebar"><h1><CalendarDays size={19}/> Visits</h1>
   <nav aria-label="Visit status">{[["ALL","All"],["IN_PROGRESS","In progress"],["COMPLETED","Completed"]].map(([key,name])=><button key={key} className={status===key?"active":""} onClick={()=>{setStatus(key);setPage(1);setSelected(null)}}>{name}<span>{key==="ALL"?Object.values(counts).reduce((a,b)=>a+b,0):counts[key]||0}</span></button>)}</nav>
   <label>From<input type="date" value={filters.from} onChange={e=>change("from",e.target.value)}/></label><label>To<input type="date" value={filters.to} onChange={e=>change("to",e.target.value)}/></label>
   <label>Groups<select value={filters.group} onChange={e=>change("group",e.target.value)}><option value="">All carer groups</option>{data?.groups.map(g=><option key={g}>{g}</option>)}</select></label>
   <label>Client activity status<select value={filters.activity} onChange={e=>change("activity",e.target.value)}><option value="all">Show all clients</option><option value="active">Active clients</option><option value="inactive">Inactive clients</option></select></label>
   {[["client","Clients","USER"],["carer","Carers","CAREGIVER"]].map(([key,name,role])=><label key={key}>{name}<select value={filters[key]} onChange={e=>change(key,e.target.value)}><option value="">All {name.toLowerCase()}</option>{data?.people.filter(p=>p.role===role).map(p=><option value={p.id} key={p.id}>{p.name}</option>)}</select></label>)}
   <button onClick={()=>{setFilters(defaults());setStatus("ALL");setPage(1);setSelected(null)}}>Clear filters</button>
   <p className="log-help">Last 7 days by default. Filter up to 31 days. Times are shown in London time.</p><button disabled={exporting||loading||!!error||!data} onClick={exportPdf}>{exporting?"Preparing…":"Print / Save PDF"}</button><small>Exports every matching visit summary, across all pages.</small><button onClick={()=>setAudit(true)}>Audit history →</button>
  </aside>
  <section className="log-records" aria-label="Visit records"><header><input aria-label="Search visits" placeholder="Search client or carer" value={filters.search} onChange={e=>change("search",e.target.value)}/><button onClick={()=>setRefresh(n=>n+1)}>Refresh</button></header>
   {error&&<p role="alert" className="log-error">{error}</p>}
   {loading?<p className="log-empty">Loading visits…</p>:!error&&<>{!data?.items.length&&<p className="log-empty">No visits match these filters.</p>}{data?.items.map(v=><button key={v.id} className={`log-card ${selected?.id===v.id?"selected":""} ${v.overrides?"has-override":""}`} aria-pressed={selected?.id===v.id} onClick={()=>setSelected(v)}><div className="log-card-top"><span className="log-avatar">{v.clientName.split(" ").map(s=>s[0]).slice(0,2).join("")}</span><div><strong>{v.clientName}</strong><p>Visit by {v.staffName}</p></div><time>{v.date}<br/>{v.startTime}</time></div><div className="log-metrics"><span><Bell size={15}/>{v.alerts}</span><span><Eye size={15}/>{v.observations}</span><span><CheckSquare size={15}/>{v.activities}</span>{v.overrides>0&&<span className="override"><ShieldAlert size={15}/>Override review</span>}</div><footer className={v.status.toLowerCase()}><span>{title(v.status)}</span><span>{duration(v.actualMinutes)} / {duration(v.plannedMinutes)}</span></footer></button>)}</>}
   <footer className="log-pagination"><button disabled={page===1||loading} onClick={()=>setPage(p=>p-1)}>Previous</button><span>Page {page}</span><button disabled={!data?.hasMore||loading} onClick={()=>setPage(p=>p+1)}>Next</button></footer>
  </section>
  <section className="log-detail" aria-label="Visit details">{selected?<LiveClientFeed key={selected.id} visitRecord={selected} onVisitChange={()=>setRefresh(n=>n+1)}/>:<p className="log-empty">Select a card to see details.</p>}</section>
 </div>
}
