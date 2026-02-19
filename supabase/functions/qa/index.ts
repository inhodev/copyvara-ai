import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import type { ApiMeta, ModelName } from '../_shared/contracts.ts';
import {
    retrieveHybridDocs,
    PERSONAL_HYBRID_LEXICAL_WEIGHT,
    PERSONAL_HYBRID_VECTOR_WEIGHT,
    PERSONAL_RERANK_CANDIDATE_TOPN
} from '../_shared/rag/retrieval.ts';
import { rerankDocs, PERSONAL_TOPK } from '../_shared/rag/rerank.ts';
import {
    buildCitationPrompt,
    hasSentenceLevelCitation,
    extractKeywords,
    expandKeywords,
    buildExpandedQuery,
    hasTopicOverlap,
    buildTopicGuideAnswer
} from '../_shared/rag/prompts.ts';
import {
    assessContextQuality,
    buildDegradeEvidenceOnlyPayload,
    MIN_EVIDENCE_COUNT
} from '../_shared/rag/degrade.ts';

declare const Deno: {
    env: {
        get: (key: string) => string | undefined;
    };
    serve: (handler: (req: Request) => Promise<Response> | Response) => void;
};

const PRIMARY_MODEL: ModelName = Deno.env.get('OPENAI_MODEL_PRIMARY') || 'gpt-5-nano';
const OPENAI_EMBED_MODEL = Deno.env.get('OPENAI_EMBED_MODEL') || 'text-embedding-3-small';
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const PERSONAL_QUERY_REWRITE_ENABLED = (Deno.env.get('PERSONAL_QUERY_REWRITE_ENABLED') || 'false').toLowerCase() === 'true';

type QaEvidence = { id: string; title: string; snippet: string; segmentId?: string };
type QaCitation = { id: string; title: string; quote: string };
type QaData = { answer: string; evidence: QaEvidence[]; citations: QaCitation[] };

type OpenAiSuccess = {
    ok: true;
    content: QaData & { confidence?: number; ambiguity?: boolean };
    confidence: number;
    ambiguity: boolean;
};

type OpenAiFailure = {
    ok: false;
    status: number;
    body: unknown;
};

type OpenAiResult = OpenAiSuccess | OpenAiFailure;

const buildMeta = (startedAt: number, base: Omit<ApiMeta, 'latencyMs'>): ApiMeta => ({
    ...base,
    latencyMs: Date.now() - startedAt
});

const safeJson = async (res: Response) => {
    try {
        return await res.json();
    } catch {
        return null;
    }
};

const getEmbedding = async (input: string): Promise<number[] | null> => {
    if (!OPENAI_API_KEY || !input.trim()) return null;

    const res = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: OPENAI_EMBED_MODEL,
            input: input.slice(0, 4000)
        })
    });

    if (!res.ok) return null;
    const body = await safeJson(res);
    const vector = body?.data?.[0]?.embedding;
    return Array.isArray(vector) ? (vector as number[]) : null;
};

const buildEvidenceFromReranked = (docs: Array<Record<string, unknown>>): QaEvidence[] =>
    docs.slice(0, 6).map((d: any) => ({
        id: String(d.document_id || d.id || ''),
        title: String(d.title || 'Untitled'),
        snippet: String(d.content || '').slice(0, 220),
        segmentId: d.segment_id ? String(d.segment_id) : undefined
    }));

const buildCitationsFromReranked = (docs: Array<Record<string, unknown>>): QaCitation[] =>
    docs.slice(0, 6).map((d: any) => ({
        id: String(d.document_id || d.id || ''),
        title: String(d.title || 'Untitled'),
        quote: String(d.content || '').slice(0, 120)
    }));

const mergeRetrievedRows = (...groups: Array<Array<Record<string, unknown>>>) => {
    const map = new Map<string, Record<string, unknown>>();
    groups.flat().forEach((row: any) => {
        const id = String(row?.id || '');
        if (!id) return;
        const prev = map.get(id) as any;
        if (!prev || Number(row?.final_score ?? 0) > Number(prev?.final_score ?? 0)) {
            map.set(id, row);
        }
    });
    return Array.from(map.values()) as Array<Record<string, unknown>>;
};

