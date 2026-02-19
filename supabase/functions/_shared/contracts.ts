export type ModelName = 'gpt-5-nano' | 'gpt-5-mini' | string;

export interface ApiMeta {
    requestId: string;
    modelUsed: ModelName;
    fallbackUsed: boolean;
    confidence: number;
    ambiguity: boolean;
    retryReason?: string;
    latencyMs?: number;
}

export interface ApiErrorBody {
    error: {
        code: 'BAD_REQUEST' | 'UNAUTHORIZED' | 'RATE_LIMITED' | 'UPSTREAM_FAILED' | 'TIMEOUT' | 'INTERNAL';
        message: string;
        requestId: string;
    };
}

