export type HomeSection<T> = {
    state: "ready";
    data: T;
} | {
    state: "unavailable";
    message: string;
};
export type HomeSummary = {
    ok: true;
    updatedAt: string;
    elapsedMs: number;
    identity: {
        name: string;
        firm: string;
        role: string;
    };
    clients: HomeSection<{
        count: number;
    }>;
    tasks: HomeSection<{
        count: number;
        items: Array<{
            id: string;
            title: string;
            priority: string;
            dueAt: string | null;
        }>;
    }>;
    approvals: HomeSection<{
        count: number;
    }>;
    scenarios: HomeSection<{
        count: number;
        items: Array<{
            id: string;
            name: string;
            status: string;
            lastSession: string | null;
            updatedAt: string;
        }>;
    }>;
    research: HomeSection<Array<{
        symbol: string;
        runId: string;
        asOf: string;
        createdAt: string;
    }>>;
};
