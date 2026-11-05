"use client";
import { createContext, useContext } from "react";
export type WorkspaceSession = {
    loading: boolean;
    error: string;
    user: {
        id: string;
        name?: string;
        email?: string;
    } | null;
    firm: {
        id: string;
        name?: string;
    } | null;
    role: string;
};
export const WorkspaceSessionContext = createContext<WorkspaceSession>({ loading: true, error: "", user: null, firm: null, role: "" });
export function useWorkspaceSession() { return useContext(WorkspaceSessionContext); }
