import "server-only";
import {createHash} from "node:crypto";
import {prisma} from "@/lib/prisma";
import {TaskError,calendarDay,monday,addDays,canEditTask,complete,parseTaskInput,type TaskActor,type TaskPayload} from "./core";
const selected={id:true,title:true,detail:true,status:true,priority:true,dueDate:true,updatedAt:true,createdAt:true,completedAt:true,projectId:true,project:{select:{id:true,title:true}},agenda:{select:{membershipId:true,membership:{select:{userId:true,user:{select:{name:true,email:true}}}}}}} as const;
const sha=(s:string)=>createHash("sha256").update(s).digest("hex");
export async function listTasks(actor:TaskActor,params:URLSearchParams):Promise<TaskPayload>{
 const day=calendarDay(params.get("day")),start=monday(day),end=addDays(start,6),member=params.get("member")||"",q=(params.get("q")||"").trim().slice(0,100),status=params.get("status")||"";
 if(member&&!/^[a-zA-Z0-9_-]{1,120}$/.test(member))throw new TaskError("MEMBER","Invalid team member.");
 if(status&&! ["open","complete"].includes(status))throw new TaskError("STATUS","Invalid status filter.");
 let cursor:{at:string;id:string}|null=null;
 if(params.get("cursor")){try{cursor=JSON.parse(Buffer.from(params.get("cursor")!,"base64url").toString()) as {at:string;id:string};if(!cursor||!Number.isFinite(Date.parse(cursor.at))||! /^[a-zA-Z0-9_-]{1,120}$/.test(cursor.id))throw Error();}catch{throw new TaskError("CURSOR","Reload the task list; its cursor is invalid.");}}
 const where={firmId:actor.firmId,agenda:{firmId:actor.firmId,...(member?{membershipId:member}:{})},...(q?{OR:[{title:{contains:q,mode:"insensitive" as const}},{detail:{contains:q,mode:"insensitive" as const}}]}:{}),...(status==="open"?{status:{notIn:["Complete","Done"]}}:status==="complete"?{status:{in:["Complete","Done"]}}:{}),AND:[{OR:[{dueDate:{gte:start,lte:end}},...(params.get("backlog")==="true"?[{dueDate:null},{dueDate:{lt:start},status:{notIn:["Complete","Done"]}}]:[])]}]};
 const [rows,total,members,projects]=await Promise.all([
  prisma.firmAgendaTask.findMany({where:{...where,...(cursor?{AND:[...where.AND,{OR:[{createdAt:{lt:new Date(cursor.at)}},{createdAt:new Date(cursor.at),id:{lt:cursor.id}}]}]}:{})},select:selected,orderBy:[{createdAt:"desc"},{id:"desc"}],take:101}),
  prisma.firmAgendaTask.count({where}),
  prisma.firmMembership.findMany({where:{firmId:actor.firmId,status:"Active"},select:{id:true,userId:true,user:{select:{name:true,email:true}}},orderBy:{id:"asc"},take:201}),
  prisma.firmProject.findMany({where:{firmId:actor.firmId},select:{id:true,title:true},orderBy:{title:"asc"},take:201})
 ]);
 const page=rows.slice(0,100),last=page.at(-1);
 return {ok:true,scope:`${actor.userId}:${actor.firmId}`,actor,weekStart:start,weekEnd:end,total,membersLimited:members.length>200,projectsLimited:projects.length>200,members:members.slice(0,200).map(m=>({id:m.id,userId:m.userId,name:m.user.name||m.user.email||"Team member"})),projects:projects.slice(0,200),tasks:page.map(t=>({id:t.id,title:t.title,detail:t.detail,status:t.status,priority:t.priority,dueDate:t.dueDate,updatedAt:t.updatedAt.toISOString(),completedAt:t.completedAt?.toISOString()??null,assigneeId:t.agenda.membershipId,assigneeName:t.agenda.membership.user.name||t.agenda.membership.user.email||"Team member",assigneeUserId:t.agenda.membership.userId,projectId:t.projectId,projectTitle:t.project?.title??null,canEdit:canEditTask(actor,t.agenda.membership.userId)})),nextCursor:rows.length>100&&last?Buffer.from(JSON.stringify({at:last.createdAt.toISOString(),id:last.id})).toString("base64url"):null,preparedAt:new Date().toISOString()};
}
export async function saveTask(actor:TaskActor,raw:unknown){
 const input=parseTaskInput(raw,actor),fingerprint=sha(JSON.stringify({...input,requestId:""})),key=`task-center:${actor.firmId}:${input.requestId}`;
 // Short per-firm transaction lock serializes agenda creation and request receipts.
 // No provider call or email delivery occurs while the transaction holds the lock.
 return prisma.$transaction(async tx=>{
  const lock=Number.parseInt(sha(`slice-task-center:${actor.firmId}`).slice(0,7),16);
  const held=await tx.$queryRaw<Array<{locked:boolean}>>`SELECT pg_try_advisory_xact_lock(${lock}::bigint) AS locked`;
  if(!held[0]?.locked)throw new TaskError("TASK_BUSY","Another task save is finishing. Retry this same submission shortly.",409);
  const receipt=await tx.backendPlatformEvent.findUnique({where:{userId_eventKey:{userId:actor.userId,eventKey:key}},select:{metadataJson:true}});
  if(receipt){let old:{fingerprint?:string;taskId?:string};try{old=JSON.parse(receipt.metadataJson);}catch{throw new TaskError("RECEIPT","The saved task receipt is unreadable.",409);}if(old.fingerprint!==fingerprint)throw new TaskError("REQUEST_REUSED","The request identifier belongs to different task content. Reload before submitting.",409);return {ok:true,taskId:old.taskId,replayed:true,notification:"No email was sent by Task Center."};}
  const target=await tx.firmMembership.findFirst({where:{id:input.assigneeId,firmId:actor.firmId,status:"Active"},select:{id:true,userId:true,user:{select:{name:true}}}});
  if(!target)throw new TaskError("ASSIGNEE","Select an active member of this firm.",404);
  if(input.projectId&&!await tx.firmProject.findFirst({where:{id:input.projectId,firmId:actor.firmId},select:{id:true}}))throw new TaskError("PROJECT","The selected project is unavailable in this firm.",404);
  const old=input.action==="update"?await tx.firmAgendaTask.findFirst({where:{id:input.taskId,firmId:actor.firmId},select:selected}):null;
  if(input.action==="update"&&!old)throw new TaskError("NOT_FOUND","Task not found in this firm.",404);
  if(old&&!canEditTask(actor,old.agenda.membership.userId))throw new TaskError("PERMISSION","You can edit only your assigned tasks unless you manage projects.",403);
  if(old&&old.updatedAt.toISOString()!==input.expectedUpdatedAt)throw new TaskError("EDIT_CONFLICT","This task changed in another window. Reload and review before saving.",409);
  const now=new Date(),week=monday(input.dueDate||now.toISOString().slice(0,10));
  let agenda=await tx.weeklyAgenda.findFirst({where:{firmId:actor.firmId,membershipId:target.id,weekStart:week},select:{id:true},orderBy:{createdAt:"asc"}});
  if(!agenda)agenda=await tx.weeklyAgenda.create({data:{firmId:actor.firmId,membershipId:target.id,weekStart:week,title:`${target.user.name||"Team member"}'s Weekly Agenda`,status:"Open"},select:{id:true}});
  const data={title:input.title,detail:input.detail||null,status:input.status,priority:input.priority,dueDate:input.dueDate,projectId:input.projectId,agendaId:agenda.id,completedAt:complete(input.status)?old?.completedAt??now:null,updatedAt:new Date(Math.max(now.getTime(),(old?.updatedAt.getTime()??0)+1))};
  let taskId:string;
  if(old){const updated=await tx.firmAgendaTask.updateMany({where:{id:old.id,firmId:actor.firmId,updatedAt:old.updatedAt},data});if(updated.count!==1)throw new TaskError("EDIT_CONFLICT","The task changed before saving. Reload and review.",409);taskId=old.id;}
  else taskId=(await tx.firmAgendaTask.create({data:{...data,firmId:actor.firmId},select:{id:true}})).id;
  await tx.agendaComment.create({data:{taskId,agendaId:agenda.id,userId:actor.userId,commentType:old?"Task Center Update":"Assignment Audit",body:`${old?"Updated":"Assigned"} by: ${actor.name}\nAssigned by user id: ${actor.userId}\nAssigned to: ${target.user.name}\nAssigned to user id: ${target.userId}\nStatus: ${input.status}\nDue date: ${input.dueDate||"Unscheduled"}\nNotifications: not sent by Task Center.`}});
  await tx.backendPlatformEvent.create({data:{userId:actor.userId,eventKey:key,eventType:"SLICE_TASK_CENTER_RECEIPT_V1",area:"Task Center",title:"Task save receipt",severity:"Info",status:"Saved",sourceType:"TaskCenter",sourceId:actor.firmId,metadataJson:JSON.stringify({fingerprint,taskId})}});
  return {ok:true,taskId,replayed:false,notification:"Saved to the team board. No email was sent by Task Center."};
 },{timeout:12000,maxWait:5000});
}
