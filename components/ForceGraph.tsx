import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { Edge, Node } from '../types';

interface ForceGraphProps {
  nodes: Node[];
  edges: Edge[];
  onNodeClick?: (nodeId: string) => void;
}

export const ForceGraph: React.FC<ForceGraphProps> = ({ nodes, edges, onNodeClick }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!nodes.length || !svgRef.current || !containerRef.current) return;

    // Clear previous
    d3.select(svgRef.current).selectAll("*").remove();

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    // Deep copy to avoid mutating props used elsewhere
    const nodesData = nodes.map(d => ({ ...d }));
    const nodeIdSet = new Set(nodesData.map((n) => n.id));
    // D3 forceLink는 존재하지 않는 노드 id가 있으면 즉시 throw 하므로 사전 필터링
    const linksData = edges
      .filter((e) => nodeIdSet.has(e.source) && nodeIdSet.has(e.target))
      .map(d => ({ ...d }));

    const simulation = d3.forceSimulation(nodesData as any)
      .force("link", d3.forceLink(linksData).id((d: any) => d.id).distance(150)) // Increased distance for text space
      .force("charge", d3.forceManyBody().strength(-400)) // Increased repulsion
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide().radius(45)); // Increased collision radius

    const svg = d3.select(svgRef.current)
      .attr("viewBox", [0, 0, width, height]);

    // Define arrow markers
    svg.append("defs").selectAll("marker")
      .data(["confirmed", "candidate"])
      .join("marker")
      .attr("id", d => `arrow-${d}`)
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 26) // Adjusted for node size + spacing
      .attr("refY", 0)
      .attr("markerWidth", 5)
      .attr("markerHeight", 5)
      .attr("orient", "auto")
      .append("path")
      .attr("fill", d => d === 'confirmed' ? '#003049' : '#C1121F')
      .attr("d", "M0,-5L10,0L0,5");

    const link = svg.append("g")
      .selectAll("line")
      .data(linksData)
      .join("line")
      .attr("stroke", d => d.status === 'confirmed' ? '#669BBC' : '#C1121F')
      .attr("stroke-opacity", d => d.status === 'confirmed' ? 0.6 : 0.4)
      .attr("stroke-width", d => d.status === 'confirmed' ? 2 : 1.5)
      .attr("stroke-dasharray", d => d.status === 'candidate' ? "4,4" : null)
      .attr("marker-end", d => `url(#arrow-${d.status})`);

    const nodeGroup = svg.append("g")
      .selectAll("g")
      .data(nodesData)
      .join("g")
      .call(d3.drag<any, any>()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended));

    // Node Circle
    nodeGroup.append("circle")
      .attr("r", 16) // Slightly larger nodes
      .attr("fill", d => d.status === 'done' ? '#003049' : '#FDF0D5')
      .attr("stroke", "#fff")
      .attr("stroke-width", 2)
      .attr("cursor", "pointer")
      .on("click", (event, d) => onNodeClick && onNodeClick(d.id));

    // Node Label using foreignObject for text wrapping
    nodeGroup.append("foreignObject")
      .attr("x", -60) // Center horizontally (width/2)
      .attr("y", 20)  // Position below circle
      .attr("width", 120)
      .attr("height", 60)
      .style("pointer-events", "none") // Let clicks pass through to the svg/background if needed
      .append("xhtml:div")
      .style("font-family", "Pretendard, sans-serif")
      .style("font-size", "11px")
      .style("color", "#1e293b")
      .style("font-weight", "600")
      .style("text-align", "center")
      .style("line-height", "1.2")
      .style("word-wrap", "break-word")
      .style("display", "-webkit-box")
      .style("-webkit-line-clamp", "3") // Limit to 3 lines
      .style("-webkit-box-orient", "vertical")
      .style("overflow", "hidden")
      .style("text-shadow", "0 1px 2px rgba(255,255,255,0.8)") // Improve readability
      .text(d => d.title);

    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      nodeGroup
        .attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

    function dragstarted(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event: any, d: any) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    // Zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        svg.selectAll("g").attr("transform", event.transform);
      });

    svg.call(zoom);

    return () => {
      simulation.stop();
    };
  }, [nodes, edges, onNodeClick]);

  return (
    <div ref={containerRef} className="w-full h-full bg-white rounded-xl shadow-inner border border-brand-100 overflow-hidden relative">
      <div className="absolute top-4 left-4 z-10 bg-white/90 p-2 rounded-lg border border-brand-100 text-xs shadow-sm backdrop-blur-sm">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full bg-brand-600"></span>
          <span className="text-slate-600">문서 노드</span>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <span className="w-6 h-0.5 bg-brand-400"></span>
          <span className="text-slate-600">확정 연결</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-6 h-0.5 border-t border-dashed border-point-500"></span>
          <span className="text-slate-600">추천 (후보)</span>
        </div>
      </div>
      <svg ref={svgRef} className="w-full h-full"></svg>
    </div>
  );
};
