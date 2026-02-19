import { AutoLinkSuggestion, Document, DocumentStatus, KnowledgeRelationSignal } from "../types";

type SourceType = 'chatgpt' | 'gemini' | 'claude' | 'manual';

type AnalyzeContextDoc = Pick<Document, 'id' | 'title' | 'topicTags' | 'summaryText'>;

interface ApiEnvelope<T> {
  data?: T;
  meta?: {
    requestId: string;
    modelUsed: 'gpt-5-nano' | 'gpt-5-mini';
    fallbackUsed: boolean;
    confidence: number;
    ambiguity: boolean;
    retryReason?: string;
  };
}

interface AnalyzeData extends Partial<Document> {
  relationSignals?: KnowledgeRelationSignal[];
  autoLinkSuggestions?: AutoLinkSuggestion[];
}

type SupabaseDocumentRow = {
  id: string;
  workspace_id: string;
  source_type: string;
  title: string;
  raw_text: string | null;
  summary_text: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at?: string;
};

const RAW_SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_URL = RAW_SUPABASE_URL
  ?.trim()
  .replace(/^https?:\/\/https?:\/\//i, 'https://')
  .replace(/\/$/, '');
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
let hasLoggedSupabaseEnv = false;

const ensureConfig = () => {
  if (!hasLoggedSupabaseEnv) {
    console.log('[Supabase Debug] VITE_SUPABASE_URL =', SUPABASE_URL);
    console.log('[Supabase Debug] VITE_SUPABASE_ANON_KEY exists =', Boolean(SUPABASE_ANON_KEY));
    hasLoggedSupabaseEnv = true;
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Supabase 환경변수(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)가 설정되지 않았습니다.');
  }

  if (!/^https:\/\//i.test(SUPABASE_URL)) {
    throw new Error(`VITE_SUPABASE_URL 형식 오류: ${SUPABASE_URL}`);
  }
};

const callEdgeFunction = async <T>(functionName: string, payload: unknown): Promise<T> => {
  ensureConfig();

  const res = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'X-Client-Version': 'copyvara-web-v0.3'
    },
    body: JSON.stringify(payload)
  });

  const bodyText = await res.text();
  let json: unknown = {};
  try {
    json = bodyText ? JSON.parse(bodyText) : {};
  } catch {
    json = {};
  }

  if (!res.ok) {
    const textForError = bodyText || JSON.stringify(json || {});
    throw new Error(`Edge ${functionName} failed (${res.status}): ${textForError}`);
  }

  return json as T;
};

const callSupabaseRest = async <T>(pathWithQuery: string): Promise<T> => {
  ensureConfig();

  const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathWithQuery}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'X-Client-Version': 'copyvara-web-v0.3'
    }
  });

  const json = await res.json().catch(() => ([]));
  if (!res.ok) {
    const message = json?.error?.message || json?.message || 'Supabase REST 조회 실패';
    throw new Error(message);
  }
  return json as T;
};

const toSourceType = (value: unknown): Document['sourceType'] => {
  const v = String(value || '').toLowerCase();
  if (v === 'chatgpt' || v === 'gemini' || v === 'claude' || v === 'manual' || v === 'url') return v;
  return 'manual';
};

const toStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.map((v) => String(v)).filter(Boolean) : [];

export const fetchPersistedDocuments = async (limit = 200): Promise<Document[]> => {
  const rows = await callSupabaseRest<SupabaseDocumentRow[]>(
    `rag_documents?select=id,workspace_id,source_type,title,raw_text,summary_text,metadata,created_at,updated_at&order=created_at.desc&limit=${limit}`
  );

  return (rows || []).map((row) => {
    const metadata = (row.metadata || {}) as Record<string, unknown>;
    const analysis = (metadata.analysis || {}) as Record<string, unknown>;
    const aiMeta = (metadata.aiMeta || {}) as Record<string, unknown>;

    const topicTags = toStringArray(analysis.topicTags || metadata.topic_tags);
    const summaryBullets = toStringArray(analysis.summaryBullets || metadata.summary_bullets);

    return {
      id: String(row.id),
      workspaceId: String(row.workspace_id || 'w1'),
      sourceType: toSourceType(row.source_type),
      title: String(row.title || '제목 없는 문서'),
      rawText: String(row.raw_text || analysis.rawText || ''),
      docType: analysis.docType === 'conversation' ? 'conversation' : 'text',
      conversationData: Array.isArray(analysis.conversationData) ? (analysis.conversationData as Document['conversationData']) : undefined,
      segments: Array.isArray(analysis.segments) ? (analysis.segments as Document['segments']) : undefined,
      actionPlan: analysis.actionPlan as Document['actionPlan'],
      relationSignals: Array.isArray(analysis.relationSignals) ? (analysis.relationSignals as KnowledgeRelationSignal[]) : undefined,
      autoLinkSuggestions: Array.isArray(analysis.autoLinkSuggestions) ? (analysis.autoLinkSuggestions as AutoLinkSuggestion[]) : undefined,
      status: DocumentStatus.Done,
      aiMeta: {
        modelUsed: String(aiMeta.modelUsed || ''),
        fallbackUsed: Boolean(aiMeta.fallbackUsed),
        confidence: typeof aiMeta.confidence === 'number' ? aiMeta.confidence : undefined,
        ambiguity: typeof aiMeta.ambiguity === 'boolean' ? aiMeta.ambiguity : undefined,
        retryReason: aiMeta.retryReason ? String(aiMeta.retryReason) : undefined
      },
      summaryText: String(row.summary_text || analysis.summaryText || ''),
      summaryBullets,
      knowledgeScore: Number(analysis.knowledgeScore ?? metadata.knowledge_score ?? 0),
      topicTags,
      createdAt: String(row.created_at || new Date().toISOString())
    };
  });
};

