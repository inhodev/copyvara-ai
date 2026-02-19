import { AutoLinkSuggestion, Document, KnowledgeRelationSignal } from "../types";

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

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '');
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const ensureConfig = () => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Supabase 환경변수(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)가 설정되지 않았습니다.');
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

  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    const message = json?.error?.message || json?.message || `Edge Function 호출 실패: ${functionName}`;
    throw new Error(message);
  }

  return json as T;
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
