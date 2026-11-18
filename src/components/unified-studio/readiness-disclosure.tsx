"use client";
import dynamic from "next/dynamic";
import {useState} from "react";
import css from "./unified.module.css";
const Beta=dynamic(()=>import("@/components/strategy-lab/research-beta-banner"));
const Readiness=dynamic(()=>import("@/components/data-readiness/data-readiness-panel"));
export default function ReadinessDisclosure(){const [open,setOpen]=useState(false);return <details className={css.readiness} onToggle={e=>setOpen(e.currentTarget.open)}><summary>Research mode & storage readiness</summary>{open&&<><Beta/><Readiness/></>}</details>;}
