type VercelRequest = { method?: string; body?: { title?: unknown; raw_text?: unknown; workspace_id?: unknown; source_type?: unknown } };
type VercelResponse = {
    status: (code: number) => { json: (body: unknown) => void };
};

type IngestBody = {
    title?: string;
    raw_text: string;
    workspace_id?: string;
    source_type?: string;
};

type IngestAnalysis = {
    title: string;
    summaryText: string;
    topicTags: string[];
    summaryBullets: string[];
    actionPlan: {
        goal: string;
        steps: Array<{ id: string; step: string; description: string; priority: 'High' | 'Medium' | 'Low' }>;
        applications: Array<{ context: string; suggestion: string }>;
    };
};

const buildSummaryPrompt = (rawText: string, title?: string) => `다음 원문을 기반으로 "저장용 지식 메모"를 생성한다. 반드시 JSON으로만 응답한다.

규칙:
- 한국어로 작성
- 원문에 없는 사실/수치/인물을 절대 추가하지 말 것
- title: 40자 이내의 명확한 제목
- summaryText: 3~5문장 요약
- topicTags: 핵심 주제 3~8개
- summaryBullets: 실행/의사결정에 바로 쓸 수 있는 핵심 bullet 3~8개
- actionPlan.goal: 문서 기반 목표 1개
- actionPlan.steps: 3~6개, 각 step은 구체 행동
- actionPlan.applications: 2~4개, 실제 적용 맥락

출력:
{
  "title": string,
  "summaryText": string,
  "topicTags": string[],
  "summaryBullets": string[],
  "actionPlan": {
    "goal": string,
    "steps": [{"id": string, "step": string, "description": string, "priority": "High"|"Medium"|"Low"}],
    "applications": [{"context": string, "suggestion": string}]
  }
}

입력 제목: ${title || '없음'}
원문:
${rawText.slice(0, 5000)}`;

const summarizeWithOpenAI = async (rawText: string, title?: string): Promise<IngestAnalysis> => {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY is missing');
    }

    const model = 'gpt-5-mini';
    const prompt = buildSummaryPrompt(rawText, title);

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
                    name: 'ingest_summary',
                    strict: true,
                    schema: {
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                            title: { type: 'string' },
                            summaryText: { type: 'string' },
                            topicTags: {
                                type: 'array',
                                items: { type: 'string' }
                            },
                            summaryBullets: {
                                type: 'array',
                                items: { type: 'string' }
                            },
                            actionPlan: {
                                type: 'object',
                                additionalProperties: false,
                                properties: {
                                    goal: { type: 'string' },
                                    steps: {
                                        type: 'array',
                                        items: {
                                            type: 'object',
                                            additionalProperties: false,
                                            properties: {
                                                id: { type: 'string' },
                                                step: { type: 'string' },
                                                description: { type: 'string' },
                                                priority: { type: 'string', enum: ['High', 'Medium', 'Low'] }
                                            },
                                            required: ['id', 'step', 'description', 'priority']
                                        }
                                    },
                                    applications: {
                                        type: 'array',
                                        items: {
                                            type: 'object',
                                            additionalProperties: false,
                                            properties: {
                                                context: { type: 'string' },
                                                suggestion: { type: 'string' }
                                            },
                                            required: ['context', 'suggestion']
                                        }
                                    }
                                },
                                required: ['goal', 'steps', 'applications']
                            }
                        },
                        required: ['title', 'summaryText', 'topicTags', 'summaryBullets', 'actionPlan']
                    }
                }
            }
        })
    });

    const body = await res.json().catch(() => null);
    if (!res.ok) {
        throw new Error(`OPENAI_SUMMARY_FAILED ${res.status} ${JSON.stringify(body || {})}`);
    }

    const outputText = body?.output?.[0]?.content?.[0]?.text;
    if (!outputText) {
        throw new Error('OPENAI_SUMMARY_EMPTY_OUTPUT');
    }

    return JSON.parse(outputText) as IngestAnalysis;
};

const writeDocument = async (payload: {
    title: string;
    raw_text: string;
    summary_text: string;
    workspace_id: string;
    source_type: string;
    analysis?: IngestAnalysis;
    summaryError?: string | null;
}) => {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
        throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing');
    }

    const id = `d-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const row = {
        id,
        workspace_id: payload.workspace_id,
        owner_user_id: '00000000-0000-0000-0000-000000000001',
        source_type: payload.source_type,
        title: payload.title,
        raw_text: payload.raw_text,
        summary_text: payload.summary_text,
        metadata: {
            ingestMethod: 'vercel_api',
            savedAt: new Date().toISOString(),
            analysis: payload.analysis || {
                title: payload.title,
                summaryText: payload.summary_text,
                topicTags: [],
                summaryBullets: [],
                actionPlan: {
                    goal: '핵심 요약 기반 실행',
                    steps: [],
                    applications: []
                }
            },
            aiMeta: {
                modelUsed: 'gpt-5-mini',
                fallbackUsed: false,
                confidence: payload.analysis ? 0.72 : 0,
                ambiguity: !payload.analysis,
                retryReason: payload.summaryError || undefined
            }
        }
    };

    const res = await fetch(`${SUPABASE_URL}/rest/v1/rag_documents`, {
        method: 'POST',
        headers: {
            apikey: SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'return=representation'
        },
        body: JSON.stringify(row)
    });

    const body = await res.json().catch(() => null);
    if (!res.ok) {
        throw new Error(`SUPABASE_WRITE_FAILED ${res.status} ${JSON.stringify(body || {})}`);
    }
    const first = Array.isArray(body) ? body[0] : body;
    return first;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'POST only' });
    }

    try {
        const body: IngestBody = {
            title: typeof req.body?.title === 'string' ? req.body.title : undefined,
            raw_text: String(req.body?.raw_text || '').trim(),
            workspace_id: typeof req.body?.workspace_id === 'string' ? req.body.workspace_id : 'w1',
            source_type: typeof req.body?.source_type === 'string' ? req.body.source_type : 'manual'
        };

        if (!body.raw_text) {
            return res.status(400).json({ error: 'raw_text is required' });
        }

        let resolvedTitle = body.title?.trim() || '제목 없는 문서';
        let summaryText = '';
        let analysis: IngestAnalysis | null = null;
        let summaryError: string | null = null;

        try {
            const summary = await summarizeWithOpenAI(body.raw_text, body.title);
            if (summary?.title) resolvedTitle = summary.title.slice(0, 80);
            if (summary?.summaryText) summaryText = summary.summaryText;
            analysis = summary;
        } catch (e) {
            summaryError = e instanceof Error ? e.message : 'summary_failed';
        }

        const inserted = await writeDocument({
            title: resolvedTitle,
            raw_text: body.raw_text,
            summary_text: summaryText,
            workspace_id: body.workspace_id || 'w1',
            source_type: body.source_type || 'manual',
            analysis: analysis || undefined,
            summaryError
        });

        return res.status(200).json({
            id: inserted?.id,
            title: inserted?.title || resolvedTitle,
            summaryText: inserted?.summary_text || summaryText,
            rawText: inserted?.raw_text || body.raw_text,
            sourceType: inserted?.source_type || body.source_type,
            workspaceId: inserted?.workspace_id || body.workspace_id,
            summaryError
        });
    } catch (e) {
        const message = e instanceof Error ? e.message : 'ingest_failed';
        return res.status(500).json({ error: message });
    }
}
