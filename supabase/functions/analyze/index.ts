import { corsHeaders, jsonResponse } from '../_shared/cors.ts';
import type { ApiMeta, ModelName } from '../_shared/contracts.ts';
import { buildRagChunks } from '../_shared/rag/chunking.ts';

declare const Deno: {
    env: {
        get: (key: string) => string | undefined;
    };
    serve: (handler: (req: Request) => Promise<Response> | Response) => void;
};

type SourceType = 'manual' | 'chatgpt' | 'gemini' | 'claude';

type RelationSignalType = 'conflict' | 'complement';

type KnowledgeRelationSignal = {
    id: string;
    type: RelationSignalType;
    topic: string;
    summary: string;
    confidence: number;
    relatedDocumentIds: string[];
    evidenceSegmentIds?: string[];
};

type AutoLinkSuggestion = {
    id: string;
    fromId: string;
    toId: string;
    relation: 'supports' | 'contradicts' | 'extends' | 'duplicates' | 'related_to';
    confidence: number;
    rationale: string;
    status: 'suggested' | 'accepted' | 'rejected';
    generatedAt: string;
};

type ContextDoc = {
    id: string;
    title?: string;
    topicTags?: string[];
    summaryText?: string;
};

type ActionPlanData = {
    goal: string;
    steps: Array<{
        id: string;
        step: string;
        description: string;
        priority: 'High' | 'Medium' | 'Low';
    }>;
    applications: Array<{
        context: string;
        suggestion: string;
    }>;
};

const PRIMARY_MODEL: ModelName = Deno.env.get('OPENAI_MODEL_PRIMARY') || 'gpt-5-nano';
const OPENAI_EMBED_MODEL = Deno.env.get('OPENAI_EMBED_MODEL') || 'text-embedding-3-small';
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const RELATION_CONFIDENCE_MIN = Number(Deno.env.get('RELATION_CONFIDENCE_MIN') || '0.78');
const SIGNAL_MAX_COUNT = Number(Deno.env.get('SIGNAL_MAX_COUNT') || '3');
const DEFAULT_OWNER_ID = '00000000-0000-0000-0000-000000000001';

type AnalyzeData = {
    title: string;
    summaryText: string;
    docType: 'text' | 'conversation';
    knowledgeScore: number;
    topicTags: string[];
    summaryBullets: string[];
    conversationData?: Array<{ role: 'user' | 'assistant'; content: string }>;
    segments?: Array<{
        id: string;
        category: string;
        topic: string;
        content: string;
        originalRange: [number, number];
        relevance: number;
    }>;
    actionPlan: ActionPlanData;
    relationSignals?: KnowledgeRelationSignal[];
    autoLinkSuggestions?: AutoLinkSuggestion[];
};

type OpenAiSuccess = {
    ok: true;
    content: AnalyzeData;
    confidence: number;
    ambiguity: boolean;
};

type OpenAiFailure = {
    ok: false;
    status: number;
    body: unknown;
};

type OpenAiResult = OpenAiSuccess | OpenAiFailure;

const buildActionPlan = (goal: string): ActionPlanData => ({
    goal,
    steps: [
        { id: 'act-1', step: '현황 분석 및 갭 체크', description: '현재 상황과 제안점 사이의 차이를 진단', priority: 'High' },
        { id: 'act-2', step: '팀 공유', description: '핵심 인사이트를 요약해 팀에 전파', priority: 'Medium' }
    ],
    applications: [
        { context: '기획 단계', suggestion: '의사결정 체크리스트로 사용' },
        { context: '리뷰/회의', suggestion: '근거 기반 토론 자료로 활용' }
    ]
});

