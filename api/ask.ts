type VercelRequest = { method?: string; body?: { question?: unknown } };
type VercelResponse = {
    status: (code: number) => { json: (body: unknown) => void };
};

type RagDocumentRow = {
    id: string;
    title: string;
    raw_text: string | null;
    summary_text: string | null;
    created_at: string;
};

type Citation = {
    title: string;
    quote: string;
    docId: string;
};

const STOPWORDS = new Set([
    '은', '는', '이', '가', '을', '를', '에', '의', '도', '로', '과', '와', '한', '및', '에서', '으로', '그리고',
    'the', 'a', 'an', 'to', 'of', 'and', 'in', 'on', 'for', 'is', 'are', 'be', 'with'
]);

const tokenize = (text: string): string[] =>
    String(text || '')
        .toLowerCase()
        .replace(/[^a-z0-9가-힣\s]/g, ' ')
        .split(/\s+/)
        .map((t) => t.trim())
        .filter((t) => t.length >= 2 && !STOPWORDS.has(t));

const unique = <T,>(arr: T[]) => Array.from(new Set(arr));

const scoreDoc = (doc: RagDocumentRow, qTokens: string[]) => {
    const text = `${doc.title} ${doc.summary_text || ''} ${doc.raw_text || ''}`.toLowerCase();
    let overlap = 0;
    for (const t of qTokens) {
        if (text.includes(t)) overlap += 1;
    }
    const recency = Math.max(0, 1 - Math.min((Date.now() - new Date(doc.created_at).getTime()) / (1000 * 60 * 60 * 24), 60) / 60);
    return overlap * 10 + recency;
};

const extractQuote = (doc: RagDocumentRow, qTokens: string[]) => {
    const source = (doc.summary_text || doc.raw_text || '').replace(/\s+/g, ' ').trim();
    if (!source) return '';

    const sents = source.split(/(?<=[.!?\n])\s+/).filter(Boolean);
    let best = sents[0] || source.slice(0, 200);
    let bestScore = -1;

    for (const s of sents) {
        let score = 0;
        const lower = s.toLowerCase();
        for (const t of qTokens) {
            if (lower.includes(t)) score += 1;
        }
        if (score > bestScore) {
            bestScore = score;
            best = s;
        }
    }

    return best.slice(0, 260);
};

const buildPrompt = (question: string, contextLines: string) => `너는 사용자의 개인 지식 메모를 기반으로 답변하는 비서다.

규칙:
1) 반드시 CONTEXT 안의 사실만 사용한다.
2) CONTEXT에는 summary, bullet, actionPlan이 포함될 수 있으며 이를 우선 활용한다.
3) CONTEXT에 근거가 없으면 추측하지 말고 "제공된 메모 컨텍스트에서 근거를 찾지 못했습니다"라고 답한다.
4) 답변은 한국어, 실무형(핵심 요약 + 실행 포인트)으로 작성한다.
5) 최종 출력은 JSON 객체만 반환한다.

출력 스키마:
{
  "answer": string,
  "citations": [
    {"title": string, "quote": string, "docId": string}
  ]
}

QUESTION:
${question}

CONTEXT:
${contextLines}`;

const askOpenAI = async (question: string, citations: Citation[]) => {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY is missing');
    }

    const contextLines = citations
        .map((c, idx) => `${idx + 1}) [docId=${c.docId}] title=${c.title}\nquote=${c.quote}`)
        .join('\n\n') || '관련 문서 없음';

    const model = process.env.OPENAI_MODEL_PRIMARY || 'gpt-4o-mini';
    const prompt = buildPrompt(question, contextLines);

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
                    name: 'ask_response',
                    strict: true,
                    schema: {
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                            answer: { type: 'string' },
                            citations: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    additionalProperties: false,
                                    properties: {
                                        title: { type: 'string' },
                                        quote: { type: 'string' },
                                        docId: { type: 'string' }
                                    },
                                    required: ['title', 'quote', 'docId']
                                }
                            }
                        },
                        required: ['answer', 'citations']
                    }
                }
            }
        })
    });

    const body = await res.json().catch(() => null);
    if (!res.ok) {
        throw new Error(`OPENAI_FAILED ${res.status} ${JSON.stringify(body || {})}`);
    }

    const outputText = body?.output?.[0]?.content?.[0]?.text;
    if (!outputText) {
        throw new Error('OPENAI_EMPTY_OUTPUT');
    }

    const parsed = JSON.parse(outputText) as { answer: string; citations: Citation[] };
    return {
        answer: parsed.answer,
        citations: Array.isArray(parsed.citations) ? parsed.citations : []
    };
};

const fetchRecentDocuments = async (): Promise<RagDocumentRow[]> => {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        throw new Error('SUPABASE_URL or SUPABASE_ANON_KEY missing');
    }

    const res = await fetch(
        `${SUPABASE_URL}/rest/v1/rag_documents?select=id,title,raw_text,summary_text,metadata,created_at&order=created_at.desc&limit=200`,
        {
            headers: {
                apikey: SUPABASE_ANON_KEY,
                Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json'
            }
        }
    );

    const body = await res.json().catch(() => []);
    if (!res.ok) {
        throw new Error(`SUPABASE_READ_FAILED ${res.status} ${JSON.stringify(body || {})}`);
    }
    return Array.isArray(body) ? (body as RagDocumentRow[]) : [];
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'POST only' });
    }

    try {
        const question = String(req.body?.question || '').trim();
        if (!question) {
            return res.status(400).json({ error: 'question is required' });
        }

        const docs = await fetchRecentDocuments();
        const qTokens = unique(tokenize(question));
        const ranked = [...docs]
            .map((d) => ({ doc: d, score: scoreDoc(d, qTokens) }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 6)
            .map((x) => x.doc);

        const seedCitations: Citation[] = ranked.map((doc) => {
            const metadata = (doc as unknown as { metadata?: Record<string, unknown> }).metadata || {};
            const analysis = (metadata.analysis || {}) as Record<string, unknown>;
            const summaryText = typeof analysis.summaryText === 'string' ? analysis.summaryText : '';
            const summaryBullets = Array.isArray(analysis.summaryBullets) ? analysis.summaryBullets.map((x) => String(x)).slice(0, 4).join(' / ') : '';
            const actionGoal = typeof (analysis.actionPlan as Record<string, unknown> | undefined)?.goal === 'string'
                ? String((analysis.actionPlan as Record<string, unknown>).goal)
                : '';
            const quote = [summaryText, summaryBullets, actionGoal, extractQuote(doc, qTokens)].filter(Boolean).join(' | ').slice(0, 320);
            return {
                title: doc.title || '제목 없음',
                quote,
                docId: doc.id
            };
        });

        const llm = await askOpenAI(question, seedCitations);
        const fallbackCitations = seedCitations.filter((c) => c.quote).slice(0, 6);
        const citations = (llm.citations || []).length > 0 ? llm.citations : fallbackCitations;

        return res.status(200).json({
            answer: llm.answer,
            citations,
            evidence: citations.map((c) => ({
                id: c.docId,
                title: c.title,
                snippet: c.quote
            }))
        });
    } catch (e) {
        const message = e instanceof Error ? e.message : 'ask_failed';
        return res.status(500).json({ error: message });
    }
}
