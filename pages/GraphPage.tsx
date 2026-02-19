import React, { useState } from 'react';
import { useAppStore } from '../store';
import { ForceGraph } from '../components/ForceGraph';
import { TimelineView } from '../components/TimelineView';
import { TopicMap } from '../components/TopicMap';
import { MatrixView } from '../components/MatrixView';
import { SunburstChart } from '../components/SunburstChart';
import { TreeMap } from '../components/TreeMap';
import { RadialTree } from '../components/RadialTree';
import { TagCloud } from '../components/TagCloud';
import { MemoryDecay } from '../components/MemoryDecay';
import { CompetenceRadar } from '../components/CompetenceRadar';
import { KnowledgeStream } from '../components/KnowledgeStream';
import { StrategicQuadrant } from '../components/StrategicQuadrant';
import { ConceptChord } from '../components/ConceptChord';

import { useNavigate } from 'react-router-dom';
import { Network, Calendar, Grid3X3, CircleDashed, PieChart, LayoutGrid, GitFork, Hash, Activity, Radar, Waves, Target, Infinity, X, ExternalLink, FileText, ListTodo, Loader2, Check, AlertTriangle } from 'lucide-react';

type ViewMode = 'graph' | 'timeline' | 'topic' | 'matrix' | 'sunburst' | 'treemap' | 'radial' | 'cloud' |
    'decay' | 'radar' | 'stream' | 'quadrant' | 'chord';

