export type HomePresentation = {
 title: string; subtitle: string; layout: "split" | "wide"; density: "comfortable" | "compact";
 showFocus: boolean; showAttention: boolean; showSources: boolean;
};
export const DEFAULT_HOME: HomePresentation = {title:"",subtitle:"One instrument. A clearer view.",layout:"split",density:"comfortable",showFocus:true,showAttention:true,showSources:false};
export function parseHomePresentation(value: unknown): HomePresentation {
 if(value===undefined)return {...DEFAULT_HOME};
 if(!value||typeof value!=="object"||Array.isArray(value))throw new Error("Workspace presentation must be an object.");
 const p=value as Record<string,unknown>,out={...DEFAULT_HOME};
 for(const [key,max] of [["title",60],["subtitle",140]] as const){if(p[key]!==undefined){if(typeof p[key]!=="string"||p[key].length>max||/[\u0000-\u001f]/.test(p[key]))throw new Error(`Keep the workspace ${key} within ${max} printable characters.`);out[key]=p[key].trim();}}
 for(const key of ["showFocus","showAttention","showSources"] as const){if(p[key]!==undefined){if(typeof p[key]!=="boolean")throw new Error(`Use a true/false value for ${key}.`);out[key]=p[key];}}
 if(p.layout!==undefined){if(p.layout!=="split"&&p.layout!=="wide")throw new Error("Choose Split or Wide layout.");out.layout=p.layout;}
 if(p.density!==undefined){if(p.density!=="comfortable"&&p.density!=="compact")throw new Error("Choose Comfortable or Compact density.");out.density=p.density;}
 return out;
}