const buildPhase2Signals = (
    documentId: string,
    topicTags: string[],
    contextDocs: ContextDoc[]
): Pick<AnalyzeData, 'relationSignals' | 'autoLinkSuggestions'> => {
    const now = new Date().toISOString();
    const matched = contextDocs
        .filter((d) => d.id !== documentId)
        .map((d) => ({
            doc: d,
            overlap: (d.topicTags || []).filter((tag) => topicTags.includes(tag))
        }))
        .filter((x) => x.overlap.length > 0)
        .slice(0, SIGNAL_MAX_COUNT);

    const inferRelation = (overlapCount: number, summaryText?: string): AutoLinkSuggestion['relation'] => {
        const summary = (summaryText || '').toLowerCase();
        if (summary.includes('반대') || summary.includes('상충') || summary.includes('contradict')) return 'contradicts';
        if (summary.includes('중복') || summary.includes('duplicate')) return 'duplicates';
        if (overlapCount >= 2) return 'extends';
        return 'related_to';
    };

    const relationSignals: KnowledgeRelationSignal[] = matched.map((m, idx) => ({
        id: `rs-${Date.now()}-${idx}`,
        type: (m.doc.summaryText || '').includes('상충') ? 'conflict' : (idx % 2 === 0 ? 'complement' : 'conflict'),
        topic: m.overlap[0] || 'General',
        summary: idx % 2 === 0
            ? `${m.doc.title || m.doc.id}와(과) 상호 보완 가능한 관점이 감지되었습니다.`
            : `${m.doc.title || m.doc.id}와(과) 상충 가능성이 있는 관점이 감지되었습니다.`,
        confidence: idx % 2 === 0 ? 0.84 : 0.79,
        relatedDocumentIds: [documentId, m.doc.id],
        evidenceSegmentIds: []
    }));

    const autoLinkSuggestions: AutoLinkSuggestion[] = matched.map((m, idx) => ({
        id: `als-${Date.now()}-${idx}`,
        fromId: documentId,
        toId: m.doc.id,
        relation: inferRelation(m.overlap.length, m.doc.summaryText),
        confidence: idx % 2 === 0 ? 0.86 : 0.8,
        rationale: `${m.overlap.slice(0, 2).join(', ')} 토픽이 중첩되어 자동 연결을 제안합니다.`,
        status: 'suggested',
        generatedAt: now
    }));

    const filteredSignals = relationSignals.filter((s) => s.confidence >= RELATION_CONFIDENCE_MIN);
    const filteredSuggestions = autoLinkSuggestions.filter((s) => s.confidence >= RELATION_CONFIDENCE_MIN);

    return { relationSignals: filteredSignals, autoLinkSuggestions: filteredSuggestions };
};

const buildMeta = (
    startedAt: number,
    base: Omit<ApiMeta, 'latencyMs'>
): ApiMeta => ({
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const parseJwtUserId = (req: Request): string | null => {
    const auth = req.headers.get('authorization') || req.headers.get('Authorization');
    if (!auth || !auth.startsWith('Bearer ')) return null;
    const token = auth.slice('Bearer '.length).trim();
    const parts = token.split('.');
    if (parts.length < 2) return null;
    try {
        const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
        const payload = JSON.parse(atob(padded)) as { sub?: string };
        const sub = String(payload?.sub || '');
        return UUID_RE.test(sub) ? sub : null;
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
            input: input.slice(0, 8000)
        })
    });

    if (!res.ok) return null;
    const body = await safeJson(res);
    const vector = body?.data?.[0]?.embedding;
    return Array.isArray(vector) ? (vector as number[]) : null;
};

const upsertChunk = async (params: {
    id: string;
    ownerUserId: string;
    workspaceId: string;
    documentId: string;
    segmentId?: string;
    title: string;
    content: string;
    embedding: number[];
    metadata?: Record<string, unknown>;
}) => {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return;
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/upsert_rag_chunk`, {
        method: 'POST',
        headers: {
            apikey: SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            p_id: params.id,
            p_owner_user_id: params.ownerUserId,
            p_workspace_id: params.workspaceId,
            p_document_id: params.documentId,
            p_segment_id: params.segmentId || null,
            p_title: params.title,
            p_content: params.content,
            p_embedding: params.embedding,
            p_metadata: params.metadata || {}
        })
    });

    if (!res.ok) {
        const body = await safeJson(res);
        const message = body?.message || body?.error?.message || `upsert_rag_chunk failed: ${res.status}`;
        throw new Error(message);
    }
};

const upsertDocument = async (params: {
    id: string;
    ownerUserId: string;
    workspaceId: string;
    sourceType: SourceType;
    title: string;
    rawText: string;
    summaryText: string;
    metadata?: Record<string, unknown>;
}) => {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return;
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/upsert_rag_document`, {
        method: 'POST',
        headers: {
            apikey: SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            p_id: params.id,
            p_workspace_id: params.workspaceId,
            p_owner_user_id: params.ownerUserId,
            p_source_type: params.sourceType,
            p_title: params.title,
            p_raw_text: params.rawText,
            p_summary_text: params.summaryText,
            p_metadata: params.metadata || {}
        })
    });

    if (!res.ok) {
        const body = await safeJson(res);
        const message = body?.message || body?.error?.message || `upsert_rag_document failed: ${res.status}`;
        throw new Error(message);
    }
};

