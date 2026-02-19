import type { ApiMeta, ModelName } from '../contracts.ts';

export const ANSWERABLE_THRESHOLD = 0.64;
export const WEAK_CONTEXT_THRESHOLD = 0.56;
export const MIN_EVIDENCE_COUNT = 2;

type ScoredDoc = { rerank_score: number };

export const assessContextQuality = (docs: ScoredDoc[]) => {
    const top1 = Number(docs?.[0]?.rerank_score ?? 0);
    const top3 = (docs || []).slice(0, 3).map((d) => Number(d.rerank_score || 0));
    const top3Avg = top3.length ? top3.reduce((a, b) => a + b, 0) / top3.length : 0;

    const insufficient = top1 < ANSWERABLE_THRESHOLD || top3Avg < WEAK_CONTEXT_THRESHOLD;
    const weak = !insufficient && top3Avg < ANSWERABLE_THRESHOLD;

    return {
        top1,
        top3Avg,
        insufficient,
        weak
    };
};

export const buildRefusalPayload = (requestId: string, startedAt: number, modelUsed: ModelName) => {
    const meta: ApiMeta = {
        requestId,
        modelUsed,
        fallbackUsed: false,
        confidence: 0.2,
        ambiguity: true,
        retryReason: 'insufficient_context',
        latencyMs: Date.now() - startedAt
    };

    return {
        data: {
            answer: '',
            evidence: [],
            code: 'INSUFFICIENT_CONTEXT',
            message: '근거가 충분하지 않아 답변을 생성하지 않습니다.'
        },
        meta
    };
};

export const buildWeakContextPayload = (requestId: string, startedAt: number, modelUsed: ModelName) => {
    const meta: ApiMeta = {
        requestId,
        modelUsed,
        fallbackUsed: false,
        confidence: 0.45,
        ambiguity: true,
        retryReason: 'weak_context',
        latencyMs: Date.now() - startedAt
    };

    return {
        data: {
            answer: '',
            evidence: [],
            code: 'WEAK_CONTEXT',
            message: '검색 근거가 약해 답변을 생성하지 않습니다.'
        },
        meta
    };
};

export const buildDegradeEvidenceOnlyPayload = (params: {
    requestId: string;
    startedAt: number;
    modelUsed: ModelName;
    reason: 'upstream_failed' | 'citation_missing' | 'retrieval_unavailable';
    evidence: Array<{ id: string; title: string; snippet: string; segmentId?: string }>;
}) => {
    const meta: ApiMeta = {
        requestId: params.requestId,
        modelUsed: params.modelUsed,
        fallbackUsed: true,
        confidence: 0.3,
        ambiguity: true,
        retryReason: params.reason,
        latencyMs: Date.now() - params.startedAt
    };

    return {
        data: {
            answer: '',
            evidence: params.evidence,
            code: 'DEGRADED_EVIDENCE_ONLY',
            message: 'LLM 또는 인용 검증 실패로 근거만 반환합니다.'
        },
        meta
    };
};
