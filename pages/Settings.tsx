import React, { useState } from 'react';
import { useAppStore } from '../store';
import { User, CreditCard, HardDrive, Shield, AlertTriangle, Trash2, Check, BarChart3, Database } from 'lucide-react';

export const Settings: React.FC = () => {
  const { documents, qaSessions, edges, resetWorkspace } = useAppStore();
  const [resetConfirm, setResetConfirm] = useState(false);

  // Stats Calculation
  const stats = {
    docsCount: documents.length,
    docsLimit: 50,
    qaCount: qaSessions.length,
    qaLimit: 100,
    storageUsed: '12.5 MB', // Mock
    storageLimit: '500 MB',
    connections: edges.filter(e => e.status === 'confirmed').length
  };

  const handleReset = () => {
    resetWorkspace();
    setResetConfirm(false);
    alert('모든 데이터가 초기화되었습니다.');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-10">
      <h2 className="text-2xl font-bold text-slate-800 px-1">설정 및 관리</h2>

      {/* Profile Section */}
      <section className="bg-white rounded-2xl shadow-sm border border-warm-200 overflow-hidden">
        <div className="p-6 border-b border-warm-100 bg-brand-50/50 flex items-center gap-4">
          <div className="w-16 h-16 bg-brand-200 rounded-full flex items-center justify-center text-brand-700 font-bold text-2xl border-4 border-white shadow-sm">
            U
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800">User Profile</h3>
            <p className="text-sm text-slate-500">user@example.com · Free Plan</p>
          </div>
          <button className="ml-auto px-4 py-2 bg-white border border-warm-200 rounded-lg text-sm font-medium text-slate-600 hover:text-brand-600 hover:border-brand-300 transition-colors">
            프로필 편집
          </button>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1">
             <label className="text-xs font-bold text-slate-400 uppercase">표시 이름</label>
             <div className="font-medium text-slate-800">CopyVara 사용자</div>
          </div>
          <div className="space-y-1">
             <label className="text-xs font-bold text-slate-400 uppercase">워크스페이스 ID</label>
             <div className="font-mono text-slate-600 bg-slate-100 px-2 py-1 rounded w-fit text-sm">ws-8291-alpha</div>
          </div>
        </div>
      </section>

      {/* Usage Stats */}
      <section className="bg-white rounded-2xl shadow-sm border border-warm-200 p-6">
        <div className="flex items-center gap-2 mb-6 text-slate-800 font-bold text-lg">
          <BarChart3 className="text-brand-500" /> 사용량 통계 (Free Plan)
        </div>
        
        <div className="space-y-6">
          {/* Document Usage */}
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="font-medium text-slate-700">저장된 문서</span>
              <span className="text-slate-500">{stats.docsCount} / {stats.docsLimit}</span>
            </div>
            <div className="w-full bg-warm-100 rounded-full h-2.5 overflow-hidden">
              <div 
                className="bg-brand-500 h-2.5 rounded-full transition-all duration-500" 
                style={{ width: `${Math.min((stats.docsCount / stats.docsLimit) * 100, 100)}%` }}
              ></div>
            </div>
          </div>

          {/* Q&A Usage */}
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="font-medium text-slate-700">AI 질문 (RAG)</span>
              <span className="text-slate-500">{stats.qaCount} / {stats.qaLimit}</span>
            </div>
            <div className="w-full bg-warm-100 rounded-full h-2.5 overflow-hidden">
              <div 
                className="bg-purple-500 h-2.5 rounded-full transition-all duration-500" 
                style={{ width: `${Math.min((stats.qaCount / stats.qaLimit) * 100, 100)}%` }}
              ></div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-4">
             <div className="bg-warm-50 p-4 rounded-xl border border-warm-100">
               <div className="text-xs text-slate-400 font-bold uppercase mb-1">총 지식 연결</div>
               <div className="text-2xl font-bold text-brand-600">{stats.connections} <span className="text-sm font-normal text-slate-400">개</span></div>
             </div>
             <div className="bg-warm-50 p-4 rounded-xl border border-warm-100">
               <div className="text-xs text-slate-400 font-bold uppercase mb-1">스토리지 사용량</div>
               <div className="text-2xl font-bold text-slate-700">{stats.storageUsed}</div>
             </div>
          </div>
        </div>
      </section>

      {/* Workspace Settings */}
      <section className="bg-white rounded-2xl shadow-sm border border-warm-200 p-6">
         <div className="flex items-center gap-2 mb-6 text-slate-800 font-bold text-lg">
          <Database className="text-slate-500" /> 데이터 관리
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 border border-warm-200 rounded-xl hover:border-brand-200 transition-colors">
            <div className="flex items-center gap-4">
               <div className="p-2 bg-brand-50 text-brand-600 rounded-lg"><HardDrive size={20}/></div>
               <div>
                 <h4 className="font-bold text-slate-800">데이터 내보내기</h4>
                 <p className="text-xs text-slate-500">워크스페이스의 모든 문서를 JSON 형식으로 다운로드합니다.</p>
               </div>
            </div>
            <button className="text-sm font-medium text-brand-600 hover:underline">내보내기</button>
          </div>
        </div>
      </section>

      {/* Danger Zone */}
      <section className="bg-red-50/50 rounded-2xl shadow-sm border border-red-100 p-6">
        <div className="flex items-center gap-2 mb-4 text-red-800 font-bold text-lg">
          <AlertTriangle className="text-red-500" /> Danger Zone
        </div>
        <p className="text-sm text-red-700/80 mb-6">
          워크스페이스를 삭제하면 저장된 모든 문서, 연결, 대화 내역이 영구적으로 삭제되며 복구할 수 없습니다.
        </p>

        {!resetConfirm ? (
          <button 
            onClick={() => setResetConfirm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50 font-medium transition-colors text-sm shadow-sm"
          >
            <Trash2 size={16} /> 워크스페이스 초기화
          </button>
        ) : (
          <div className="flex items-center gap-3 animate-fadeIn">
            <span className="text-sm font-bold text-red-700">정말 삭제하시겠습니까?</span>
            <button 
              onClick={handleReset}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-bold text-sm shadow-sm"
            >
              네, 모든 데이터 삭제
            </button>
            <button 
              onClick={() => setResetConfirm(false)}
              className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 text-sm"
            >
              취소
            </button>
          </div>
        )}
      </section>

      <div className="text-center text-xs text-slate-400 py-4">
        CopyVara MVP v0.3 · Build 2026.02.14 · Terms of Service · Privacy
      </div>
    </div>
  );
};