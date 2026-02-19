import React, { useEffect, useRef } from 'react';
import { Node } from '../types';
import * as d3 from 'd3';

interface SunburstChartProps {
  nodes: Node[];
  onNodeClick?: (nodeId: string) => void;
}

export const SunburstChart: React.FC<SunburstChartProps> = ({ nodes, onNodeClick }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!nodes.length || !svgRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    const radius = width / 6;

    // Data Prep
    const grouped = new Map<string, any[]>();
    nodes.forEach(node => {
      const topic = node.tags && node.tags.length > 0 ? node.tags[0] : "미분류";
      if (!grouped.has(topic)) grouped.set(topic, []);
      grouped.get(topic)?.push(node);
    });

    const data = {
      name: "전체 지식",
      children: Array.from(grouped.entries()).map(([topic, children]) => ({
        name: topic,
        children: children.map(c => ({ name: c.title, value: c.val || 10, id: c.id }))
      }))
    };

    const color = d3.scaleOrdinal(d3.schemeTableau10);

    const hierarchy = d3.hierarchy(data)
      .sum(d => (d as any).value)
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    // KEY FIX: Use depth-based partition (y represents level, not radius yet)
    const root = d3.partition()
      .size([2 * Math.PI, hierarchy.height + 1])(hierarchy);

    root.each((d: any) => d.current = d);

    const arc = d3.arc<d3.HierarchyRectangularNode<any>>()
      .startAngle(d => d.x0)
      .endAngle(d => d.x1)
      .padAngle(d => Math.min((d.x1 - d.x0) / 2, 0.005))
      .padRadius(radius * 1.5)
      .innerRadius(d => d.y0 * radius)
      .outerRadius(d => Math.max(0, d.y1 * radius - 1));

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const g = svg.append("g");

    // Add Zoom Behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 8]) // Allow zooming out to 0.1x and in to 8x
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoom)
       .call(zoom.transform, d3.zoomIdentity.translate(width / 2, height / 2));

    // Draw Paths
    const path = g.append("g")
      .selectAll("path")
      .data(root.descendants().slice(1))
      .join("path")
      .attr("fill", d => {
        while (d.depth > 1) d = d.parent!;
        return color((d.data as any).name);
      })
      .attr("fill-opacity", (d: any) => arcVisible(d.current) ? (d.children ? 0.6 : 0.4) : 0)
      .attr("pointer-events", (d: any) => arcVisible(d.current) ? "auto" : "none")
      .attr("d", (d: any) => arc(d.current))
      .style("cursor", "pointer")
      .on("click", (e, d) => {
         // If leaf node, trigger external click handler
         if(!d.children && (d.data as any).id) {
            e.stopPropagation();
            if (onNodeClick) onNodeClick((d.data as any).id);
         } else {
             clicked(e, d);
         }
      });
      
    path.append("title")
      .text(d => `${d.ancestors().map(d => (d.data as any).name).reverse().join("/")}\n점수: ${d.value}`);

    // Center Circle (Back button)
    const parent = g.append("circle")
      .datum(root)
      .attr("r", radius)
      .attr("fill", "none")
      .attr("pointer-events", "all")
      .on("click", clicked);

    // Center Label
    const centerLabel = g.append("text")
        .attr("text-anchor", "middle")
        .attr("dy", "0.35em")
        .style("font-size", "24px") // Increased from 14px
        .style("font-weight", "bold")
        .style("fill", "#475569")
        .style("pointer-events", "none")
        .text("전체 지식");

    // Segment Labels
    const label = g.append("g")
      .attr("pointer-events", "none")
      .attr("text-anchor", "middle")
      .style("user-select", "none")
      .selectAll("text")
      .data(root.descendants().slice(1))
      .join("text")
      .attr("dy", "0.35em")
      .attr("fill-opacity", (d: any) => +labelVisible(d.current))
      .attr("transform", (d: any) => labelTransform(d.current))
      .style("font-size", "14px") // Increased from 10px
      .style("fill", "#333")
      .style("font-weight", "bold")
      .style("text-shadow", "0 1px 3px rgba(255,255,255,0.7)")
      .text(d => (d.data as any).name.substring(0, 10));

    function clicked(event: any, p: any) {
      // Prevent zoom event from interfering with click
      event.stopPropagation();
      
      parent.datum(p.parent || root);
      centerLabel.text(p.data.name === "Root" ? "전체 지식" : p.data.name);

      root.each((d: any) => d.target = {
        x0: Math.max(0, Math.min(1, (d.x0 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
        x1: Math.max(0, Math.min(1, (d.x1 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
        y0: Math.max(0, d.y0 - p.depth),
        y1: Math.max(0, d.y1 - p.depth)
      });

      const t = g.transition().duration(750);

      path.transition(t as any)
        .tween("data", (d: any) => {
          const i = d3.interpolate(d.current, d.target);
          return (t: any) => d.current = i(t);
        })
        .filter(function(this: SVGPathElement, d: any) {
          return +(this.getAttribute("fill-opacity") || 0) > 0 || arcVisible(d.target);
        })
        .attr("fill-opacity", (d: any) => arcVisible(d.target) ? (d.children ? 0.6 : 0.4) : 0)
        .attr("pointer-events", (d: any) => arcVisible(d.target) ? "auto" : "none")
        .attrTween("d", (d: any) => () => arc(d.current) || "");

      label.filter(function(this: SVGTextElement, d: any) {
          return +(this.getAttribute("fill-opacity") || 0) > 0 || labelVisible(d.target);
        }).transition(t as any)
        .attr("fill-opacity", (d: any) => +labelVisible(d.target))
        .attrTween("transform", (d: any) => () => labelTransform(d.current));
    }

    function arcVisible(d: any) {
      if (!d) return false;
      return d.y1 <= 3 && d.y0 >= 1 && d.x1 > d.x0;
    }

    function labelVisible(d: any) {
      if (!d) return false;
      return d.y1 <= 3 && d.y0 >= 1 && (d.y1 - d.y0) * (d.x1 - d.x0) > 0.03;
    }

    function labelTransform(d: any) {
      if (!d) return "translate(0,0)";
      const x = (d.x0 + d.x1) / 2 * 180 / Math.PI;
      const y = (d.y0 + d.y1) / 2 * radius;
      return `rotate(${x - 90}) translate(${y},0) rotate(${x < 180 ? 0 : 180})`;
    }

  }, [nodes, onNodeClick]);

  return (
    <div ref={containerRef} className="w-full h-full bg-white relative rounded-xl overflow-hidden cursor-move">
       <div className="absolute top-4 left-4 z-10 bg-white/90 p-3 rounded-xl border border-slate-200 shadow-sm text-xs pointer-events-none">
        <h4 className="font-bold text-slate-700 mb-1">썬버스트 (Sunburst)</h4>
        <p className="text-slate-500">중앙/바깥 클릭으로 레벨 이동. <span className="text-brand-600 font-bold">드래그/휠로 확대/축소 가능.</span></p>
      </div>
      <svg ref={svgRef} className="w-full h-full"></svg>
    </div>
  );
};