import type { Metadata } from "next";
import TaskCenter from "@/components/task-center/task-center";
export const metadata: Metadata = {title: "Task Center | Slice", description: "Weekly assignments, priorities and confirmed progress for your advisory team."};
export default function TeamBoardPage(){return <TaskCenter/>;}
