import React, { useEffect, useRef } from 'react';
import { Node } from '../types';
import * as d3 from 'd3';

interface TopicMapProps {
  nodes: Node[];
  onNodeClick?: (nodeId: string) => void;
}

export const TopicMap: React.FC<TopicMapProps> = ({ nodes, onNodeClick }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!nodes.length || !svgRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // 1. Data Prep
    const grouped = new Map<string, any[]>();
    nodes.forEach(node => {
      const topic = node.tags && node.tags.length > 0 ? node.tags[0] : "미분류"; 
      if (!grouped.has(topic)) grouped.set(topic, []);
      grouped.get(topic)?.push(node);
    });

    const rootData = {
      name: "Knowledge Base",
      children: Array.from(grouped.entries()).map(([topic, children]) => ({
        name: topic,
        children: children.map(c => ({ ...c, value: c.val || 50 }))
      }))
    };

    const root = d3.hierarchy(rootData)
      .sum((d: any) => d.value)
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    const pack = d3.pack()
      .size([width, height])
      .padding(20); // More padding between circles

    const rootNode = pack(root as any);
    const color = d3.scaleOrdinal(d3.schemeTableau10);

    // 2. SVG Setup with Zoom
    const g = svg.append("g");

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 8])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoom)
       .call(zoom.transform, d3.zoomIdentity); // Reset zoom on re-render

    // 3. Render Groups (Topics)
    const groups = g.selectAll("g")
      .data(rootNode.descendants().slice(1))
      .join("g")
      .attr("transform", d => `translate(${d.x},${d.y})`);

    // Outer Circles (Topics & Nodes)
    groups.append("circle")
      .attr("r", d => d.r)
      .attr("fill", d => d.children ? color((d.data as any).name) : "white")
      .attr("fill-opacity", d => d.children ? 0.1 : 1)
      .attr("stroke", d => d.children ? color((d.data as any).name) : "#cbd5e1")
      .attr("stroke-width", d => d.children ? 1.5 : 2)
      .attr("cursor", d => !d.children ? "pointer" : "default")
      .on("click", (e, d) => {
        if (!d.children && onNodeClick) {
            e.stopPropagation(); 
            onNodeClick((d.data as any).id);
        }
      })
      .on("mouseover", function() { d3.select(this).attr("stroke", "#000"); })
      .on("mouseout", function(e, d) { 
          d3.select(this).attr("stroke", d.children ? color((d.data as any).name) : "#cbd5e1"); 
      });

    // Topic Labels (Only for parents)
    groups.filter(d => !!d.children)
      .append("text")
      .attr("y", d => -d.r + 15)
      .text(d => (d.data as any).name)
      .attr("text-anchor", "middle")
      .style("font-weight", "bold")
      .style("font-size", "14px")
      .style("fill", d => d3.color(color((d.data as any).name))?.darker(2)?.toString() || "#000")
      .style("text-transform", "uppercase")
      .style("pointer-events", "none")
      .style("text-shadow", "0 1px 4px rgba(255,255,255,0.8)");

    // Leaf Labels (Document Titles)
    const leaves = groups.filter(d => !d.children && d.r > 15);
    
    leaves.append("text")
      .attr("dy", "-0.2em")
      .text(d => {
          const title = (d.data as any).title;
          return title.length > 8 ? title.substring(0, 8) + ".." : title;
      })
      .attr("text-anchor", "middle")
      .style("font-size", "10px")
      .style("font-weight", "600")
      .style("fill", "#1e293b")
      .style("pointer-events", "none");

    // Leaf Score
    leaves.append("text")
      .attr("dy", "1em")
      .text(d => `Sc: ${(d.data as any).val || 0}`)
      .attr("text-anchor", "middle")
      .style("font-size", "9px")
      .style("fill", "#64748b")
      .style("pointer-events", "none");

  }, [nodes, onNodeClick]);

  return (
    <div ref={containerRef} className="w-full h-full relative bg-slate-50 rounded-xl overflow-hidden cursor-move">
       <div className="absolute top-4 left-4 z-10 bg-white/90 p-3 rounded-xl border border-slate-200 shadow-sm text-xs pointer-events-none">
        <h4 className="font-bold text-slate-700 mb-1">토픽 맵 (Topic Map)</h4>
        <p className="text-slate-500">주제별 군집을 탐색하세요. (Drag & Zoom 가능)</p>
      </div>
      <svg ref={svgRef} className="w-full h-full"></svg>
    </div>
  );
};