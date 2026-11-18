"use client";
import Link from "next/link";
import type {ComponentProps,MouseEvent} from "react";
import {canonicalStudioLink,readStudioLocation,studioHref,STUDIO_PATH} from "@/lib/future-workspace/studio-route";
export type StudioNavigationDetail={href:string};
/** Native history is used only inside the combined page. Normal/new-tab links remain normal links. */
export default function StudioLink({href,onClick,...props}:ComponentProps<typeof Link>){
 let target=typeof href==="string"?canonicalStudioLink(href):href;
 if(typeof target==="string" && (target===STUDIO_PATH||target.startsWith(STUDIO_PATH+"?"))){const q=new URLSearchParams(target.split("?")[1]??"");target=studioHref(readStudioLocation(q).view,q);}
 function click(e:MouseEvent<HTMLAnchorElement>){onClick?.(e);if(e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||props.target==="_blank"||props.download||typeof target!=="string")return;
 if(!e.currentTarget.closest("[data-slice-studio-hub]"))return;
 const url=new URL(target,window.location.href);if(url.origin!==window.location.origin||url.pathname!==STUDIO_PATH)return;
 e.preventDefault();window.dispatchEvent(new CustomEvent<StudioNavigationDetail>("slice:studio-navigate",{detail:{href:url.pathname+url.search}}));
 }
 return <Link {...props} href={target} onClick={click}/>;
}
