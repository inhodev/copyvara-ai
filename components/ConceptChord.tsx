import React, { useEffect, useRef, useState } from 'react';
import { Node, Edge } from '../types';
import * as d3 from 'd3';

interface ConceptChordProps {
  nodes: Node[];
  edges: Edge[];
}

export const ConceptChord: React.FC<ConceptChordProps> = ({ nodes, edges }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverInfo, setHoverInfo] = useState<{source: string, target: string, value: number} | null>(null);

  useEffect(() => {
    if (!nodes.length || !svgRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    // Adjust radius to fit labels
    const outerRadius = Math.min(width, height) * 0.5 - 120; // More space for labels
    const innerRadius = outerRadius - 20;

    // 1. Data Prep
    const topics = Array.from(new Set(nodes.map(n => n.tags?.[0] || "기타"))).sort();
    
    // Ensure we have at least 1 topic to render something
    if (topics.length === 0) return;

    const index = new Map(topics.map((name, i) => [name, i]));
    const matrix = Array.from({ length: topics.length }, () => new Array(topics.length).fill(0));

    // Fill matrix
    let totalLinks = 0;
    edges.forEach(e => {
        // Count BOTH confirmed and candidate for richer visualization
        if(e.status === 'confirmed' || e.status === 'candidate') {
            const source = nodes.find(n => n.id === e.source);
            const target = nodes.find(n => n.id === e.target);
            if(source && target) {
                const sTopic = source.tags?.[0] || "기타";
                const tTopic = target.tags?.[0] || "기타";
                const sIndex = index.get(sTopic)!;
                const tIndex = index.get(tTopic)!;
                
                // Allow self-loops (internal connections)
                // Weight: Confirmed = 1, Candidate = 0.5
                const weight = e.status === 'confirmed' ? 1 : 0.5;
                matrix[sIndex][tIndex] += weight;
                if (sIndex !== tIndex) {
                    matrix[tIndex][sIndex] += weight; // Undirected graph nature
                }
                totalLinks++;
            }
        }
    });

    // Fallback if no links at all: Add dummy self-links to at least show the arcs
    if (totalLinks === 0) {
        topics.forEach((_, i) => matrix[i][i] = 1);
    }

    const chord = d3.chord()
        .padAngle(0.05)
        .sortSubgroups(d3.descending);

    const chords = chord(matrix);
    const color = d3.scaleOrdinal(d3.schemeTableau10).domain(topics);

    const arc = d3.arc()
        .innerRadius(innerRadius)
        .outerRadius(outerRadius);

    const ribbon = d3.ribbon()
        .radius(innerRadius);

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const g = svg.append("g")
        .attr("transform", `translate(${width / 2},${height / 2})`);

    // 2. Draw Groups (Arcs)
    const group = g.append("g")
        .selectAll("g")
        .data(chords.groups)
        .join("g");

    // Arc Path
    group.append("path")
        .attr("fill", d => color(topics[d.index]))
        .attr("stroke", d => d3.rgb(color(topics[d.index])).darker() as any)
        .attr("d", arc as any)
        .style("cursor", "pointer")
        .on("mouseover", fade(0.1))
        .on("mouseout", fade(0.7));

    // Labels
    group.append("text")
        .each(function(d: any) { (d as any).angle = (d.startAngle + d.endAngle) / 2; })
        .attr("dy", ".35em")
        .attr("transform", (d: any) => `
            rotate(${d.angle * 180 / Math.PI - 90})
            translate(${outerRadius + 10})
            ${d.angle > Math.PI ? "rotate(180)" : ""}
        `)
        .attr("text-anchor", (d: any) => d.angle > Math.PI ? "end" : "start")
        .text(d => topics[d.index])
        .style("font-size", "16px") // Increased from 11px
        .style("font-weight", "bold")
        .style("fill", "#334155");

    // 3. Draw Ribbons
    const ribbons = g.append("g")
        .attr("fill-opacity", 0.7)
        .selectAll("path")
        .data(chords)
        .join("path")
        .attr("d", ribbon as any)
        .attr("fill", d => color(topics[d.target.index]))
        .attr("stroke", d => d3.rgb(color(topics[d.target.index])).darker() as any)
        .attr("stroke-opacity", 0.2)
        .style("mix-blend-mode", "multiply")
        .on("mouseover", function(event, d) {
            d3.select(this).attr("fill-opacity", 1).style("stroke-opacity", 1);
            setHoverInfo({
                source: topics[d.source.index],
                target: topics[d.target.index],
                value: d.source.value
            });
        })
        .on("mouseout", function() {
            d3.select(this).attr("fill-opacity", 0.7).style("stroke-opacity", 0.2);
            setHoverInfo(null);
        });

    function fade(opacity: number) {
        return function(event: any, d: any) {
            ribbons
                .filter((r: any) => r.source.index !== d.index && r.target.index !== d.index)
                .transition()
                .style("opacity", opacity);
        };
    }

  }, [nodes, edges]);

  return (
    <div ref={containerRef} className="w-full h-full bg-white relative rounded-xl overflow-hidden flex flex-col">
       <div className="absolute top-4 left-4 z-10 bg-white/90 p-3 rounded-xl border border-slate-200 shadow-sm text-xs pointer-events-none max-w-xs">
        <h4 className="font-bold text-slate-700 mb-1">개념 융합 (Concept Chord)</h4>
        <p className="text-slate-500">
            주제 간의 연결 강도를 보여줍니다. 
            <br/><span className="text-[10px] text-slate-400">굵은 선 = 강한 연결 / 아치형 = 내부 연결</span>
        </p>
      </div>
      
      <div className="flex-1 relative">
         <svg ref={svgRef} className="w-full h-full"></svg>
         
         {/* Center Info Overlay */}
         {hoverInfo && (
             <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none text-center bg-white/80 p-4 rounded-xl backdrop-blur-sm shadow-md border border-slate-100 min-w-[200px]">
                 <div className="text-sm font-bold text-slate-400 uppercase tracking-wide mb-1">Connection</div>
                 <div className="text-xl font-bold text-slate-800 whitespace-nowrap">
                     {hoverInfo.source} 
                     <span className="text-slate-400 mx-2">↔</span> 
                     {hoverInfo.target}
                 </div>
                 <div className="text-base text-brand-600 font-bold mt-2">Weight: {hoverInfo.value}</div>
             </div>
         )}
      </div>
    </div>
  );
};