const callOpenAI = async (model: ModelName, prompt: string): Promise<OpenAiResult> => {
    if (!OPENAI_API_KEY) {
        return { ok: false, status: 503, body: { message: 'OPENAI_API_KEY missing' } };
    }

    const res = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model,
            input: prompt,
            text: {
                format: {
                    type: 'json_schema',
                    name: 'qa_result',
                    schema: {
                        type: 'object',
                        additionalProperties: true,
                        properties: {
                            answer: { type: 'string' },
                            evidence: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    additionalProperties: true,
                                    properties: {
                                        id: { type: 'string' },
                                        title: { type: 'string' },
                                        snippet: { type: 'string' },
                                        segmentId: { type: 'string' }
                                    },
                                    required: ['id', 'title', 'snippet']
                                }
                            },
                            citations: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    additionalProperties: true,
                                    properties: {
                                        id: { type: 'string' },
                                        title: { type: 'string' },
                                        quote: { type: 'string' }
                                    },
                                    required: ['id', 'title', 'quote']
                                }
                            },
                            confidence: { type: 'number' },
                            ambiguity: { type: 'boolean' }
                        },
                        required: ['answer', 'evidence', 'citations', 'confidence', 'ambiguity']
                    },
                    strict: true
                }
            }
        })
    });

    const body = await safeJson(res);
    if (!res.ok || !body) return { ok: false, status: res.status, body };

    const outputText = body?.output?.[0]?.content?.[0]?.text;
    if (!outputText) return { ok: false, status: 502, body };

    let parsed: unknown;
    try {
        parsed = JSON.parse(outputText);
    } catch {
        return { ok: false, status: 502, body };
    }

    const result = parsed as Partial<QaData> & { confidence?: number; ambiguity?: boolean };
    if (!result || typeof result.answer !== 'string' || !Array.isArray(result.evidence) || !Array.isArray(result.citations)) {
        return { ok: false, status: 502, body: parsed };
    }

    return {
        ok: true,
        content: {
            answer: result.answer,
            evidence: result.evidence as QaEvidence[],
            citations: result.citations as QaCitation[],
            confidence: result.confidence,
            ambiguity: result.ambiguity
        },
        confidence: Number(result.confidence ?? 0.5),
        ambiguity: Boolean(result.ambiguity)
    };
};

