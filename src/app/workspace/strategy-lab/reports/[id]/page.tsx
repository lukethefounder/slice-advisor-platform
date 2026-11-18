import type { Metadata } from "next";
import ReportView from "@/components/scenario-decision/report-view";
export const metadata:Metadata={title:"Saved decision report"};
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <ReportView id={id}/>;}
