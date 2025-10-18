import { PromptlianoError } from '@promptliano/api-client'

const NETWORK_ERROR_SUBSTRINGS = [
    'failed to fetch',
    'network request failed',
    'load failed',
    'networkerror when attempting to fetch resource',
    'internet connection appears to be offline',
    'net::err',
    'timeout'
]

export function isNetworkError(error: unknown): boolean {
    if (!error) {
        return false
    }

    if (error instanceof PromptlianoError) {
        if (error.code === 'TIMEOUT') {
            return true
        }

        if (error.statusCode === undefined || error.statusCode === 0) {
            return true
        }

        const message = error.message?.toLowerCase() ?? ''
        return NETWORK_ERROR_SUBSTRINGS.some((fragment) => message.includes(fragment))
    }

    if (typeof DOMException !== 'undefined' && error instanceof DOMException && error.name === 'AbortError') {
        return true
    }

    if (error instanceof TypeError) {
        const message = error.message?.toLowerCase() ?? ''
        if (message.length === 0) {
            return true
        }
        return NETWORK_ERROR_SUBSTRINGS.some((fragment) => message.includes(fragment))
    }

    if (error instanceof Error) {
        const message = error.message?.toLowerCase() ?? ''
        if (message.length === 0) {
            return false
        }
        return NETWORK_ERROR_SUBSTRINGS.some((fragment) => message.includes(fragment))
    }

    if (typeof error === 'string') {
        const message = error.toLowerCase()
        return NETWORK_ERROR_SUBSTRINGS.some((fragment) => message.includes(fragment))
    }

    return false
}

export function isUnauthorizedResponse(error: unknown): boolean {
    if (error instanceof PromptlianoError) {
        return error.statusCode === 401 || error.statusCode === 403
    }
    return false
}

export function getNetworkErrorMessage(
    error: unknown,
    fallback: string = 'Unable to reach Promptliano server. Please check your connection.'
): string {
    if (!error) {
        return fallback
    }

    if (error instanceof PromptlianoError) {
        return error.message || fallback
    }

    if (error instanceof Error) {
        return error.message || fallback
    }

    if (typeof error === 'string' && error.trim().length > 0) {
        return error
    }

    return fallback
}

export function createNetworkTimeoutError(message = 'Request timed out'): Error {
    const timeoutError = new Error(message)
        ; (timeoutError as Record<string, unknown>).code = 'TIMEOUT'
    return timeoutError
}

export async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage?: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => {
            reject(createNetworkTimeoutError(timeoutMessage ?? 'Request timed out'))
        }, timeoutMs)

        promise
            .then((value) => {
                clearTimeout(timer)
                resolve(value)
            })
            .catch((error) => {
                clearTimeout(timer)
                reject(error)
            })
    })
}

