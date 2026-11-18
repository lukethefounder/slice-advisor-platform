import { StrategyError } from "../strategy-lab/contracts";
export function parseScenarioCursor(raw: unknown): { createdAt: Date; id: string }|null {
  if(raw===undefined || raw===null || raw==="") return null;
  if(typeof raw!=="string" || raw.length>180) throw new StrategyError("CURSOR","Invalid scenario cursor.",400);
  const parts=raw.split("|");const d=new Date(parts[0]);
  if(parts.length!==2 || !Number.isFinite(d.getTime()) || d.toISOString()!==parts[0] || !/^[a-zA-Z0-9_-]{1,100}$/.test(parts[1])) throw new StrategyError("CURSOR","Invalid scenario cursor.",400);
  return {createdAt:d,id:parts[1]};
}
