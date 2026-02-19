import React, { useEffect, useRef } from 'react';
import { Node } from '../types';
import * as d3 from 'd3';

interface TagCloudProps {
  nodes: Node[];
}

export const TagCloud: React.FC<TagCloudProps> = ({ nodes }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!nodes.length || !svgRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    // Calculate Tag Frequencies
    const tagCounts = new Map<string, number>();
    nodes.forEach(node => {
      node.tags?.forEach(tag => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      });
    });

    const tags = Array.from(tagCounts.entries()).map(([text, count]) => ({
      text,
      count,
      r: 10 + count * 5 // Radius based on frequency
    }));

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // Color scale
    const color = d3.scaleOrdinal(d3.schemeCategory10);

    // Force Simulation
    const simulation = d3.forceSimulation(tags as any)
      .force("charge", d3.forceManyBody().strength(5))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide().radius((d: any) => d.r + 2).strength(0.7));

    const g = svg.append("g");

    const node = g.selectAll("g")
      .data(tags)
      .join("g");

    node.append("circle")
      .attr("r", (d: any) => d.r)
      .attr("fill", (d: any) => color(d.text))
      .attr("opacity", 0.7);

    node.append("text")
      .text((d: any) => d.text)
      .attr("text-anchor", "middle")
      .attr("dy", ".35em")
      .attr("fill", "#fff")
      .style("font-size", (d: any) => Math.min(2 * d.r, (2 * d.r - 8) / Math.max(1, d.text.length / 2)) + "px") // simple dynamic font size
      .style("font-weight", "bold")
      .style("pointer-events", "none");
    
    node.append("title")
      .text((d: any) => `${d.text}: ${d.count} documents`);

    simulation.on("tick", () => {
      node.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });
    
    // Zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 4])
      .on("zoom", (event) => g.attr("transform", event.transform));
      
    svg.call(zoom);

    return () => {
        simulation.stop();
    }
  }, [nodes]);

  return (
    <div ref={containerRef} className="w-full h-full bg-slate-900 relative rounded-xl overflow-hidden">
        <div className="absolute top-4 left-4 z-10 bg-slate-800/90 p-3 rounded-xl border border-slate-700 shadow-sm text-xs pointer-events-none">
        <h4 className="font-bold text-slate-200 mb-1">태그 클라우드 (Tag Cloud)</h4>
        <p className="text-slate-400">문서 내 핵심 키워드의 빈도를 시각화합니다.</p>
      </div>
      <svg ref={svgRef} className="w-full h-full"></svg>
    </div>
  );
};