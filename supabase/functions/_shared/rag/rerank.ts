type RetrievedDoc = {
    id: string;
    document_id: string;
    segment_id?: string | null;
    title: string;
    content: string;
    vector_score: number;
    lexical_score: number;
    final_score: number;
};

export const PERSONAL_TOPK = 6;

export type RerankedDoc = RetrievedDoc & {
    token_score: number;
    rerank_score: number;
};

const normalize = (text: string): string =>
    text
        .toLowerCase()
        .replace(/[^a-z0-9가-힣\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

const tokenize = (text: string): string[] => normalize(text).split(' ').filter((t) => t.length > 1);

const tokenOverlap = (queryTokens: string[], target: string): number => {
    if (!queryTokens.length) return 0;
    const targetSet = new Set(tokenize(target));
    let hit = 0;
    for (const q of queryTokens) {
        if (targetSet.has(q)) hit += 1;
    }
    return hit / queryTokens.length;
};

export const rerankDocs = (params: { question: string; docs: RetrievedDoc[]; topk?: number }): RerankedDoc[] => {
    const qTokens = tokenize(params.question);
    const docs = params.docs || [];

    const ranked = docs
        .map((doc) => {
            const tokenScore = tokenOverlap(qTokens, `${doc.title} ${doc.content}`);
            const rerankScore = doc.final_score * 0.8 + tokenScore * 0.2;
            return {
                ...doc,
                token_score: tokenScore,
                rerank_score: rerankScore
            };
        })
        .sort((a, b) => b.rerank_score - a.rerank_score);

    return ranked.slice(0, Math.max(1, params.topk ?? PERSONAL_TOPK));
};
