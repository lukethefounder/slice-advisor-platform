/** Browser-safe task validation and calendar math. Dates are calendar days, not UTC instants. */
export const TASK_STATUSES = ["To Do", "In Progress", "In Review", "Blocked", "Complete"] as const;
export const TASK_PRIORITIES = ["Low", "Medium", "High", "Critical"] as const;
export type TaskStatus = typeof TASK_STATUSES[number];
export type TaskPriority = typeof TASK_PRIORITIES[number];
export class TaskError extends Error { constructor(public code:string,message:string,public status=422){super(message);this.name="TaskError";} }
export type TaskActor = {userId:string;firmId:string;membershipId:string;canManage:boolean;name:string};
export type TaskInput = {requestId:string;action:"create"|"update";taskId:string;expectedUpdatedAt:string;title:string;detail:string;status:TaskStatus;priority:TaskPriority;dueDate:string|null;assigneeId:string;projectId:string|null};
export type TaskItem = {id:string;title:string;detail:string|null;status:string;priority:string;dueDate:string|null;updatedAt:string;completedAt:string|null;assigneeId:string;assigneeName:string;assigneeUserId:string;projectId:string|null;projectTitle:string|null;canEdit:boolean};
export type Member = {id:string;name:string;userId:string};
export type TaskPayload = {ok:true;scope:string;actor:TaskActor;weekStart:string;weekEnd:string;tasks:TaskItem[];members:Member[];membersLimited:boolean;projects:Array<{id:string;title:string}>;projectsLimited:boolean;total:number;nextCursor:string|null;preparedAt:string};
export function object(v:unknown):Record<string,unknown>{return v&&typeof v==="object"&&!Array.isArray(v)?v as Record<string,unknown>:{};}
export function calendarDay(v:unknown):string {if(typeof v!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v+"T12:00:00Z"))||new Date(v+"T12:00:00Z").toISOString().slice(0,10)!==v||v<"1900-01-01"||v>"2200-12-31")throw new TaskError("DATE","Choose a valid calendar date.");return v;}
export function localToday(now=new Date()):string{return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;}
export function addDays(day:string,n:number):string{const d=new Date(calendarDay(day)+"T12:00:00Z");d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
export function monday(day:string):string{const d=new Date(calendarDay(day)+"T12:00:00Z");return addDays(day,-((d.getUTCDay()+6)%7));}
export function complete(status:string){return status==="Complete"||status==="Done";}
function id(v:unknown,required=true){if(!required&&(v===null||v===undefined||v===""))return "";if(typeof v!=="string"||! /^[a-zA-Z0-9_-]{1,120}$/.test(v))throw new TaskError("ID","Select a valid task, project or team member.");return v;}
function text(v:unknown,max:number,required=false){if(typeof v!=="string"||v.includes("\0")||v.trim().length>max||required&&!v.trim())throw new TaskError("TEXT",`Provide ${required?"a nonempty":"a valid"} text value of at most ${max} characters.`);return v.trim();}
export function parseTaskInput(raw:unknown,actor:TaskActor):TaskInput{
 const b=object(raw);if(b.scope!==`${actor.userId}:${actor.firmId}`)throw new TaskError("SCOPE_CHANGED","Your active account changed. Reload before saving.",409);
 if(b.action!=="create"&&b.action!=="update")throw new TaskError("ACTION","Choose a supported task action.");
 const status=b.status as TaskStatus,priority=b.priority as TaskPriority;
 if(!TASK_STATUSES.includes(status)||!TASK_PRIORITIES.includes(priority))throw new TaskError("STATUS","Choose a supported status and priority.");
 const expected=b.action==="update"?String(b.expectedUpdatedAt??""):"";
 if(b.action==="update"&&(!Number.isFinite(Date.parse(expected))||new Date(expected).toISOString()!==expected))throw new TaskError("VERSION","Reload the task before saving.",409);
 const assigneeId=id(b.assigneeId);if(!actor.canManage&&assigneeId!==actor.membershipId)throw new TaskError("ASSIGNMENT","Only a task manager can assign work to another person.",403);
 return {requestId:id(b.requestId),action:b.action,taskId:id(b.taskId,b.action==="update"),expectedUpdatedAt:expected,title:text(b.title,200,true),detail:text(b.detail??"",5000),status,priority,dueDate:b.dueDate===null||b.dueDate===""?null:calendarDay(b.dueDate),assigneeId,projectId:id(b.projectId,false)||null};
}
export function canEditTask(actor:TaskActor,ownerUserId:string){return actor.canManage||actor.userId===ownerUserId;}
export function taskGroups(items:TaskItem[],start:string){const days=Array.from({length:7},(_,i)=>addDays(start,i));return days.map(day=>({day,tasks:items.filter(t=>t.dueDate===day).sort((a,b)=>Number(complete(a.status))-Number(complete(b.status))||TASK_PRIORITIES.indexOf(b.priority as TaskPriority)-TASK_PRIORITIES.indexOf(a.priority as TaskPriority)||a.title.localeCompare(b.title))}));}
