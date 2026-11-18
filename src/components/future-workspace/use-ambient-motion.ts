"use client";
import { useEffect, useRef, useState } from "react";
/** No animation-frame loop. CSS motion stops off-screen, in hidden tabs or under reduced motion. */
export function useAmbientMotion(enabled=true){
 const ref=useRef<HTMLElement|null>(null);
 const [visible,setVisible]=useState(false),[paused,setPaused]=useState(false);
 useEffect(()=>{
  const node=ref.current;if(!node)return;
  const media=window.matchMedia("(prefers-reduced-motion: reduce)");let inView=true;
  const update=()=>setVisible(!document.hidden&&!media.matches&&inView&&document.documentElement.dataset.sliceEffects!=="quiet"&&document.documentElement.dataset.sliceMotion!=="reduced");
  const observer=typeof IntersectionObserver==="function"?new IntersectionObserver(([entry])=>{inView=entry.isIntersecting;update();},{rootMargin:"40px"}):null;
  observer?.observe(node);update();document.addEventListener("visibilitychange",update);media.addEventListener("change",update);window.addEventListener("slice-display-effects-change",update);window.addEventListener("slice-workspace-settings-change",update);
  return()=>{observer?.disconnect();document.removeEventListener("visibilitychange",update);media.removeEventListener("change",update);window.removeEventListener("slice-display-effects-change",update);window.removeEventListener("slice-workspace-settings-change",update);};
 },[]);
 return {ref,moving:enabled&&visible&&!paused,paused,toggle:()=>setPaused(v=>!v)};
}
