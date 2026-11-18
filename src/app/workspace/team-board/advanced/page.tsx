"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
const Board=dynamic(()=>import("@/components/workspace/team-board-embedded"),{ssr:false,loading:()=> <p role="status">Opening advanced team tools…</p>});
export default function AdvancedTeamPage(){return <><p style={{padding:16}}><Link href="/workspace/team-board">Back to weekly Task Center</Link> · Existing reminders, documents and team tools</p><Board/></>;}
