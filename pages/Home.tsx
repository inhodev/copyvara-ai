import React, { useState, useMemo } from 'react';
import { useAppStore } from '../store';
import { Clipboard, Loader2, AlertCircle, Sparkles, BrainCircuit, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Document } from '../types';

export const Home: React.FC = () => {
  const { addDocument, documents } = useAppStore();
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Memory Decay Logic for "Today's Review"
  const reviewItems = useMemo(() => {
    const now = new Date();
    return documents.map(doc => {
      // Robust date parsing
      let createdAt = new Date(doc.createdAt);
      if (isNaN(createdAt.getTime())) createdAt = new Date(Date.now() - Math.random() * 30 * 86400000);

      const daysPassed = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
      // Ebbinghaus Approximation: R = e^(-t/S)
      const strength = Math.max(5, ((doc.knowledgeScore || 50) / 5));
      const retention = Math.exp(-daysPassed / strength) * 100;

      return { ...doc, retention, daysPassed };
    })
      .filter(d => d.retention < 60) // Show items with < 60% retention
      .sort((a, b) => a.retention - b.retention) // Lowest retention first
      .slice(0, 3); // Take top 3
  }, [documents]);

  const handlePaste = async () => {
    if (!text.trim()) {
      setError('내용을 입력해주세요.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await addDocument(text);
      setText('');
    } catch (e) {
      setError('처리 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-10">
      {/* Hero / Paste Section */}
      <section className="bg-white rounded-2xl shadow-sm border border-warm-200 p-6 md:p-10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-50 rounded-full blur-3xl -mr-20 -mt-20 opacity-60 pointer-events-none"></div>

        <div className="mb-6 relative z-10">
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-3xl font-bold text-brand-700">지식 캡처 & 인사이트 분석</h2>
            <span className="bg-brand-100 text-brand-700 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
              <Sparkles size={12} /> AI Auto-Parsing
            </span>
          </div>
          <p className="text-slate-600 max-w-2xl">
            복잡한 글, 메모, 대화 로그를 그대로 붙여넣으세요.<br />
            CopyVara가 자동으로 구조화하고, 분류하고, 시각화합니다.
          </p>
        </div>

        <div className="relative z-10">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            placeholder="분석할 텍스트를 붙여넣어 주세요."
            className="w-full h-72 p-5 rounded-xl border border-warm-200 bg-warm-50/50 focus:bg-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-all resize-none font-mono text-sm text-slate-900 placeholder:text-slate-400 shadow-inner"
          />
          {error && (
            <div className="absolute bottom-4 left-4 text-point-500 text-sm flex items-center gap-1 font-medium bg-red-50 px-2 py-1 rounded">
              <AlertCircle size={14} /> {error}
            </div>
          )}
          <div className="absolute bottom-4 right-4 flex gap-3">
            <button
              onClick={() => setText(
                `RAG(검색 증강 생성) 기술에 대한 메모:
RAG는 LLM의 할루시네이션을 줄이는 핵심 기술이다. 
...
(중간에 다른 주제 섞임)
...
참, 다음주 마케팅 전략 회의 안건: 
1. SNS 광고 예산 증액
2. 인플루언서 협업`)}
              className="px-3 py-2 text-xs font-bold text-slate-600 hover:text-brand-600 bg-white border border-warm-200 hover:bg-warm-50 rounded-lg shadow-sm transition-colors"
            >
              텍스트 예시
            </button>
            <button
              onClick={handlePaste}
              disabled={loading || !text}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold text-white transition-all shadow-md ${loading || !text ? 'bg-slate-300 cursor-not-allowed' : 'bg-brand-500 hover:bg-brand-600 hover:shadow-lg hover:-translate-y-0.5'
                }`}
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : <Clipboard size={18} />}
              {loading ? '분석 및 구조화' : '지식 자산화'}
            </button>
          </div>
        </div>
      </section>

      {/* Review Recommendation Widget (Spaced Repetition) */}
      {reviewItems.length > 0 && (
        <section className="animate-fadeIn">
          <div className="flex items-center gap-2 mb-4 px-1">
            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <BrainCircuit className="text-brand-600" /> 오늘의 복습 추천
            </h3>
            <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              망각 곡선 기반 (Spaced Repetition)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {reviewItems.map((doc) => (
              <Link key={doc.id} to={`/doc/${doc.id}`} className="group block">
                <div className="bg-gradient-to-br from-red-50 to-white rounded-xl border border-red-100 p-5 hover:shadow-md hover:border-red-200 transition-all relative overflow-hidden">
                  <div className="absolute top-3 right-3">
                    <div className="w-10 h-10 rounded-full border-2 border-red-200 flex items-center justify-center bg-white shadow-sm group-hover:scale-110 transition-transform">
                      <span className="text-xs font-bold text-red-500">{Math.round(doc.retention)}%</span>
                    </div>
                  </div>

                  <div className="text-xs font-bold text-red-400 mb-1 flex items-center gap-1 uppercase tracking-wider">
                    <RefreshCw size={12} className="animate-spin-slow" /> Review Needed
                  </div>
                  <h4 className="font-bold text-slate-800 mb-2 pr-8 line-clamp-1 group-hover:text-red-600 transition-colors">{doc.title}</h4>
                  <p className="text-xs text-slate-500 mb-3">
                    마지막 학습: {Math.floor(doc.daysPassed)}일 전
                  </p>
                  <div className="w-full bg-red-100 rounded-full h-1.5">
                    <div className="bg-red-400 h-1.5 rounded-full" style={{ width: `${doc.retention}%` }}></div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

    </div>
  );
};
