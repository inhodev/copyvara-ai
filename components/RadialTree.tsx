import React, { useEffect, useRef } from 'react';
import { Node } from '../types';
import * as d3 from 'd3';

interface RadialTreeProps {
  nodes: Node[];
  onNodeClick?: (nodeId: string) => void;
}

export const RadialTree: React.FC<RadialTreeProps> = ({ nodes, onNodeClick }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!nodes.length || !svgRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    const radius = Math.min(width, height) / 2 * 0.8; // Use 80% of space

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // Data Prep
    const grouped = new Map<string, any[]>();
    nodes.forEach(node => {
      const topic = node.tags && node.tags.length > 0 ? node.tags[0] : "미분류";
      if (!grouped.has(topic)) grouped.set(topic, []);
      grouped.get(topic)?.push(node);
    });

    const data = {
      name: "Knowledge",
      children: Array.from(grouped.entries()).map(([topic, children]) => ({
        name: topic,
        children: children.map(c => ({ name: c.title, id: c.id }))
      }))
    };

    const tree = d3.tree()
      .size([2 * Math.PI, radius])
      .separation((a, b) => (a.parent == b.parent ? 1 : 2) / a.depth);

    const root = d3.hierarchy(data);
    const treeData = tree(root);

    // Zoom setup
    const g = svg.append("g");
    
    // Initial centering
    g.attr("transform", `translate(${width/2},${height/2})`);

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoom)
       // Set initial transform to center the chart
       .call(zoom.transform, d3.zoomIdentity.translate(width/2, height/2));

    // Links
    g.selectAll(".link")
      .data(treeData.links())
      .join("path")
      .attr("class", "link")
      .attr("fill", "none")
      .attr("stroke", "#cbd5e1")
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", 1.5)
      .attr("d", d3.linkRadial()
        .angle((d: any) => d.x)
        .radius((d: any) => d.y) as any
      );

    // Nodes
    const node = g.selectAll(".node")
      .data(treeData.descendants())
      .join("g")
      .attr("transform", (d: any) => `rotate(${d.x * 180 / Math.PI - 90}) translate(${d.y},0)`);

    node.append("circle")
      .attr("r", d => d.depth === 0 ? 0 : d.depth === 1 ? 6 : 4)
      .attr("fill", d => d.depth === 1 ? "#0ea5e9" : "#fff")
      .attr("stroke", d => d.depth === 1 ? "#0ea5e9" : "#64748b")
      .attr("stroke-width", 2)
      .style("cursor", d => !d.children ? "pointer" : "default")
      .on("click", (e, d: any) => {
          if (!d.children && d.data.id && onNodeClick) {
              e.stopPropagation();
              onNodeClick(d.data.id);
          }
      });

    // Labels
    node.append("text")
      .attr("dy", "0.31em")
      .attr("x", (d: any) => d.x < Math.PI === !d.children ? 8 : -8)
      .attr("text-anchor", (d: any) => d.x < Math.PI === !d.children ? "start" : "end")
      .attr("transform", (d: any) => d.x >= Math.PI ? "rotate(180)" : null)
      .text((d: any) => {
         const name = (d.data as any).name;
         return name.length > 15 ? name.substring(0, 15) + "..." : name;
      })
      .style("font-size", d => d.depth === 1 ? "12px" : "10px")
      .style("font-weight", d => d.depth === 1 ? "bold" : "normal")
      .style("fill", "#334155")
      .style("text-shadow", "0 1px 2px white")
      .style("pointer-events", "none");

  }, [nodes, onNodeClick]);

  return (
    <div ref={containerRef} className="w-full h-full bg-white relative rounded-xl overflow-hidden">
        <div className="absolute top-4 left-4 z-10 bg-white/90 p-3 rounded-xl border border-slate-200 shadow-sm text-xs pointer-events-none">
        <h4 className="font-bold text-slate-700 mb-1">래디얼 트리 (Radial Tree)</h4>
        <p className="text-slate-500">지식 분류 체계를 방사형으로 탐색합니다. (Drag & Zoom 가능)</p>
      </div>
      <svg ref={svgRef} className="w-full h-full cursor-move"></svg>
    </div>
  );
};