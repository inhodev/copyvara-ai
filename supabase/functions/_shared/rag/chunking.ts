export type SourceType = 'manual' | 'chatgpt' | 'gemini' | 'claude';

export type AnalyzeSegment = {
    id?: string;
    category?: string;
    topic?: string;
    content?: string;
    originalRange?: [number, number];
    relevance?: number;
};

export type AnalyzeDataForChunking = {
    title: string;
    docType: 'text' | 'conversation';
    summaryText?: string;
    summaryBullets?: string[];
    topicTags?: string[];
    segments?: AnalyzeSegment[];
    conversationData?: Array<{ role: 'user' | 'assistant'; content: string }>;
};

export type RagChunkInput = {
    id: string;
    title: string;
    content: string;
    segmentId?: string;
    metadata: Record<string, unknown>;
};

const normalize = (text: string): string => text.replace(/\s+/g, ' ').trim();

const splitByTokenBudget = (text: string, maxChars = 1200, overlapChars = 180): string[] => {
    const normalized = normalize(text);
    if (!normalized) return [];
    if (normalized.length <= maxChars) return [normalized];

    const chunks: string[] = [];
    let start = 0;
    while (start < normalized.length) {
        const end = Math.min(start + maxChars, normalized.length);
        const slice = normalized.slice(start, end).trim();
        if (slice) chunks.push(slice);
        if (end >= normalized.length) break;
        start = Math.max(0, end - overlapChars);
    }
    return chunks;
};

export const buildRagChunks = (params: {
    documentId: string;
    sourceType: SourceType;
    rawInput: string;
    data: AnalyzeDataForChunking;
}): RagChunkInput[] => {
    const { documentId, sourceType, rawInput, data } = params;
    const topicTags = data.topicTags || [];
    const out: RagChunkInput[] = [];
    let order = 0;

    if (data.summaryText?.trim()) {
        out.push({
            id: `${documentId}-summary`,
            title: `${data.title} summary`,
            content: normalize(data.summaryText),
            metadata: {
                chunk_kind: 'summary',
                chunk_order: order++,
                source_type: sourceType,
                topic_tags: topicTags,
                doc_type: data.docType
            }
        });
    }

    (data.summaryBullets || []).slice(0, 8).forEach((bullet, idx) => {
        const content = normalize(String(bullet || ''));
        if (!content) return;
        out.push({
            id: `${documentId}-bullet-${idx}`,
            title: `${data.title} bullet ${idx + 1}`,
            content,
            metadata: {
                chunk_kind: 'bullet',
                chunk_order: order++,
                source_type: sourceType,
                topic_tags: topicTags,
                doc_type: data.docType
            }
        });
    });

    (data.segments || []).slice(0, 24).forEach((seg, idx) => {
        const content = normalize(String(seg?.content || ''));
        if (!content) return;
        out.push({
            id: `${documentId}-segment-${idx}`,
            title: `${data.title} / ${seg?.topic || 'segment'}`,
            content,
            segmentId: seg?.id,
            metadata: {
                chunk_kind: 'segment',
                chunk_order: order++,
                source_type: sourceType,
                topic_tags: topicTags,
                doc_type: data.docType,
                segment_topic: seg?.topic || null,
                segment_category: seg?.category || null,
                segment_relevance: Number(seg?.relevance ?? 0)
            }
        });
    });

    const bodyChunks = splitByTokenBudget(rawInput, 1200, 180).slice(0, 12);
    bodyChunks.forEach((content, idx) => {
        out.push({
            id: `${documentId}-body-${idx}`,
            title: `${data.title} body ${idx + 1}`,
            content,
            metadata: {
                chunk_kind: 'body',
                chunk_order: order++,
                source_type: sourceType,
                topic_tags: topicTags,
                doc_type: data.docType
            }
        });
    });

    return out.map((chunk) => ({
        ...chunk,
        metadata: {
            ...chunk.metadata,
            token_count: Math.ceil(chunk.content.length / 4)
        }
    }));
};

