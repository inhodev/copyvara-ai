import React, { useEffect, useRef } from 'react';
import { Node } from '../types';
import * as d3 from 'd3';

interface TreeMapProps {
  nodes: Node[];
  onNodeClick?: (nodeId: string) => void;
}

export const TreeMap: React.FC<TreeMapProps> = ({ nodes, onNodeClick }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!nodes.length || !svgRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const grouped = new Map<string, any[]>();
    nodes.forEach(node => {
      const topic = node.tags && node.tags.length > 0 ? node.tags[0] : "미분류";
      if (!grouped.has(topic)) grouped.set(topic, []);
      grouped.get(topic)?.push(node);
    });

    const data = {
      name: "Knowledge Base",
      children: Array.from(grouped.entries()).map(([topic, children]) => ({
        name: topic,
        children: children.map(c => ({ name: c.title, value: c.val || 10, id: c.id }))
      }))
    };

    const hierarchy = d3.hierarchy(data)
      .sum(d => (d as any).value)
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    const root = d3.treemap()
      .size([width, height])
      .paddingTop(32) // Increased padding for bigger header
      .paddingRight(7)
      .paddingInner(3)
      (hierarchy);

    const color = d3.scaleOrdinal(d3.schemeTableau10);
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const g = svg.append("g");

    // Nodes
    const leaf = g.selectAll("g")
      .data(root.leaves())
      .join("g")
      .attr("transform", d => `translate(${d.x0},${d.y0})`)
      .style("cursor", "pointer")
      .on("click", (e, d) => {
          if (onNodeClick) onNodeClick((d.data as any).id);
      });

    leaf.append("title")
      .text(d => `${d.ancestors().reverse().map(d => (d.data as any).name).join("/")}\nScore: ${(d.data as any).value}`);

    leaf.append("rect")
      .attr("id", d => (d as any).leafUid = `leaf-${(d.data as any).id}`)
      .attr("fill", d => {
        while (d.depth > 1) d = d.parent!;
        return color((d.data as any).name);
      })
      .attr("fill-opacity", 0.6)
      .attr("width", d => d.x1 - d.x0)
      .attr("height", d => d.y1 - d.y0)
      .attr("rx", 4);

    // Clip paths for text
    leaf.append("clipPath")
      .attr("id", d => (d as any).clipUid = `clip-${(d.data as any).id}`)
      .append("use")
      .attr("xlink:href", d => `#${(d as any).leafUid}`);

    leaf.append("text")
      .attr("clip-path", d => `url(#${(d as any).clipUid})`)
      .selectAll("tspan")
      .data(d => (d.data as any).name.split(/(?=[A-Z][a-z])|\s+/g).concat((d.data as any).value))
      .join("tspan")
      .attr("x", 4)
      .attr("y", (d, i, nodes) => 16 + (i === nodes.length - 1 ? (i * 14 + 6) : (i * 14))) 
      .attr("fill-opacity", (d, i, nodes) => i === nodes.length - 1 ? 0.7 : 1)
      .style("font-size", (d, i, nodes) => i === nodes.length - 1 ? "12px" : "15px") // Increased: 15px text, 12px score
      .style("font-weight", (d, i, nodes) => i === nodes.length - 1 ? "normal" : "bold")
      .style("fill", "#1e293b")
      .text(d => d as string);

    // Categories Titles
    g.selectAll("titles")
      .data(root.descendants().filter(d => d.depth === 1))
      .enter()
      .append("text")
      .attr("x", d => d.x0 + 6)
      .attr("y", d => d.y0 + 20)
      .text(d => (d.data as any).name)
      .style("font-size", "18px") // Increased from 12px
      .style("font-weight", "bold")
      .style("fill", d => d3.color(color((d.data as any).name))?.darker(1)?.toString() || "#000");

  }, [nodes, onNodeClick]);

  return (
    <div ref={containerRef} className="w-full h-full bg-white relative rounded-xl overflow-hidden">
       <div className="absolute top-4 right-4 z-10 bg-white/90 p-3 rounded-xl border border-slate-200 shadow-sm text-xs pointer-events-none">
        <h4 className="font-bold text-slate-700 mb-1">트리맵 (TreeMap)</h4>
        <p className="text-slate-500">지식 점수 비중을 사각형 면적으로 비교합니다.</p>
      </div>
      <svg ref={svgRef} className="w-full h-full"></svg>
    </div>
  );
};