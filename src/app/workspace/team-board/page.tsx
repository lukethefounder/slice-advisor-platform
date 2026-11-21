import type { Metadata } from "next";
import TaskCenter from "@/components/task-center/task-center";
import FounderAgentCollaboration from "@/components/intelligence/agent-collaboration";
export const metadata: Metadata = {title: "Task Center | Slice", description: "Weekly assignments, priorities and confirmed progress for your advisory team."};
export default function TeamBoardPage(){return <><div id="founder-agent-channel" className="mx-auto max-w-[1880px] px-3 pt-4 sm:px-5 lg:px-6"><FounderAgentCollaboration mode="board" /></div><TaskCenter/></>;}
