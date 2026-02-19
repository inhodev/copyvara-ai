import React, { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../store';
import { Send, Bot, FileText, User, Clock, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Ask: React.FC = () => {
  const { askQuestion, qaSessions, lastError, documents } = useAppStore();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    await askQuestion(query);
    setLoading(false);
    setQuery('');
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [qaSessions, loading]);

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col max-w-4xl mx-auto bg-white rounded-xl shadow-sm border border-warm-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-warm-100 bg-warm-50 flex items-center justify-between">
        <div>
          <h2 className="font-bold text-slate-800">지식 베이스에 질문하기</h2>
          <p className="text-xs text-slate-500">저장된 문서의 맥락과 시간 순서를 고려하여 답변합니다.</p>
        </div>
        <div className="relative flex items-center gap-2">
          <button
            type="button"
            onClick={() => setHistoryOpen((v) => !v)}
            className="px-3 py-1 rounded-full text-xs font-semibold border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          >
            최근 질문 내역
          </button>
          <div className="bg-brand-100 text-brand-700 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
            <Clock size={12} /> ChatGPT 5
          </div>

          {historyOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-slate-200 bg-white shadow-lg p-2 z-20">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide px-2 py-1">최근 질문 세션</p>
              <div className="max-h-64 overflow-y-auto space-y-1">
                {qaSessions.length === 0 && (
                  <div className="px-2 py-2 text-xs text-slate-400">질문 내역이 없습니다.</div>
                )}
                {qaSessions.slice(0, 20).map((session) => (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => {
                      setQuery(session.question);
                      setHistoryOpen(false);
                    }}
                    className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-slate-50"
                    title={session.question}
                  >
                    <div className="text-xs font-semibold text-slate-700 truncate">{session.question}</div>
                    <div className="text-[11px] text-slate-500 truncate mt-0.5">{session.answer}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-warm-50/50" ref={scrollRef}>
        {documents.length === 0 && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg px-4 py-3">
            문서가 없습니다. 먼저 문서를 추가하세요.
          </div>
        )}
        {lastError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
            요청 처리 중 오류가 발생했습니다: {lastError}
          </div>
        )}
        {qaSessions.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4 opacity-60">
            <Bot size={48} />
            <p className="text-center">"최근에 추가한 마케팅 전략이 뭐야?"<br />"아키텍처 관련해서 어떤 대화를 나눴지?"<br />같은 질문을 해보세요.</p>
          </div>
        )}

        {qaSessions.slice().reverse().map(session => (
          <div key={session.id} className="space-y-6">
            {/* User Message */}
            <div className="flex justify-end">
              <div className="bg-brand-500 text-white px-5 py-3 rounded-2xl rounded-tr-none max-w-[80%] shadow-sm">
                <p className="text-sm">{session.question}</p>
              </div>
              <div className="ml-3 mt-1 w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 shadow-sm">
                <User size={16} />
              </div>
            </div>

            {/* Bot Response */}
            <div className="flex justify-start items-start">
              <div className="mr-3 mt-1 w-8 h-8 rounded-full bg-brand-700 flex items-center justify-center text-white shadow-sm border-2 border-brand-100">
                <Bot size={16} />
              </div>
              <div className="max-w-[85%] space-y-3">
                <div className="bg-white border border-warm-200 px-6 py-5 rounded-2xl rounded-tl-none shadow-sm text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">
                  {session.answer}
                </div>

                {/* Evidence */}
                {session.evidence.length > 0 && (
                  <div className="pl-1">
                    <div className="text-[11px] text-slate-500 inline-flex items-center gap-1.5 flex-wrap">
                      <FileText size={11} />
                      <span className="font-semibold">참조:</span>
                      {session.evidence.map((ev, i) => (
                        <Link
                          key={i}
                          to={`/doc/${ev.id}`}
                          state={{ from: '/ask' }}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 hover:bg-brand-100 text-slate-600 hover:text-brand-700"
                          title={ev.title}
                        >
                          @{ev.title}
                          <ExternalLink size={10} />
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start items-center gap-3 animate-pulse">
            <div className="w-8 h-8 rounded-full bg-brand-700 flex items-center justify-center text-white">
              <Bot size={16} />
            </div>
            <div className="flex flex-col gap-1">
              <div className="text-sm text-slate-600 font-medium">답변 생성 중...</div>
              <div className="text-xs text-slate-400">지식 그래프와 시간 순서를 분석하고 있습니다.</div>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <form onSubmit={handleAsk} className="p-4 bg-white border-t border-warm-200">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="지식 베이스에 대해 무엇이든 물어보세요..."
            className="w-full pl-5 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-full focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white transition-all shadow-inner text-slate-900 placeholder:text-slate-400"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={!query.trim() || loading}
            className="absolute right-2 top-2 p-1.5 bg-brand-600 text-white rounded-full hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={18} />
          </button>
        </div>
      </form>
    </div>
  );
};
