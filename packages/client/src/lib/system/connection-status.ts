export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error'

export interface ConnectionSnapshot {
    status: ConnectionStatus
    error: string | null
    lastCheckedAt: number | null
    lastSuccessfulConnectionAt: number | null
}

export const CONNECTION_QUERY_KEY = ['system', 'connection'] as const
export const HEALTH_CHECK_INTERVAL_MS = 12000

export function createConnectionSnapshot(
    status: ConnectionStatus,
    error: string | null,
    lastCheckedAt: number | null,
    lastSuccessfulConnectionAt: number | null
): ConnectionSnapshot {
    return {
        status,
        error,
        lastCheckedAt,
        lastSuccessfulConnectionAt
    }
}

export function selectConnectionStatus(snapshot?: ConnectionSnapshot): ConnectionStatus {
    return snapshot?.status ?? 'disconnected'
}

export function selectConnectionError(snapshot?: ConnectionSnapshot): string | null {
    return snapshot?.error ?? null
}

export function selectConnectionTimestamps(snapshot?: ConnectionSnapshot) {
    return {
        lastCheckedAt: snapshot?.lastCheckedAt ?? null,
        lastSuccessfulConnectionAt: snapshot?.lastSuccessfulConnectionAt ?? null
    }
}

