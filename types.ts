export type UUID = string;

export enum DocumentStatus {
  Queued = 'queued',
  Processing = 'processing',
  Done = 'done',
  Failed = 'failed',
}

export enum LinkStatus {
  Candidate = 'candidate',
  Accepted = 'accepted',
  Rejected = 'rejected',
}

export enum EntityType {
  Document = 'document',
  Chunk = 'chunk',
}

// For structured extracted knowledge
export interface KnowledgeSegment {
  id: UUID;
  category: string; // e.g., "Frontend", "Marketing", "N8N"
  topic: string;
  content: string; // The refined insight
  originalRange: [number, number]; // Line start, Line end
  relevance: number; // 0-100 score
}

// For Action Plans
export interface ActionItem {
  id: string;
  step: string;
  description: string;
  priority: 'High' | 'Medium' | 'Low';
}

export interface ApplicationPoint {
  context: string;
  suggestion: string;
}

export type RelationSignalType = 'conflict' | 'complement';

export interface KnowledgeRelationSignal {
  id: UUID;
  type: RelationSignalType;
  topic: string;
  summary: string;
  confidence: number; // 0-1
  relatedDocumentIds: UUID[];
  evidenceSegmentIds?: UUID[];
}

export interface AutoLinkSuggestion {
  id: UUID;
  fromId: UUID;
  toId: UUID;
  relation: 'supports' | 'contradicts' | 'extends' | 'duplicates' | 'related_to';
  confidence: number; // 0-1
  rationale: string;
  status: 'suggested' | 'accepted' | 'rejected';
  generatedAt: string; // ISO Date
}

export interface ActionPlanData {
  goal: string;
  steps: ActionItem[];
  applications: ApplicationPoint[];
}

// For Chat Export reconstruction
export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

export interface Document {
  id: UUID;
  workspaceId: UUID;
  sourceType: 'manual' | 'chatgpt' | 'gemini' | 'claude' | 'url';
  title: string;
  rawText: string;

  // New: Dual Representation
  docType: 'text' | 'conversation';
  conversationData?: ConversationMessage[]; // If it's a chat log
  segments?: KnowledgeSegment[]; // If it's a text/article

  // New: Action Oriented
  actionPlan?: ActionPlanData;

  // Phase 2 (interface-first): relation intelligence signals
  relationSignals?: KnowledgeRelationSignal[];
  autoLinkSuggestions?: AutoLinkSuggestion[];

  status: DocumentStatus;
  aiMeta?: {
    modelUsed?: 'gpt-5-nano' | 'gpt-5-mini' | string;
    fallbackUsed?: boolean;
    confidence?: number;
    ambiguity?: boolean;
    retryReason?: string;
  };
  summaryText?: string;
  summaryBullets?: string[];

  // Ontology Metrics
  knowledgeScore: number; // 0-100 (Quantified Knowledge)
  topicTags: string[];

  createdAt: string; // ISO Date
}

export interface Chunk {
  id: UUID;
  documentId: UUID;
  chunkIndex: number;
  text: string;
}

export interface LinkCandidate {
  id: UUID;
  fromId: UUID;
  toId: UUID;
  toTitle: string; // Denormalized for UI
  toSnippet: string;
  relation: string; // e.g., 'related_to'
  confidence: number;
  rationale: string;
  status: LinkStatus;
}

export interface Edge {
  id: UUID;
  source: UUID; // D3 expects source/target
  target: UUID;
  relation: string;
  status: 'confirmed' | 'candidate';
}

export interface Node {
  id: UUID;
  title: string;
  group: number; // 1: Document, 2: Chunk (Future)
  status: DocumentStatus;
  val?: number; // For visualization size based on knowledge score
  tags?: string[]; // Added for TopicMap grouping
}

export interface QASession {
  id: UUID;
  question: string;
  answer: string;
  aiMeta?: {
    modelUsed?: 'gpt-5-nano' | 'gpt-5-mini' | string;
    fallbackUsed?: boolean;
    confidence?: number;
    ambiguity?: boolean;
    retryReason?: string;
  };
  evidence: Array<{
    id: UUID;
    title: string;
    snippet: string;
    segmentId?: string;
  }>;
  createdAt: string;
}

export interface MemoryItem {
  id: UUID;
  documentId: UUID;
  title: string;
  category: 'summary' | 'fact' | 'action' | 'segment';
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface RetrievalScore {
  lexical: number;
  tagOverlap: number;
  recency: number;
  total: number;
}

export interface RetrievalCandidate {
  documentId: UUID;
  memoryItemId?: UUID;
  title: string;
  snippet: string;
  score: RetrievalScore;
}