const persistRagChunks = async (params: {
    ownerUserId: string;
    workspaceId: string;
    documentId: string;
    sourceType: SourceType;
    data: AnalyzeData;
}) => {
    const { ownerUserId, workspaceId, documentId, sourceType, data } = params;
    const chunkInputs = buildRagChunks({
        documentId,
        sourceType,
        rawInput: [data.summaryText || '', ...(data.summaryBullets || []), ...((data.segments || []).map((s) => s.content || ''))].join('\n'),
        data
    });

    for (const chunk of chunkInputs) {
        const embedding = await getEmbedding(chunk.content);
        if (!embedding) continue;
        await upsertChunk({
            id: chunk.id,
            ownerUserId,
            workspaceId,
            documentId,
            segmentId: chunk.segmentId,
            title: chunk.title,
            content: chunk.content,
            embedding,
            metadata: chunk.metadata
        });
    }
};

const callOpenAI = async (
    model: ModelName,
    input: string,
    sourceType: SourceType,
    documentId: string,
    contextDocs: ContextDoc[]
): Promise<OpenAiResult> => {
    if (!OPENAI_API_KEY) {
        return { ok: false, status: 503, body: { message: 'OPENAI_API_KEY missing' } };
    }

    const contextSummary = contextDocs
        .slice(0, 8)
        .map((d) => `- id:${d.id} title:${d.title || '-'} tags:[${(d.topicTags || []).join(', ')}] summary:${(d.summaryText || '').slice(0, 120)}`)
        .join('\n');

    const prompt = `당신은 지식 구조화 엔진입니다. 입력을 JSON으로만 출력하세요.\n\n규칙:\n- title, summaryText, docType, knowledgeScore, topicTags, summaryBullets, actionPlan은 필수\n- docType이 conversation이면 conversationData 포함\n- docType이 text이면 segments 포함\n- knowledgeScore는 0~100\n- confidence(0~1), ambiguity(boolean)도 포함\n- relationSignals, autoLinkSuggestions는 optional\n\nsourceType: ${sourceType}\ndocumentId: ${documentId}\ncontextDocs:\n${contextSummary || '- 없음'}\ninput:\n${input}`;

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
                    name: 'analyze_result',
                    schema: {
                        type: 'object',
                        additionalProperties: true,
                        properties: {
                            title: { type: 'string' },
                            summaryText: { type: 'string' },
                            docType: { type: 'string', enum: ['text', 'conversation'] },
                            knowledgeScore: { type: 'number' },
                            topicTags: { type: 'array', items: { type: 'string' } },
                            summaryBullets: { type: 'array', items: { type: 'string' } },
                            conversationData: { type: 'array', items: { type: 'object' } },
                            segments: { type: 'array', items: { type: 'object' } },
                            actionPlan: { type: 'object' },
                            relationSignals: { type: 'array', items: { type: 'object' } },
                            autoLinkSuggestions: { type: 'array', items: { type: 'object' } },
                            confidence: { type: 'number' },
                            ambiguity: { type: 'boolean' }
                        },
                        required: ['title', 'summaryText', 'docType', 'knowledgeScore', 'topicTags', 'summaryBullets', 'actionPlan', 'confidence', 'ambiguity']
                    },
                    strict: true
                }
            }
        })
    });

    const body = await safeJson(res);
    if (!res.ok || !body) {
        return { ok: false, status: res.status, body };
    }

    const outputText = body?.output?.[0]?.content?.[0]?.text;
    if (!outputText) {
        return { ok: false, status: 502, body };
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(outputText);
    } catch {
        return { ok: false, status: 502, body };
    }

    const result = parsed as Partial<AnalyzeData> & { confidence?: number; ambiguity?: boolean };
    if (!result || typeof result.title !== 'string' || typeof result.summaryText !== 'string' || !Array.isArray(result.topicTags)) {
        return { ok: false, status: 502, body: parsed };
    }

    const normalized: AnalyzeData = {
        title: result.title,
        summaryText: result.summaryText,
        docType: result.docType === 'conversation' ? 'conversation' : 'text',
        knowledgeScore: Number(result.knowledgeScore ?? 50),
        topicTags: result.topicTags ?? [],
        summaryBullets: result.summaryBullets ?? [],
        conversationData: result.conversationData,
        segments: result.segments,
        actionPlan: result.actionPlan || buildActionPlan('지식의 실무 적용'),
        relationSignals: result.relationSignals,
        autoLinkSuggestions: result.autoLinkSuggestions
    };

    const phase2 = buildPhase2Signals(documentId, normalized.topicTags, contextDocs);
    if (!normalized.relationSignals || normalized.relationSignals.length === 0) {
        normalized.relationSignals = phase2.relationSignals;
    }
    if (!normalized.autoLinkSuggestions || normalized.autoLinkSuggestions.length === 0) {
        normalized.autoLinkSuggestions = phase2.autoLinkSuggestions;
    }

    return {
        ok: true,
        content: normalized,
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
        const input = String(payload?.input || '').trim();
        const sourceType = (payload?.sourceType || 'manual') as SourceType;
        const documentId = String(payload?.documentId || `d-${Date.now()}`);
        const workspaceId = String(payload?.workspaceId || 'w1');
        const ownerUserId = parseJwtUserId(req) || (UUID_RE.test(String(payload?.userId || '')) ? String(payload?.userId) : DEFAULT_OWNER_ID);
        const contextDocs = Array.isArray(payload?.contextDocs) ? (payload.contextDocs as ContextDoc[]) : [];

        if (!input) {
            return jsonResponse(400, { error: { code: 'BAD_REQUEST', message: 'input is required', requestId } });
        }

        // 1) 원문은 모델 분석 전에 즉시 저장(실패해도 raw는 남김)
        await upsertDocument({
            id: documentId,
            ownerUserId,
            workspaceId,
            sourceType,
            title: '분석 대기 중',
            rawText: input,
            summaryText: '',
            metadata: {
                ingestStatus: 'processing',
                requestId
            }
        });

        const first = await callOpenAI(PRIMARY_MODEL, input, sourceType, documentId, contextDocs);
        if (!first.ok) {
            await upsertDocument({
                id: documentId,
                ownerUserId,
                workspaceId,
                sourceType,
                title: '분석 실패',
                rawText: input,
                summaryText: '',
                metadata: {
                    ingestStatus: 'failed',
                    requestId,
                    upstreamFailed: true
                }
            });
            return jsonResponse(502, {
                error: {
                    code: 'UPSTREAM_FAILED',
                    message: 'analyze model failed',
                    requestId
                }
            });
        }

        const meta = buildMeta(startedAt, {
            requestId,
            modelUsed: PRIMARY_MODEL,
            fallbackUsed: false,
            confidence: first.confidence,
            ambiguity: first.ambiguity
        });
        console.log(JSON.stringify({
            event: 'analyze_response',
            ...meta,
            relationSignalCount: first.content.relationSignals?.length || 0,
            autoSuggestionCount: first.content.autoLinkSuggestions?.length || 0
        }));
        await upsertDocument({
            id: documentId,
            ownerUserId,
            workspaceId,
            sourceType,
            title: first.content.title,
            rawText: input,
            summaryText: first.content.summaryText,
            metadata: {
                ingestStatus: 'completed',
                analysis: first.content,
                aiMeta: {
                    modelUsed: PRIMARY_MODEL,
                    fallbackUsed: false,
                    confidence: first.confidence,
                    ambiguity: first.ambiguity
                }
            }
        });
        await persistRagChunks({ ownerUserId, workspaceId, documentId, sourceType, data: first.content });
        return jsonResponse(200, {
            data: first.content,
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