Deno.serve(async (req) => {
    const startedAt = Date.now();
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    if (req.method !== 'POST') {
        return jsonResponse(405, { error: { code: 'BAD_REQUEST', message: 'POST only', requestId: crypto.randomUUID() } });
    }

    const requestId = crypto.randomUUID();

    try {
        const payload = await req.json();
        const question = String(payload?.question || '').trim();

        if (question.length < 2) {
            return jsonResponse(400, { error: { code: 'BAD_REQUEST', message: 'question is too short', requestId } });
        }
        const embedding = await getEmbedding(question);
        if (!embedding) {
            const degrade = buildDegradeEvidenceOnlyPayload({
                requestId,
                startedAt,
                modelUsed: PRIMARY_MODEL,
                reason: 'retrieval_unavailable',
                evidence: []
            });
            return jsonResponse(200, degrade);
        }

        const keywords = extractKeywords(question, 3, 6);
        const expandedKeywords = expandKeywords(keywords);
        const expandedQuestion = buildExpandedQuery(question, expandedKeywords);
        const broadenQuestion = buildExpandedQuery(
            question,
            expandedKeywords.slice(0, 4).concat(['핵심', '개념', '요약'])
        );

        const retrieved1 = await retrieveHybridDocs({
            queryEmbedding: embedding,
            question,
            candidateTopN: PERSONAL_RERANK_CANDIDATE_TOPN,
            vectorWeight: PERSONAL_HYBRID_VECTOR_WEIGHT,
            lexicalWeight: PERSONAL_HYBRID_LEXICAL_WEIGHT,
            queryRewriteEnabled: PERSONAL_QUERY_REWRITE_ENABLED
        });

        const retrieved2 = await retrieveHybridDocs({
            queryEmbedding: embedding,
            question: expandedQuestion,
            candidateTopN: PERSONAL_RERANK_CANDIDATE_TOPN,
            vectorWeight: PERSONAL_HYBRID_VECTOR_WEIGHT,
            lexicalWeight: PERSONAL_HYBRID_LEXICAL_WEIGHT,
            queryRewriteEnabled: PERSONAL_QUERY_REWRITE_ENABLED
        });

        let merged = mergeRetrievedRows(retrieved1 as any, retrieved2 as any);
        let reranked = rerankDocs({ question, docs: merged as any, topk: 10 });
        let candidates055 = reranked.filter((d) => Number(d.rerank_score ?? 0) >= 0.55);

        if (candidates055.length < 2) {
            const retrieved3 = await retrieveHybridDocs({
                queryEmbedding: embedding,
                question: broadenQuestion,
                candidateTopN: PERSONAL_RERANK_CANDIDATE_TOPN,
                vectorWeight: PERSONAL_HYBRID_VECTOR_WEIGHT,
                lexicalWeight: PERSONAL_HYBRID_LEXICAL_WEIGHT,
                queryRewriteEnabled: PERSONAL_QUERY_REWRITE_ENABLED
            });
            merged = mergeRetrievedRows(merged, retrieved3 as any);
            reranked = rerankDocs({ question, docs: merged as any, topk: 10 });
            candidates055 = reranked.filter((d) => Number(d.rerank_score ?? 0) >= 0.55);
        }

        const quality = assessContextQuality(reranked);
        const evidenceFromRetrieval = buildEvidenceFromReranked(reranked);
        const citationsFromRetrieval = buildCitationsFromReranked(reranked);

        const promptDocs = reranked.slice(0, 10).map((d) => ({
            id: d.document_id,
            title: d.title,
            content: d.content
        }));

        if (!hasTopicOverlap(question, promptDocs)) {
            const meta = buildMeta(startedAt, {
                requestId,
                modelUsed: PRIMARY_MODEL,
                fallbackUsed: true,
                confidence: 0.35,
                ambiguity: true,
                retryReason: 'topic_mismatch'
            });
            return jsonResponse(200, {
                data: {
                    answer: buildTopicGuideAnswer(question, promptDocs),
                    evidence: evidenceFromRetrieval,
                    citations: citationsFromRetrieval
                },
                meta
            });
        }

        if (evidenceFromRetrieval.length < MIN_EVIDENCE_COUNT || quality.insufficient) {
            const meta = buildMeta(startedAt, {
                requestId,
                modelUsed: PRIMARY_MODEL,
                fallbackUsed: true,
                confidence: 0.3,
                ambiguity: true,
                retryReason: 'insufficient_context_after_multisearch'
            });
            return jsonResponse(200, {
                data: {
                    answer: [
                        '핵심 요약:\n현재 저장된 지식 범위에서 질문과 직접적으로 맞닿는 근거가 충분하지 않습니다. 다만 완전히 무관하다고 단정하지 않고, 연관 주제 후보를 중심으로 재질문을 권장합니다. (출처: 저장 문서 인덱스)',
                        '저장된 지식 기반 분석:\n원 질문 + 확장 질문 + 보강 질문까지 다중 검색을 수행했지만 유사도 0.55 이상 후보가 충분히 모이지 않았습니다. 따라서 지금은 확정형 답변보다 주제 범위를 좁혀 재탐색하는 것이 정확합니다. (출처: 검색 결과 상위 문서)',
                        '실행 관점 정리:\n- 핵심 키워드를 1~2개 구체화하기\n- 관련 문서 1개 이상 추가 저장하기\n- 질문을 하위 주제로 분할해 재질문하기 (출처: 검색 결과 상위 문서)',
                        '추가 통찰:\n해석: 현재 질의는 저장 지식과의 결속도가 낮습니다. 문서가 보강되면 답변 품질이 빠르게 개선될 가능성이 큽니다. (출처: 검색 결과 상위 문서)'
                    ].join('\n\n'),
                    evidence: evidenceFromRetrieval,
                    citations: citationsFromRetrieval
                },
                meta
            });
        }

        const prompt = buildCitationPrompt({ question, docs: promptDocs.slice(0, PERSONAL_TOPK) });
        const result = await callOpenAI(PRIMARY_MODEL, prompt);
        const modelUsed: ModelName = PRIMARY_MODEL;

        if (!result.ok) {
            const degrade = buildDegradeEvidenceOnlyPayload({
                requestId,
                startedAt,
                modelUsed,
                reason: 'upstream_failed',
                evidence: evidenceFromRetrieval
            });
            return jsonResponse(200, degrade);
        }

        if (!hasSentenceLevelCitation(result.content.answer)) {
            const degrade = buildDegradeEvidenceOnlyPayload({
                requestId,
                startedAt,
                modelUsed,
                reason: 'citation_missing',
                evidence: evidenceFromRetrieval
            });
            return jsonResponse(200, degrade);
        }

        const meta = buildMeta(startedAt, {
            requestId,
            modelUsed,
            fallbackUsed: false,
            confidence: Number(result.confidence ?? 0.7),
            ambiguity: Boolean(result.ambiguity)
        });

        return jsonResponse(200, {
            data: {
                answer: result.content.answer,
                evidence: result.content.evidence || evidenceFromRetrieval,
                citations: result.content.citations?.length ? result.content.citations : citationsFromRetrieval
            },
            meta
        });
    } catch (e) {
        return jsonResponse(500, {
            error: {
                code: 'INTERNAL',
                message: e instanceof Error ? e.message : 'unknown error',
                requestId
            }
        });
    }
});
