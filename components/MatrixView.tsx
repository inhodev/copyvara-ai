import React, { useState } from 'react';
import { Edge, Node } from '../types';

interface MatrixViewProps {
  nodes: Node[];
  edges: Edge[];
  onNodeClick?: (nodeId: string) => void;
}

export const MatrixView: React.FC<MatrixViewProps> = ({ nodes, edges, onNodeClick }) => {
  const [hoveredCell, setHoveredCell] = useState<{row: string, col: string} | null>(null);

  // Sort nodes by title or cluster for better matrix visualization
  const sortedNodes = [...nodes].sort((a, b) => a.title.localeCompare(b.title));
  
  // Create adjacency map
  const matrix = new Map<string, string>();
  edges.forEach(edge => {
    matrix.set(`${edge.source}-${edge.target}`, edge.status);
    matrix.set(`${edge.target}-${edge.source}`, edge.status); 
  });

  return (
    <div className="w-full h-full overflow-hidden bg-white relative flex flex-col">
       <div className="absolute top-4 left-4 z-10 bg-white/90 p-3 rounded-xl border border-slate-200 shadow-sm text-xs max-w-xs pointer-events-none">
        <h4 className="font-bold text-slate-700 mb-1">매트릭스 (Connectivity)</h4>
        <p className="text-slate-500 mb-2">지식 간의 연결 밀도를 보여줍니다.</p>
        <div className="bg-slate-50 p-2 rounded text-slate-600 space-y-1">
          <p>• <span className="font-bold">목적:</span> 특정 문서가 얼마나 많은 다른 지식과 연결되어 있는지(Hub), 혹은 고립되어 있는지(Isolate) 한눈에 파악합니다.</p>
          <p>• <span className="font-bold">활용:</span> 연결이 없는 흰색 줄을 찾아 지식을 연결해보세요.</p>
        </div>
      </div>

      <div className="overflow-auto custom-scrollbar flex-1 p-12">
        <div className="inline-block relative">
          
          {/* Top Header (Col Labels) */}
          <div className="flex ml-32">
            {sortedNodes.map(node => {
              const isHovered = hoveredCell?.col === node.id;
              return (
                <div key={node.id} className="w-8 -rotate-45 origin-bottom-left translate-x-5 mb-2 relative">
                   <span 
                    className={`text-[9px] block truncate w-24 whitespace-nowrap transition-colors cursor-pointer ${isHovered ? 'text-brand-600 font-bold z-20' : 'text-slate-400 hover:text-brand-600'}`} 
                    title={node.title}
                    onClick={() => onNodeClick && onNodeClick(node.id)}
                   >
                    {node.title}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Rows */}
          {sortedNodes.map(rowNode => {
             const isRowHovered = hoveredCell?.row === rowNode.id;
             return (
              <div key={rowNode.id} className="flex items-center h-8">
                {/* Row Label */}
                <div 
                  className={`w-32 shrink-0 text-[10px] text-right pr-4 truncate font-medium transition-colors cursor-pointer ${isRowHovered ? 'text-brand-600 font-bold' : 'text-slate-500 hover:text-slate-700'}`}
                  title={rowNode.title}
                  onMouseEnter={() => setHoveredCell(prev => ({ row: rowNode.id, col: prev?.col || '' }))}
                  onClick={() => onNodeClick && onNodeClick(rowNode.id)}
                >
                  {rowNode.title}
                </div>

                {/* Cells */}
                <div className="flex border-l border-t border-slate-100">
                  {sortedNodes.map(colNode => {
                    const isSelf = rowNode.id === colNode.id;
                    const status = matrix.get(`${rowNode.id}-${colNode.id}`);
                    const isHovering = hoveredCell?.row === rowNode.id && hoveredCell?.col === colNode.id;
                    const isCrosshair = hoveredCell?.row === rowNode.id || hoveredCell?.col === colNode.id;
                    
                    let cellClass = "bg-transparent";
                    if (isSelf) cellClass = "bg-slate-50";
                    else if (status === 'confirmed') cellClass = "bg-brand-600";
                    else if (status === 'candidate') cellClass = "bg-red-200";

                    return (
                      <div 
                        key={colNode.id} 
                        className={`w-8 h-8 border-r border-b border-slate-100 flex items-center justify-center transition-all cursor-pointer relative
                          ${isCrosshair ? 'bg-slate-50' : ''}
                        `}
                        onMouseEnter={() => setHoveredCell({ row: rowNode.id, col: colNode.id })}
                        onMouseLeave={() => setHoveredCell(null)}
                      >
                        <div className={`w-full h-full ${cellClass} ${status === 'confirmed' ? 'opacity-90' : 'opacity-60'} ${isHovering ? 'ring-2 ring-brand-400 z-10' : ''}`}></div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Legend */}
      <div className="fixed bottom-8 right-8 bg-white p-4 rounded-xl shadow-lg border border-slate-200 text-xs space-y-2 z-20 pointer-events-none">
          <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-brand-600 opacity-90 rounded-sm"></div>
              <span>확정된 연결</span>
          </div>
           <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-200 opacity-60 rounded-sm"></div>
              <span>추천 (후보)</span>
          </div>
           <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-slate-50 rounded-sm"></div>
              <span>자기 자신 / 교차선</span>
          </div>
      </div>
    </div>
  );
};