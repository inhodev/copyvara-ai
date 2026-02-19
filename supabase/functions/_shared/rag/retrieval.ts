type HybridDoc = {
    id: string;
    document_id: string;
    segment_id?: string | null;
    title: string;
    content: string;
    vector_score: number;
    lexical_score: number;
    final_score: number;
};

export const PERSONAL_HYBRID_VECTOR_WEIGHT = 0.74;
export const PERSONAL_HYBRID_LEXICAL_WEIGHT = 0.26;
export const PERSONAL_RERANK_CANDIDATE_TOPN = 28;

declare const Deno: {
    env: {
        get: (key: string) => string | undefined;
    };
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const safeJson = async (res: Response) => {
    try {
        return await res.json();
    } catch {
        return null;
    }
};

export const retrieveHybridDocs = async (params: {
    queryEmbedding: number[];
    question: string;
    candidateTopN?: number;
    vectorWeight?: number;
    lexicalWeight?: number;
    queryRewriteEnabled?: boolean;
}): Promise<HybridDoc[]> => {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return [];

    const callHybridRpc = async (queryText: string, matchCount: number) => fetch(`${SUPABASE_URL}/rest/v1/rpc/match_rag_chunks_hybrid`, {
        method: 'POST',
        headers: {
            apikey: SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            p_query_embedding: `[${params.queryEmbedding.map((v) => Number(v)).join(',')}]`,
            p_query_text: queryText,
            p_candidate_count: matchCount,
            p_vector_weight: params.vectorWeight ?? PERSONAL_HYBRID_VECTOR_WEIGHT,
            p_lexical_weight: params.lexicalWeight ?? PERSONAL_HYBRID_LEXICAL_WEIGHT
        })
    });

    const rewriteEnabled = Boolean(params.queryRewriteEnabled);
    const baseTopN = Math.max(4, params.candidateTopN ?? PERSONAL_RERANK_CANDIDATE_TOPN);
    const rewriteQuery = params.question
        .replace(/[?.,!]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .split(' ')
        .filter((t) => t.length > 1)
        .slice(0, 6)
        .join(' ');

    const baseRes = await callHybridRpc(params.question, baseTopN);
    if (!baseRes.ok) return [];
    const baseRows = await safeJson(baseRes);
    const rowsA = Array.isArray(baseRows) ? baseRows : [];

    const rowsB: any[] = [];

    if (rewriteEnabled && rewriteQuery && rewriteQuery !== params.question) {
        const rewriteRes = await callHybridRpc(rewriteQuery, Math.max(4, Math.floor(baseTopN * 0.7)));
        if (rewriteRes.ok) {
            const rewriteRows = await safeJson(rewriteRes);
            if (Array.isArray(rewriteRows)) {
                rowsB.push(...rewriteRows);
            }
        }
    }

    const mergedMap = new Map<string, any>();
    [...rowsA, ...rowsB].forEach((row: any) => {
        const id = String(row?.id || '');
        if (!id) return;
        const current = mergedMap.get(id);
        if (!current || Number(row?.final_score ?? 0) > Number(current?.final_score ?? 0)) {
            mergedMap.set(id, row);
        }
    });

    const merged = Array.from(mergedMap.values())
        .sort((a: any, b: any) => Number(b?.final_score ?? 0) - Number(a?.final_score ?? 0))
        .slice(0, baseTopN);

    return merged.map((row: any) => ({
        id: String(row.id || ''),
        document_id: String(row.document_id || ''),
        segment_id: row.segment_id ? String(row.segment_id) : null,
        title: String(row.title || ''),
        content: String(row.content || ''),
        vector_score: Number(row.vector_score ?? 0),
        lexical_score: Number(row.lexical_score ?? 0),
        final_score: Number(row.final_score ?? 0)
    }));
};
