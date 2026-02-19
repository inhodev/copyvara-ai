import React, { useMemo } from 'react';
import { Edge, Node } from '../types';
import * as d3 from 'd3';

interface TimelineViewProps {
  nodes: Node[];
  edges: Edge[];
  onNodeClick?: (nodeId: string) => void;
}

interface TimelineNode extends Node {
  date: Date;
  x: number;
  y: number;
}

export const TimelineView: React.FC<TimelineViewProps> = ({ nodes, edges, onNodeClick }) => {
  // Process data for timeline
  const processedData = useMemo(() => {
    // 1. Sort by date (simulated by ID or creating fake dates if not present in Node, 
    //    but assuming we link back to Document createdAt in a real app. 
    //    For MVP, we simulate date distribution based on ID/index or assume nodes have date props passed in)
    
    // Create a time scale
    const sortedNodes = [...nodes].map((node, i) => ({
      ...node,
      // Mock date: Spread over last 30 days based on index if no date
      date: new Date(Date.now() - (nodes.length - i) * 86400000 * 0.5) 
    }));

    const minDate = sortedNodes[0]?.date || new Date();
    const maxDate = sortedNodes[sortedNodes.length - 1]?.date || new Date();
    
    // Layout constants
    const width = Math.max(1000, nodes.length * 120);
    const height = 600;
    const padding = 60;
    const timeY = height / 2;

    const timeScale = d3.scaleTime()
      .domain([minDate, maxDate])
      .range([padding, width - padding]);

    // Calculate Node Positions
    const nodePositions = new Map<string, TimelineNode>();
    sortedNodes.forEach((node, i) => {
        // Stagger Y to avoid overlapping labels
        const stagger = (i % 2 === 0 ? -1 : 1) * (i % 4 + 1) * 40;
        nodePositions.set(node.id, {
            x: timeScale(node.date),
            y: timeY + stagger,
            ...node
        });
    });

    return { nodePositions, width, height, timeY, minDate, maxDate };
  }, [nodes]);

  const { nodePositions, width, height, timeY } = processedData;

  return (
    <div className="w-full h-full overflow-x-auto overflow-y-hidden bg-slate-50 relative custom-scrollbar">
      <div className="absolute top-4 left-4 z-10 bg-white/90 p-3 rounded-xl border border-slate-200 shadow-sm text-xs pointer-events-none">
        <h4 className="font-bold text-slate-700 mb-1">타임라인 (Chronology)</h4>
        <p className="text-slate-500">지식의 습득 순서와 인과 흐름을 보여줍니다.</p>
      </div>

      <svg width={width} height={height} className="min-w-full">
        {/* Central Time Axis */}
        <line 
            x1={0} y1={timeY} 
            x2={width} y2={timeY} 
            stroke="#CBD5E1" 
            strokeWidth={2} 
            strokeDasharray="4 4"
        />
        
        {/* Edges (Curved) */}
        {edges.map((edge) => {
            const source = nodePositions.get(edge.source);
            const target = nodePositions.get(edge.target);
            if (!source || !target) return null;

            const isConfirmed = edge.status === 'confirmed';
            
            // Bezier curve
            const path = `M ${source.x} ${source.y} C ${(source.x + target.x)/2} ${source.y}, ${(source.x + target.x)/2} ${target.y}, ${target.x} ${target.y}`;

            return (
                <g key={edge.id}>
                    <path 
                        d={path} 
                        fill="none" 
                        stroke={isConfirmed ? "#669BBC" : "#FDA4AF"} 
                        strokeWidth={isConfirmed ? 1.5 : 1}
                        strokeOpacity={0.4}
                        strokeDasharray={isConfirmed ? "" : "4 2"}
                    />
                </g>
            );
        })}

        {/* Nodes */}
        {Array.from(nodePositions.values()).map((node: TimelineNode) => (
            <g 
                key={node.id} 
                transform={`translate(${node.x}, ${node.y})`}
                onClick={() => onNodeClick && onNodeClick(node.id)}
                className="cursor-pointer hover:opacity-80 transition-opacity"
            >
                {/* Connection Line to Axis */}
                <line 
                    x1={0} y1={0} 
                    x2={0} y2={timeY - node.y} 
                    stroke="#E2E8F0" 
                    strokeWidth={1} 
                />
                
                {/* Node Circle */}
                <circle 
                    r={node.status === 'done' ? 14 : 10} 
                    fill="white" 
                    stroke={node.status === 'done' ? "#003049" : "#F59E0B"} 
                    strokeWidth={3} 
                />
                
                {/* Date Label on Axis */}
                <text 
                    x={0} 
                    y={timeY - node.y + (node.y > timeY ? -10 : 20)} 
                    textAnchor="middle" 
                    className="text-[10px] fill-slate-400 font-mono"
                >
                    {node.date.toLocaleDateString(undefined, {month:'short', day:'numeric'})}
                </text>

                {/* Title Box */}
                <foreignObject x={-60} y={node.y > timeY ? 20 : -50} width={120} height={40}>
                    <div className={`text-[10px] text-center font-bold leading-tight line-clamp-2 px-2 py-1 rounded border shadow-sm ${
                        node.status === 'done' 
                        ? 'bg-white text-slate-800 border-slate-200' 
                        : 'bg-amber-50 text-amber-800 border-amber-200'
                    }`}>
                        {node.title}
                    </div>
                </foreignObject>
            </g>
        ))}
      </svg>
    </div>
  );
};