import React, { useState } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { useAppStore } from '../store';
import { ArrowLeft, Check, X, Link as LinkIcon, ExternalLink, Network, Bot, User, Code, FileText, Layers, Quote, Target, ListTodo, Lightbulb, Edit2, Trash2, Save, AlertTriangle, Sparkles } from 'lucide-react';

export const DocumentDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const backPath = (location.state as { from?: string } | undefined)?.from || '/';
  const { documents, candidates, acceptCandidate, rejectCandidate, edges, deleteEdge, updateEdge } = useAppStore();
  const [activeTab, setActiveTab] = useState<'insight' | 'source' | 'action'>('insight');
  const [highlightRange, setHighlightRange] = useState<[number, number] | null>(null);

  // State for editing edge
  const [editingEdgeId, setEditingEdgeId] = useState<string | null>(null);
  const [editRelationValue, setEditRelationValue] = useState('');

  const doc = documents.find(d => d.id === id);
  const docCandidates = candidates.filter(c => c.fromId === id || c.toId === id);
  const confirmedLinks = edges.filter(e => (e.source === id || e.target === id) && e.status === 'confirmed');

  const startEditing = (edgeId: string, currentRelation: string) => {
    setEditingEdgeId(edgeId);
    setEditRelationValue(currentRelation);
  };

  const saveEdit = (edgeId: string) => {
    if (editRelationValue.trim()) {
      updateEdge(edgeId, editRelationValue);
    }
    setEditingEdgeId(null);
  };

  if (!doc) return <div className="p-8 text-center text-slate-500">문서를 찾을 수 없습니다</div>;

  return (
    <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-6 h-[calc(100vh-8rem)]">

      {/* LEFT COLUMN: DOCUMENT CONTENT (Scrollable) */}
      <div className="flex-1 flex flex-col min-w-0 bg-white rounded-xl shadow-sm border border-warm-200 overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-warm-200 bg-white shrink-0">
          <div className="flex items-center justify-between mb-4">
            <Link to={backPath} className="inline-flex items-center text-sm text-slate-500 hover:text-brand-600 transition-colors">
              <ArrowLeft size={16} className="mr-1" /> 돌아가기
            </Link>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${doc.sourceType === 'manual' ? 'bg-slate-100 text-slate-600' : 'bg-green-100 text-green-700'}`}>
                {doc.sourceType === 'manual' ? 'Text Upload' : `${doc.sourceType} Link`}
              </span>
              <span className="bg-brand-50 text-brand-700 px-2 py-1 rounded text-xs font-bold border border-brand-100">
                Ontology Score: {doc.knowledgeScore}
              </span>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 leading-tight mb-2">{doc.title}</h1>
          <div className="flex items-center gap-2">
            {doc.topicTags?.map(tag => (
              <span key={tag} className="text-xs bg-warm-100 text-slate-600 px-2 py-0.5 rounded-full">#{tag}</span>
            ))}
          </div>
          {doc.aiMeta && (
            <div className="mt-3 text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 inline-flex items-center gap-2">
              <span className="font-semibold">{doc.aiMeta.modelUsed || 'model'}</span>
              {doc.aiMeta.fallbackUsed && (
                <span className="text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded text-[10px] font-bold">fallback</span>
              )}
              {typeof doc.aiMeta.confidence === 'number' && (
                <span>conf {Math.round(doc.aiMeta.confidence * 100)}%</span>
              )}
            </div>
          )}
        </div>

        {/* View Toggle */}
        <div className="px-6 py-2 bg-warm-50 border-b border-warm-200 flex gap-4 shrink-0 overflow-x-auto">
          <button
            onClick={() => setActiveTab('insight')}
            className={`flex items-center gap-2 pb-2 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'insight' ? 'border-brand-500 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            <Layers size={16} /> 구조화된 뷰 (Insights)
          </button>
          <button
            onClick={() => setActiveTab('action')}
            className={`flex items-center gap-2 pb-2 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'action' ? 'border-brand-500 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            <Target size={16} /> 액션 플랜 (Action Plan)
          </button>
          <button
            onClick={() => setActiveTab('source')}
            className={`flex items-center gap-2 pb-2 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${activeTab === 'source' ? 'border-brand-500 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            <Code size={16} /> 원본 소스 (Source)
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-warm-50/30">

          {/* VIEW: INSIGHTS (Conversation or Segments) */}
          {activeTab === 'insight' && (
            <div className="space-y-6">

              {/* Summary Block */}
              <div className="bg-white p-5 rounded-xl border border-warm-200 shadow-sm">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                  <FileText size={16} /> 전체 요약
                </h3>
                <p className="text-slate-700 leading-relaxed text-sm mb-4">{doc.summaryText}</p>
                {doc.summaryBullets && (
                  <ul className="space-y-2">
                    {doc.summaryBullets.map((bullet, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-brand-400 shrink-0" />
                        {bullet}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {(doc.relationSignals?.length || 0) > 0 && (
                <div className="bg-white p-5 rounded-xl border border-warm-200 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-2">
                    <Sparkles size={16} /> 관계 시그널 (Beta)
                  </h3>
                  <div className="space-y-3">
                    {doc.relationSignals?.map((signal) => (
                      <div
                        key={signal.id}
                        className={`rounded-lg border p-3 ${signal.type === 'conflict' ? 'border-rose-200 bg-rose-50/40' : 'border-emerald-200 bg-emerald-50/40'}`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="inline-flex items-center gap-1 text-xs font-bold uppercase">
                            {signal.type === 'conflict' ? <AlertTriangle size={12} className="text-rose-600" /> : <Sparkles size={12} className="text-emerald-600" />}
                            <span className={signal.type === 'conflict' ? 'text-rose-700' : 'text-emerald-700'}>
                              {signal.type === 'conflict' ? '충돌 가능성' : '보완 가능성'}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-500">conf {Math.round(signal.confidence * 100)}%</span>
                        </div>
                        <div className="text-xs text-slate-500 mb-1">topic: {signal.topic}</div>
                        <p className="text-sm text-slate-700 leading-relaxed">{signal.summary}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Conditional Content: Conversation Chat UI vs Knowledge Segments */}
              {doc.docType === 'conversation' && doc.conversationData ? (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide px-1">대화 복원 (Reconstructed Chat)</h3>
                  {doc.conversationData.map((msg, idx) => (
                    <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      {msg.role === 'assistant' && (
                        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-700 shrink-0 mt-1 border border-green-200">
                          <Bot size={16} />
                        </div>
                      )}
                      <div className={`max-w-[80%] p-4 rounded-2xl text-sm leading-relaxed shadow-sm ${msg.role === 'user'
                        ? 'bg-slate-100 text-slate-800 rounded-tr-none'
                        : 'bg-white border border-warm-200 text-slate-700 rounded-tl-none'
                        }`}>
                        <div className="whitespace-pre-wrap">{msg.content}</div>
                      </div>
                      {msg.role === 'user' && (
                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 shrink-0 mt-1">
                          <User size={16} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide px-1">지식 세그먼트 (Knowledge Segments)</h3>
                  {doc.segments?.map((seg) => (
                    <div key={seg.id} className="bg-white p-5 rounded-xl border border-warm-200 hover:border-brand-300 transition-colors shadow-sm group">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <span className="bg-brand-50 text-brand-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase">{seg.category}</span>
                          <span className="text-sm font-bold text-slate-800">{seg.topic}</span>
                        </div>
                        <span className="text-xs text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">Line {seg.originalRange[0]}-{seg.originalRange[1]}</span>
                      </div>
                      <p className="text-slate-600 text-sm leading-relaxed">{seg.content}</p>
                      <button
                        onClick={() => {
                          setHighlightRange(seg.originalRange);
                          setActiveTab('source');
                        }}
                        className="mt-3 text-xs text-brand-600 font-medium flex items-center gap-1 hover:underline opacity-60 group-hover:opacity-100"
                      >
                        <Quote size={12} /> 원본 위치 확인
                      </button>
                    </div>
                  ))}
                  {(!doc.segments || doc.segments.length === 0) && (
                    <div className="text-center py-10 text-slate-400 italic">추출된 지식 세그먼트가 없습니다.</div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* VIEW: ACTION PLAN */}
          {activeTab === 'action' && (
            <div className="space-y-8 animate-fadeIn">
              {/* Goal Section */}
              <div className="bg-gradient-to-r from-brand-50 to-white p-6 rounded-xl border border-brand-100 shadow-sm">
                <h3 className="font-bold text-brand-800 flex items-center gap-2 mb-3">
                  <Target size={20} className="text-brand-600" /> 핵심 목표 (Goal)
                </h3>
                <p className="text-lg text-brand-900 font-medium leading-relaxed">
                  "{doc.actionPlan?.goal || "이 지식을 활용하여 구체적인 성과를 만들어냅니다."}"
                </p>
              </div>

              {/* Steps */}
              <div>
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-4 flex items-center gap-2 px-1">
                  <ListTodo size={16} /> 실행 단계 (Action Steps)
                </h3>
                <div className="space-y-4">
                  {doc.actionPlan?.steps.map((step, idx) => (
                    <div key={step.id || idx} className="bg-white p-5 rounded-xl border border-warm-200 shadow-sm flex gap-4 items-start group hover:border-brand-200 transition-colors">
                      <div className={`mt-1 w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 border shadow-sm ${step.priority === 'High' ? 'bg-red-50 text-red-600 border-red-100' :
                        step.priority === 'Medium' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-slate-50 text-slate-500 border-slate-100'
                        }`}>
                        {step.priority === 'High' ? 'H' : step.priority === 'Medium' ? 'M' : 'L'}
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-center mb-1">
                          <h4 className="font-bold text-slate-800 text-lg">{step.step}</h4>
                          <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${step.priority === 'High' ? 'bg-red-100 text-red-600' :
                            step.priority === 'Medium' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'
                            }`}>{step.priority} Priority</span>
                        </div>
                        <p className="text-slate-600 leading-relaxed text-sm">{step.description}</p>
                      </div>
                    </div>
                  ))}
                  {!doc.actionPlan?.steps.length && (
                    <div className="text-center py-8 text-slate-400 bg-warm-50 rounded-xl border border-dashed border-warm-200">
                      실행 단계가 생성되지 않았습니다.
                    </div>
                  )}
                </div>
              </div>

              {/* Applications */}
              <div>
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-4 flex items-center gap-2 px-1">
                  <Lightbulb size={16} /> 실무 적용점 (Applications)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {doc.actionPlan?.applications.map((app, i) => (
                    <div key={i} className="bg-white p-5 rounded-xl border border-warm-200 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-brand-500"></div>
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{app.context}</span>
                      </div>
                      <p className="text-slate-700 font-medium leading-relaxed">
                        {app.suggestion}
                      </p>
                    </div>
                  ))}
                  {!doc.actionPlan?.applications.length && (
                    <div className="text-center py-8 text-slate-400 bg-warm-50 rounded-xl border border-dashed border-warm-200 col-span-2">
                      적용점이 생성되지 않았습니다.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* VIEW: SOURCE (Raw Text) */}
          {activeTab === 'source' && (
            <div className="bg-slate-900 text-slate-300 p-6 rounded-xl font-mono text-xs leading-relaxed overflow-x-auto shadow-inner min-h-full">
              {highlightRange && (
                <div className="mb-3 text-[11px] text-amber-300 bg-amber-900/30 border border-amber-600/40 rounded px-2 py-1">
                  Anchored range: line {highlightRange[0]}-{highlightRange[1]}
                </div>
              )}
              <pre className="whitespace-pre-wrap">{doc.rawText}</pre>
            </div>
          )}

        </div>
      </div>

      {/* RIGHT COLUMN: METADATA & GRAPH ACTIONS */}
      <div className="w-full lg:w-80 flex flex-col gap-6 shrink-0 overflow-y-auto">

        {/* Candidates Section */}
        <div className="bg-gradient-to-b from-amber-50 to-white rounded-xl shadow-sm border border-amber-200 p-5 shrink-0">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-amber-900 flex items-center gap-2">
              <LinkIcon size={18} />
              추천 연결
            </h3>
            <span className="bg-amber-200 text-amber-800 text-xs font-bold px-2 py-0.5 rounded-full">
              {docCandidates.length}
            </span>
          </div>

          <div className="space-y-3">
            {docCandidates.length === 0 && (
              <p className="text-sm text-amber-800/60 italic text-center py-4">아직 추천 연결이 없습니다.</p>
            )}
            {docCandidates.map(candidate => (
              <div key={candidate.id} className="bg-white p-3 rounded-lg border border-amber-100 shadow-sm hover:shadow transition-shadow">
                <div className="flex justify-between items-start mb-2">
                  <div className="text-xs font-semibold text-amber-600 uppercase">
                    {Math.round(candidate.confidence * 100)}% 일치
                  </div>
                </div>
                <h4 className="text-sm font-bold text-slate-800 mb-1">{candidate.toTitle}</h4>
                <p className="text-xs text-slate-500 mb-3 line-clamp-2">"{candidate.toSnippet}"</p>
                <div className="text-xs bg-slate-50 p-2 rounded mb-3 text-slate-600 border border-slate-100">
                  <span className="font-semibold text-brand-600">AI 분석:</span> {candidate.rationale}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => acceptCandidate(candidate.id)}
                    className="flex-1 bg-brand-600 hover:bg-brand-700 text-white text-xs font-medium py-1.5 rounded flex items-center justify-center gap-1 transition-colors"
                  >
                    <Check size={14} /> 확정
                  </button>
                  <button
                    onClick={() => rejectCandidate(candidate.id)}
                    className="flex-1 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 text-xs font-medium py-1.5 rounded flex items-center justify-center gap-1 transition-colors"
                  >
                    <X size={14} /> 거절
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Confirmed Links */}
        <div className="bg-white rounded-xl shadow-sm border border-warm-200 p-5 shrink-0">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Network size={18} className="text-brand-600" />
            연결된 지식
          </h3>
          <div className="space-y-3">
            {confirmedLinks.length === 0 && (
              <p className="text-sm text-slate-400 italic">아직 확인된 연결이 없습니다.</p>
            )}
            {confirmedLinks.map(edge => {
              const isEditing = editingEdgeId === edge.id;
              const targetId = edge.source === id ? edge.target : edge.source;
              // In a real app, find title from ID. Using generic name for now or finding from docs if available (would be slow without map)
              const targetDoc = documents.find(d => d.id === targetId);
              const targetTitle = targetDoc?.title || "Linked Document";

              return (
                <div key={edge.id} className="p-3 bg-slate-50 rounded-lg border border-slate-100 group hover:border-brand-200 transition-all">

                  {isEditing ? (
                    <div className="space-y-2 animate-fadeIn">
                      <input
                        type="text"
                        value={editRelationValue}
                        onChange={(e) => setEditRelationValue(e.target.value)}
                        className="w-full px-2 py-1 text-xs border border-brand-300 rounded focus:outline-none focus:ring-1 focus:ring-brand-500"
                        placeholder="관계 이름 입력..."
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveEdit(edge.id)}
                          className="flex-1 bg-brand-600 text-white text-[10px] font-bold py-1 rounded hover:bg-brand-700 flex items-center justify-center gap-1"
                        >
                          <Save size={10} /> 저장
                        </button>
                        <button
                          onClick={() => deleteEdge(edge.id)}
                          className="flex-1 bg-red-100 text-red-600 text-[10px] font-bold py-1 rounded hover:bg-red-200 flex items-center justify-center gap-1"
                        >
                          <Trash2 size={10} /> 삭제
                        </button>
                        <button
                          onClick={() => setEditingEdgeId(null)}
                          className="px-2 py-1 bg-white border border-slate-300 text-slate-500 text-[10px] rounded hover:bg-slate-100"
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between">
                      <Link to={`/doc/${targetId}`} className="flex-1 min-w-0 mr-2">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-brand-500 shrink-0"></div>
                          <span className="text-xs font-bold text-slate-700 truncate">{targetTitle}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 pl-3.5 flex items-center gap-1">
                          <span className="bg-slate-200 px-1 rounded text-slate-600">{edge.relation}</span>
                        </div>
                      </Link>
                      <button
                        onClick={() => startEditing(edge.id, edge.relation)}
                        className="text-slate-400 hover:text-brand-600 p-1 rounded hover:bg-brand-50 transition-colors opacity-0 group-hover:opacity-100"
                        title="관계 수정"
                      >
                        <Edit2 size={12} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