export const GraphPage: React.FC = () => {
    const { nodes, edges, documents, candidates, acceptCandidate, rejectCandidate } = useAppStore();
    const navigate = useNavigate();
    const [viewMode, setViewMode] = useState<ViewMode>('graph');
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

    // Find selected document for the side panel
    const selectedDoc = selectedNodeId ? documents.find(d => d.id === selectedNodeId) : null;
    const selectedDocCandidates = selectedDoc
        ? candidates.filter(c => c.fromId === selectedDoc.id || c.toId === selectedDoc.id)
        : [];

    const handleNodeClick = (nodeId: string) => {
        setSelectedNodeId(nodeId);
    };

    const closeSidePanel = () => {
        setSelectedNodeId(null);
    };

    const navBtnClass = (mode: ViewMode, icon: React.ReactNode, label: string) => (
        <button
            onClick={() => setViewMode(mode)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap ${viewMode === mode ? 'bg-brand-50 text-brand-700 shadow-sm border border-brand-200' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }`}
        >
            {icon} {label}
        </button>
    );

    return (
        <div className="h-[calc(100vh-8rem)] flex flex-col gap-4 relative">
            {/* Toolbar */}
            <div className="flex flex-col gap-3 bg-white p-4 rounded-xl border border-warm-200 shadow-sm shrink-0">
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-lg font-bold text-slate-800">지식 자산 시각화</h2>
                        <p className="text-xs text-slate-500">데이터 구조, 성장 지표, 인사이트를 다각도로 분석하세요.</p>
                    </div>
                </div>

                <div className="flex flex-col gap-2">
                    {/* Group 1: Structure */}
                    <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase mr-1">Structure</span>
                        {navBtnClass('graph', <Network size={14} />, "네트워크")}
                        {navBtnClass('topic', <CircleDashed size={14} />, "토픽 맵")}
                        {navBtnClass('radial', <GitFork size={14} />, "트리")}
                        {navBtnClass('sunburst', <PieChart size={14} />, "썬버스트")}
                        {navBtnClass('treemap', <LayoutGrid size={14} />, "트리맵")}
                    </div>

                    {/* Group 2: Analysis & Insight */}
                    <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1 border-t border-slate-100 pt-2">
                        <span className="text-[10px] font-bold text-brand-400 uppercase mr-1">Insight</span>
                        {navBtnClass('timeline', <Calendar size={14} />, "타임라인")}
                        {navBtnClass('decay', <Activity size={14} />, "망각 곡선")}
                        {navBtnClass('radar', <Radar size={14} />, "역량 밸런스")}
                        {navBtnClass('stream', <Waves size={14} />, "성장 흐름")}
                        {navBtnClass('quadrant', <Target size={14} />, "전략 사분면")}
                        {navBtnClass('chord', <Infinity size={14} />, "개념 융합")}
                    </div>
                </div>
            </div>

            {/* Visualizer Container */}
            <div className="flex-1 bg-white border border-slate-200 rounded-xl shadow-inner relative overflow-hidden flex">
                <div className="flex-1 relative overflow-hidden">
                    {nodes.length === 0 ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                            <p>데이터가 비어 있습니다.</p>
                            <p className="text-sm">문서를 추가하여 시각화를 확인하세요.</p>
                        </div>
                    ) : (
                        <>
                            {viewMode === 'graph' && <ForceGraph nodes={nodes} edges={edges} onNodeClick={handleNodeClick} />}
                            {viewMode === 'timeline' && <TimelineView nodes={nodes} edges={edges} onNodeClick={handleNodeClick} />}
                            {viewMode === 'topic' && <TopicMap nodes={nodes} onNodeClick={handleNodeClick} />}
                            {viewMode === 'matrix' && <MatrixView nodes={nodes} edges={edges} onNodeClick={handleNodeClick} />}
                            {viewMode === 'sunburst' && <SunburstChart nodes={nodes} onNodeClick={handleNodeClick} />}
                            {viewMode === 'treemap' && <TreeMap nodes={nodes} onNodeClick={handleNodeClick} />}
                            {viewMode === 'radial' && <RadialTree nodes={nodes} onNodeClick={handleNodeClick} />}
                            {viewMode === 'cloud' && <TagCloud nodes={nodes} />}

                            {viewMode === 'decay' && <MemoryDecay nodes={nodes} onNodeClick={handleNodeClick} />}
                            {viewMode === 'radar' && <CompetenceRadar nodes={nodes} />}
                            {viewMode === 'stream' && <KnowledgeStream nodes={nodes} />}
                            {viewMode === 'quadrant' && <StrategicQuadrant nodes={nodes} edges={edges} onNodeClick={handleNodeClick} />}
                            {viewMode === 'chord' && <ConceptChord nodes={nodes} edges={edges} />}
                        </>
                    )}

                    {/* Footer Legend (Dynamic based on view) */}
                    {viewMode === 'graph' && (
                        <div className="flex gap-2 text-xs absolute bottom-4 right-4 bg-white/90 p-2 rounded-lg border border-slate-200 shadow-sm pointer-events-none">
                            <div className="flex items-center gap-1">
                                <span className="w-3 h-3 rounded-full bg-brand-500"></span> 문서
                            </div>
                            <div className="flex items-center gap-1 ml-4">
                                <span className="w-6 h-0.5 bg-slate-400"></span> 확정됨
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="w-6 h-0.5 border-t border-dashed border-amber-400"></span> 후보
                            </div>
                        </div>
                    )}
                </div>

                {/* Side Panel (Slide Over) */}
                <div className={`w-96 bg-white border-l border-warm-200 shadow-xl absolute top-0 right-0 bottom-0 z-20 transform transition-transform duration-300 flex flex-col ${selectedDoc ? 'translate-x-0' : 'translate-x-full'}`}>
                    {selectedDoc ? (
                        <>
                            <div className="p-5 border-b border-warm-200 bg-warm-50/50 flex justify-between items-start shrink-0">
                                <div>
                                    <span className="text-[10px] font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded uppercase mb-2 inline-block">
                                        {selectedDoc.sourceType}
                                    </span>
                                    <h3 className="text-lg font-bold text-slate-800 leading-tight line-clamp-2 pr-2">
                                        {selectedDoc.title}
                                    </h3>
                                </div>
                                <button onClick={closeSidePanel} className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded">
                                    <X size={18} />
                                </button>
                            </div>

                            <div className="p-5 overflow-y-auto flex-1 space-y-6">
                                {/* Metrics */}
                                <div className="flex items-center gap-4">
                                    <div className="flex-1 bg-slate-50 p-3 rounded-lg border border-slate-100 text-center">
                                        <div className="text-xs text-slate-500 uppercase font-bold mb-1">지식 점수</div>
                                        <div className="text-xl font-bold text-brand-600">{selectedDoc.knowledgeScore}</div>
                                    </div>
                                    <div className="flex-1 bg-slate-50 p-3 rounded-lg border border-slate-100 text-center">
                                        <div className="text-xs text-slate-500 uppercase font-bold mb-1">토픽</div>
                                        <div className="text-sm font-bold text-slate-700 truncate">{selectedDoc.topicTags?.[0] || '-'}</div>
                                    </div>
                                </div>

                                {/* Summary */}
                                <div>
                                    <h4 className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1">
                                        <FileText size={12} /> 요약
                                    </h4>
                                    <p className="text-sm text-slate-600 leading-relaxed bg-white p-3 rounded-lg border border-warm-100 shadow-sm">
                                        {selectedDoc.summaryText}
                                    </p>
                                </div>

                                {/* Bullets */}
                                {selectedDoc.summaryBullets && (
                                    <div>
                                        <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">핵심 포인트</h4>
                                        <ul className="space-y-2">
                                            {selectedDoc.summaryBullets.slice(0, 3).map((bullet, i) => (
                                                <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                                                    <span className="mt-1 w-1 h-1 rounded-full bg-brand-400 shrink-0"></span>
                                                    {bullet}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {/* Action Plan Snippet */}
                                {selectedDoc.actionPlan && (
                                    <div>
                                        <h4 className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1">
                                            <ListTodo size={12} /> 추천 액션
                                        </h4>
                                        <div className="bg-amber-50 p-3 rounded-lg border border-amber-100 text-xs text-amber-900 leading-relaxed">
                                            <span className="font-bold">Goal:</span> {selectedDoc.actionPlan.goal}
                                        </div>
                                    </div>
                                )}

                                {/* Auto Link Suggestions */}
                                <div>
                                    <h4 className="text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1">
                                        <AlertTriangle size={12} /> 자동 연결 제안 (Beta)
                                    </h4>
                                    <div className="space-y-2">
                                        {selectedDocCandidates.length === 0 && (
                                            <div className="text-xs text-slate-400 bg-slate-50 border border-slate-100 rounded-lg p-3">제안이 없습니다.</div>
                                        )}
                                        {selectedDocCandidates.slice(0, 3).map((candidate) => (
                                            <div key={candidate.id} className="border border-warm-200 rounded-lg p-3 bg-white">
                                                <div className="text-xs font-semibold text-slate-700 mb-1">{candidate.toTitle}</div>
                                                <div className="text-[11px] text-slate-500 mb-2">{Math.round(candidate.confidence * 100)}% · {candidate.relation}</div>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => acceptCandidate(candidate.id)}
                                                        className="flex-1 text-xs bg-brand-600 hover:bg-brand-700 text-white rounded py-1.5 inline-flex items-center justify-center gap-1"
                                                    >
                                                        <Check size={12} /> 승인
                                                    </button>
                                                    <button
                                                        onClick={() => rejectCandidate(candidate.id)}
                                                        className="flex-1 text-xs bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded py-1.5"
                                                    >
                                                        거절
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="p-4 border-t border-warm-200 bg-white shrink-0">
                                <button
                                    onClick={() => navigate(`/doc/${selectedDoc.id}`)}
                                    className="w-full flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-bold py-2.5 rounded-lg transition-colors text-sm"
                                >
                                    전체 문서 및 연결 관리 <ExternalLink size={14} />
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400">
                            <Loader2 className="animate-spin mb-2 opacity-50" />
                            <p className="text-xs">Loading...</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
