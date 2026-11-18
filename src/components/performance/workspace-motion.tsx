"use client";
import { useEffect } from "react";
/** Visibility only: no market timers, no animation-frame loop, no preference override. */
export default function WorkspaceMotion(){useEffect(()=>{const root=document.documentElement;const update=()=>{root.dataset.sliceDocumentVisible=document.hidden?"false":"true";};update();document.addEventListener("visibilitychange",update);return()=>{document.removeEventListener("visibilitychange",update);delete root.dataset.sliceDocumentVisible;};},[]);return null;}
