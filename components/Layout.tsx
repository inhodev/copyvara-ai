import React, { useEffect, useMemo, useState } from 'react';
import { Clipboard, Network, Search, Settings, ChevronDown, X, FileText } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store';

const formatDate = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
};

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;
  const { documents, edges } = useAppStore();

  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewClosing, setPreviewClosing] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const recentDocs = useMemo(() => documents.slice(0, 30), [documents]);

  const selectedDoc = useMemo(
    () => documents.find((doc) => doc.id === selectedDocId) || null,
    [documents, selectedDocId]
  );

  const docsLimit = 100;
  const docsProgress = Math.min((documents.length / docsLimit) * 100, 100);
  const connections = edges.filter((edge) => edge.status === 'confirmed').length;

  const closePreview = () => {
    if (!previewOpen && !previewClosing) return;
    setPreviewOpen(false);
    setPreviewClosing(true);
  };

  useEffect(() => {
    if (!previewClosing) return;
    const timer = window.setTimeout(() => {
      setPreviewClosing(false);
      setSelectedDocId(null);
    }, 260);

    return () => window.clearTimeout(timer);
  }, [previewClosing]);

  return (
    <div className="flex h-screen bg-white overflow-hidden">
      <aside className="w-[320px] bg-slate-50 border-r border-slate-200 flex flex-col flex-shrink-0 z-20">
        <div className="p-5 bg-white">
          <Link to="/" className="flex items-center gap-2 text-slate-900 hover:opacity-90 transition-opacity cursor-pointer">
            <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-800 font-bold text-xl shadow-sm">C</div>
            <span className="font-bold text-xl tracking-tight">CopyVara</span>
          </Link>
        </div>

        <div className="p-4 bg-white">
          <h3 className="text-sm font-bold text-slate-700">최근 저장된 지식</h3>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {recentDocs.map((doc) => (
            <button
              key={doc.id}
              type="button"
              onClick={() => {
                setSelectedDocId(doc.id);
                setPreviewClosing(false);
                setPreviewOpen(true);
              }}
              className={`w-full text-left rounded-xl border p-3 transition-all ${selectedDocId === doc.id
                ? 'bg-brand-50 border-brand-200 shadow-sm'
                : 'bg-white border-slate-200 hover:border-brand-100 hover:bg-slate-50'
                }`}
            >
              <h4 className="text-sm font-semibold text-slate-800 line-clamp-1">{doc.title || '제목 없는 문서'}</h4>
              <p className="mt-1 text-xs text-slate-500 line-clamp-2">{doc.summaryText || doc.rawText}</p>
              <p className="mt-2 text-[11px] text-slate-400">{formatDate(doc.createdAt)}</p>
            </button>
          ))}

          {recentDocs.length === 0 && <div className="rounded-xl border border-dashed border-slate-300 p-4 text-xs text-slate-500 bg-white">저장된 문서가 없습니다.</div>}
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden relative bg-white">
        <header className="h-16 bg-white/90 backdrop-blur-sm border-b border-warm-200 grid grid-cols-3 items-center px-6 flex-shrink-0 sticky top-0 z-20">
          <div />
          <div className="flex items-center justify-center">
            <div className="inline-flex rounded-lg border border-warm-200 overflow-hidden bg-warm-50">
              <button
                type="button"
                onClick={() => navigate('/')}
                className={`px-3 py-1.5 text-sm font-semibold transition-colors ${path === '/' ? 'bg-brand-500 text-white' : 'text-slate-600 hover:bg-white'}`}
              >
                붙여넣기
              </button>
              <button
                type="button"
                onClick={() => navigate('/ask')}
                className={`px-3 py-1.5 text-sm font-semibold transition-colors ${path === '/ask' ? 'bg-brand-500 text-white' : 'text-slate-600 hover:bg-white'}`}
              >
                질문하기
              </button>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate('/graph')}
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${path === '/graph' ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-warm-200 text-slate-600 hover:bg-warm-50'}`}
            >
              <Network size={15} /> 지식 그래프
            </button>

            <button
              type="button"
              onClick={() => navigate('/search')}
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${path === '/search' ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-warm-200 text-slate-600 hover:bg-warm-50'}`}
            >
              <Search size={15} /> 상세검색
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setProfileOpen((v) => !v)}
                className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-full hover:bg-slate-100 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-warm-200 border border-warm-300 flex items-center justify-center text-brand-600 font-bold">U</div>
                <ChevronDown size={14} className="text-slate-500" />
              </button>

              {profileOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-slate-200 bg-white shadow-lg p-3 z-30">
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-semibold text-slate-600">저장된 문서</span>
                      <span className="text-slate-500">{documents.length} / {docsLimit}</span>
                    </div>
                    <div className="w-full bg-warm-100 rounded-full h-2 overflow-hidden">
                      <div className="bg-brand-500 h-2 rounded-full transition-all duration-500" style={{ width: `${docsProgress}%` }}></div>
                    </div>
                  </div>

                  <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 flex items-center justify-between">
                    <span className="font-semibold">총 지식 연결</span>
                    <span className="font-bold text-brand-700">{connections}개</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setProfileOpen(false);
                      navigate('/settings');
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-50 inline-flex items-center gap-2 border border-slate-200"
                  >
                    <Settings size={15} /> 설정 페이지로 이동
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-hidden flex relative">
          <div className="flex-1 overflow-y-auto p-8 relative">
            {children}

            {!previewOpen && selectedDocId && (
              <button
                type="button"
                onClick={() => setPreviewOpen(true)}
                className="absolute left-2 top-4 z-10 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                <FileText size={14} /> 미리보기 열기
              </button>
            )}
          </div>
        </div>

        {(previewOpen || previewClosing) && selectedDoc && (
          <aside className={`absolute left-0 top-0 bottom-0 w-[380px] border border-slate-200 bg-white flex flex-col shadow-xl z-40 transition-transform duration-300 ease-in-out ${previewClosing ? '-translate-x-full' : 'translate-x-0'}`}>
            <div className="p-4 border-b border-slate-200 bg-white">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-[32px] font-bold leading-[1.25] text-slate-900">{selectedDoc.title || '제목 없는 문서'}</h3>
                <button
                  type="button"
                  onClick={closePreview}
                  className="p-1 rounded hover:bg-slate-100 text-slate-500 mt-1"
                >
                  <X size={16} />
                </button>
              </div>
              <p className="mt-1 text-xs text-slate-400">{formatDate(selectedDoc.createdAt)}</p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {selectedDoc.topicTags?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {selectedDoc.topicTags.slice(0, 6).map((tag, idx) => (
                    <span key={`${tag}-${idx}`} className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              <div className="rounded-xl border border-warm-200 bg-warm-50/50 p-3">
                <p className="text-xs font-semibold text-slate-500 mb-1">요약</p>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{selectedDoc.summaryText || '요약이 아직 없습니다.'}</p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-xs font-semibold text-slate-500 mb-1">원문</p>
                <p className="text-sm text-slate-700 whitespace-pre-wrap line-clamp-[20]">{selectedDoc.rawText}</p>
              </div>

              <Link
                to={`/doc/${selectedDoc.id}`}
                onClick={closePreview}
                className="w-full inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-brand-500 text-white text-sm font-semibold hover:bg-brand-600 transition-colors"
              >
                <Clipboard size={15} /> 상세 열기
              </Link>
            </div>
          </aside>
        )}
      </main>
    </div>
  );
};
