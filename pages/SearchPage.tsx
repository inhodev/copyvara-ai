import React, { useState, useMemo } from 'react';
import { useAppStore } from '../store';
import { Search, FileText, ArrowRight, Filter, Calendar, Tag, Link2, Check, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Document } from '../types';

export const SearchPage: React.FC = () => {
  const { documents, candidates, acceptCandidate, rejectCandidate } = useAppStore();
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'keyword' | 'semantic'>('all');
  const [sortBy, setSortBy] = useState<'relevance' | 'date'>('date');

  // Search Logic
  const results = useMemo(() => {
    if (!query.trim()) return documents;

    const lowerQuery = query.toLowerCase();

    return documents.filter(doc => {
      const titleMatch = doc.title?.toLowerCase().includes(lowerQuery);
      const summaryMatch = doc.summaryText?.toLowerCase().includes(lowerQuery);
      const rawMatch = doc.rawText.toLowerCase().includes(lowerQuery);
      return titleMatch || summaryMatch || rawMatch;
    }).sort((a, b) => {
      if (sortBy === 'date') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      return 0; // Relevance sorting would require scoring
    });
  }, [documents, query, sortBy]);

  const highlightText = (text: string, highlight: string) => {
    if (!highlight.trim()) return text;
    const parts = text.split(new RegExp(`(${highlight})`, 'gi'));
    return (
      <span>
        {parts.map((part, i) =>
          part.toLowerCase() === highlight.toLowerCase() ?
            <span key={i} className="bg-yellow-200 text-slate-900 rounded-sm px-0.5">{part}</span> : part
        )}
      </span>
    );
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header & Search Input */}
      <div className="bg-white rounded-2xl shadow-sm border border-warm-200 p-8">
        <h2 className="text-2xl font-bold text-slate-800 mb-6">통합 지식 검색</h2>

        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-11 pr-4 py-4 bg-warm-50 border border-warm-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all shadow-inner text-lg"
            placeholder="키워드, 문서 제목, 또는 내용을 검색해보세요..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row justify-between items-center mt-6 gap-4">
          <div className="flex space-x-2 bg-warm-100 p-1 rounded-lg w-full sm:w-auto">
            {['all', 'keyword', 'semantic'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all flex-1 sm:flex-none ${activeTab === tab
                  ? 'bg-white text-brand-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-warm-200'
                  }`}
              >
                {tab === 'all' ? '전체' : tab === 'keyword' ? '키워드 매칭' : '의미 기반(AI)'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Filter size={14} />
            <span>정렬:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent font-medium text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value="date">최신순</option>
              <option value="relevance">정확도순</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results List */}
      <div className="space-y-4">
        <div className="flex justify-between items-end px-2">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wide">
            검색 결과 ({results.length})
          </h3>
        </div>

        {results.length > 0 ? (
          <div className="grid gap-4">
            {results.map((doc) => (
              <Link key={doc.id} to={`/doc/${doc.id}`} className="block group">
                <div className="bg-white rounded-xl border border-warm-200 p-5 hover:border-brand-400 hover:shadow-md transition-all">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 rounded-lg bg-brand-50 text-brand-600 group-hover:bg-brand-500 group-hover:text-white transition-colors">
                        <FileText size={18} />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800 text-lg group-hover:text-brand-600 transition-colors">
                          {highlightText(doc.title || "제목 없음", query)}
                        </h4>
                        <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                          <span className="flex items-center gap-1"><Calendar size={10} /> {new Date(doc.createdAt).toLocaleDateString()}</span>
                          <span className="bg-warm-100 text-slate-500 px-1.5 py-0.5 rounded uppercase font-bold text-[10px]">{doc.sourceType}</span>
                        </div>
                      </div>
                    </div>
                    <ArrowRight size={18} className="text-slate-300 group-hover:text-brand-500 group-hover:translate-x-1 transition-all" />
                  </div>

                  <div className="mt-3 pl-[52px]">
                    <p className="text-slate-600 text-sm leading-relaxed line-clamp-2">
                      {highlightText(doc.summaryText || doc.rawText, query)}
                    </p>

                    {/* Tags / Bullets snippet */}
                    {doc.summaryBullets && doc.summaryBullets.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {doc.summaryBullets.slice(0, 3).map((bullet, i) => (
                          <span key={i} className="inline-flex items-center gap-1 text-xs bg-brand-50 text-brand-700 px-2 py-1 rounded-full border border-brand-100">
                            <Tag size={10} /> {bullet.substring(0, 20)}{bullet.length > 20 ? '...' : ''}
                          </span>
                        ))}
                      </div>
                    )}

                    {candidates.filter(c => c.fromId === doc.id || c.toId === doc.id).length > 0 && (
                      <div className="mt-3 p-3 rounded-lg border border-amber-200 bg-amber-50/50">
                        <div className="text-xs font-bold text-amber-800 mb-2 inline-flex items-center gap-1">
                          <Link2 size={12} /> 자동 연결 제안 (Beta)
                        </div>
                        <div className="space-y-2">
                          {candidates.filter(c => c.fromId === doc.id || c.toId === doc.id).slice(0, 2).map(candidate => (
                            <div key={candidate.id} className="bg-white border border-amber-100 rounded-md p-2">
                              <div className="text-[11px] text-slate-700 mb-1">{candidate.toTitle} · {Math.round(candidate.confidence * 100)}%</div>
                              <div className="flex gap-1">
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    acceptCandidate(candidate.id);
                                  }}
                                  className="text-[11px] bg-brand-600 hover:bg-brand-700 text-white px-2 py-1 rounded inline-flex items-center gap-1"
                                >
                                  <Check size={10} /> 승인
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    rejectCandidate(candidate.id);
                                  }}
                                  className="text-[11px] bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-2 py-1 rounded inline-flex items-center gap-1"
                                >
                                  <X size={10} /> 거절
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-white rounded-xl border border-dashed border-warm-300">
            <div className="bg-warm-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="text-slate-400" size={32} />
            </div>
            <h3 className="text-slate-800 font-bold text-lg mb-1">검색 결과가 없습니다</h3>
            <p className="text-slate-500">다른 키워드로 검색하거나 새로운 문서를 추가해보세요.</p>
          </div>
        )}
      </div>
    </div>
  );
};