// Helper to determine source type from text/url
export const detectSourceType = (input: string): SourceType => {
  const text = input.trim();

  const chatgptShare = /^https?:\/\/chatgpt\.com\/share\/[a-z0-9-]+\/?$/i.test(text);
  const geminiShare = /^https?:\/\/gemini\.google\.com\/share\/[a-z0-9]+\/?$/i.test(text);
  const claudeShare = /^https?:\/\/claude\.ai\/share\/[a-f0-9-]+\/?$/i.test(text);

  if (chatgptShare || text.includes('chatgpt.com') || text.includes('openai.com')) return 'chatgpt';
  if (geminiShare || text.includes('gemini.google.com')) return 'gemini';
  if (claudeShare || text.includes('claude.ai')) return 'claude';
  return 'manual';
};

export const analyzeInput = async (text: string, sourceType: SourceType): Promise<AnalyzeData> => {
  const response = await callEdgeFunction<ApiEnvelope<AnalyzeData> | AnalyzeData>('analyze', {
    input: text,
    sourceType,
    options: {
      language: 'ko',
      strictSchema: true
    }
  });

  if ((response as ApiEnvelope<AnalyzeData>).data) {
    const envelope = response as ApiEnvelope<AnalyzeData>;
    return {
      ...(envelope.data as AnalyzeData),
      aiMeta: envelope.meta
    };
  }

  return response as AnalyzeData;
};

export const analyzeInputWithContext = async (
  text: string,
  sourceType: SourceType,
  params: { documentId: string; userId?: string; contextDocs: AnalyzeContextDoc[] }
): Promise<AnalyzeData> => {
  const response = await callEdgeFunction<ApiEnvelope<AnalyzeData> | AnalyzeData>('analyze', {
    input: text,
    sourceType,
    documentId: params.documentId,
    userId: params.userId,
    contextDocs: params.contextDocs,
    options: {
      language: 'ko',
      strictSchema: true
    }
  });

  if ((response as ApiEnvelope<AnalyzeData>).data) {
    const envelope = response as ApiEnvelope<AnalyzeData>;
    return {
      ...(envelope.data as AnalyzeData),
      aiMeta: envelope.meta
    };
  }

  return response as AnalyzeData;
};

export const generateRAGAnswer = async (question: string, contextDocs: Document[], userId?: string) => {
  const response = await callEdgeFunction<ApiEnvelope<{ answer: string; evidence?: Array<{ id: string; title: string; snippet: string; segmentId?: string }>; citations?: Array<{ id: string; title: string; quote: string }> }> | { answer: string; evidence?: Array<{ id: string; title: string; snippet: string; segmentId?: string }>; citations?: Array<{ id: string; title: string; quote: string }> }>('qa', {
    question,
    userId,
    contextDocs,
    options: {
      language: 'ko',
      maxEvidence: 5
    }
  });

  const payload = (response as ApiEnvelope<{ answer: string; evidence?: Array<{ id: string; title: string; snippet: string; segmentId?: string }>; citations?: Array<{ id: string; title: string; quote: string }> }>).data
    ? (response as ApiEnvelope<{ answer: string; evidence?: Array<{ id: string; title: string; snippet: string; segmentId?: string }>; citations?: Array<{ id: string; title: string; quote: string }> }>).data
    : (response as { answer: string; evidence?: Array<{ id: string; title: string; snippet: string; segmentId?: string }>; citations?: Array<{ id: string; title: string; quote: string }> });

  const meta = (response as ApiEnvelope<{ answer: string; evidence?: Array<{ id: string; title: string; snippet: string; segmentId?: string }>; citations?: Array<{ id: string; title: string; quote: string }> }>).meta;

  return {
    answer: payload.answer,
    evidence: payload.evidence || [],
    citations: payload.citations || [],
    meta
  };
};
