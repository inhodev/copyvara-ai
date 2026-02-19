import React, { useEffect, useRef } from 'react';
import { Node } from '../types';
import * as d3 from 'd3';

interface MemoryDecayProps {
  nodes: Node[];
  onNodeClick?: (nodeId: string) => void;
}

export const MemoryDecay: React.FC<MemoryDecayProps> = ({ nodes, onNodeClick }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!nodes.length || !svgRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    const margin = { top: 40, right: 40, bottom: 60, left: 60 };

    // 1. Robust Data Processing
    const now = new Date();
    const data = nodes.map(node => {
        // Fallback for missing dates: Randomly assign within last 30 days if invalid
        let createdAt = new Date((node as any).createdAt);
        if (isNaN(createdAt.getTime())) {
            createdAt = new Date(Date.now() - Math.random() * 30 * 86400000); 
        }

        const daysPassed = Math.max(0, (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
        
        // Ebbinghaus Formula Approximation: R = e^(-t/S)
        const strength = Math.max(5, ((node.val || 50) / 5)); // Minimum strength to prevent instant decay
        const retention = Math.exp(-daysPassed / strength) * 100;

        return {
            ...node,
            daysPassed,
            retention,
            strength
        };
    }).sort((a, b) => a.daysPassed - b.daysPassed);

    const maxDays = d3.max(data, d => d.daysPassed) || 30;

    // 2. Scales
    const x = d3.scaleLinear()
      .domain([0, maxDays + 5]) // Add some buffer
      .range([margin.left, width - margin.right]);

    const y = d3.scaleLinear()
      .domain([0, 100])
      .range([height - margin.bottom, margin.top]);

    const colorScale = d3.scaleLinear<string>()
      .domain([0, 50, 100])
      .range(["#ef4444", "#f59e0b", "#10b981"]);

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // 3. Guides & Zones
    // "Review Needed" Zone
    svg.append("rect")
      .attr("x", margin.left)
      .attr("y", y(40))
      .attr("width", width - margin.left - margin.right)
      .attr("height", y(0) - y(40))
      .attr("fill", "#fee2e2")
      .attr("opacity", 0.3);

    svg.append("line")
        .attr("x1", margin.left)
        .attr("x2", width - margin.right)
        .attr("y1", y(40))
        .attr("y2", y(40))
        .attr("stroke", "#ef4444")
        .attr("stroke-dasharray", "4 4")
        .attr("stroke-opacity", 0.5);

    svg.append("text")
      .attr("x", width - margin.right)
      .attr("y", y(40) - 5)
      .attr("text-anchor", "end")
      .attr("fill", "#ef4444")
      .attr("font-size", "11px")
      .attr("font-weight", "bold")
      .text("위험 구간 (보존율 40% 미만)");

    // Theoretical Curve (Ideal)
    const curveData = d3.range(0, maxDays, 0.5).map(t => ({
        t,
        r: Math.exp(-t / 20) * 100 // Hypothetical average strength
    }));
    
    const line = d3.line<{t: number, r: number}>()
        .x(d => x(d.t))
        .y(d => y(d.r))
        .curve(d3.curveBasis);

    svg.append("path")
        .datum(curveData)
        .attr("fill", "none")
        .attr("stroke", "#cbd5e1")
        .attr("stroke-width", 2)
        .attr("stroke-dasharray", "5 5")
        .attr("d", line);

    // Axes
    const xAxis = d3.axisBottom(x).ticks(5).tickFormat(d => `${d}일 전`);
    const yAxis = d3.axisLeft(y).tickFormat(d => `${d}%`);

    svg.append("g")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(xAxis)
      .select(".domain").attr("stroke", "#cbd5e1");

    svg.append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(yAxis)
      .select(".domain").remove();

    // Labels
    svg.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -height / 2)
      .attr("y", 20)
      .attr("text-anchor", "middle")
      .attr("fill", "#64748b")
      .attr("font-size", "12px")
      .text("기억 보존율 (Memory Retention)");

    svg.append("text")
      .attr("x", width / 2)
      .attr("y", height - 20)
      .attr("text-anchor", "middle")
      .attr("fill", "#64748b")
      .attr("font-size", "12px")
      .text("학습 후 경과 시간 (Days)");

    // 4. Plot Circles (Knowledge Atoms)
    const circles = svg.selectAll("circle")
      .data(data)
      .join("circle")
      .attr("cx", d => x(d.daysPassed))
      .attr("cy", d => y(d.retention))
      .attr("r", d => Math.sqrt(d.val || 50) * 0.8 + 3)
      .attr("fill", d => colorScale(d.retention))
      .attr("stroke", "#fff")
      .attr("stroke-width", 2)
      .style("filter", "drop-shadow(0px 2px 2px rgba(0,0,0,0.1))")
      .attr("cursor", "pointer")
      .on("click", (e, d) => onNodeClick && onNodeClick(d.id));

    // 5. Tooltip
    const tooltip = d3.select(containerRef.current)
      .append("div")
      .style("position", "absolute")
      .style("visibility", "hidden")
      .style("background", "rgba(255, 255, 255, 0.95)")
      .style("border", "1px solid #e2e8f0")
      .style("padding", "8px")
      .style("border-radius", "8px")
      .style("box-shadow", "0 4px 6px -1px rgba(0, 0, 0, 0.1)")
      .style("font-size", "11px")
      .style("pointer-events", "none")
      .style("z-index", "20");

    circles.on("mouseover", (event, d) => {
      tooltip.style("visibility", "visible")
        .html(`
          <div class="font-bold text-slate-800 mb-1">${d.title}</div>
          <div class="text-xs text-slate-500">경과: ${Math.round(d.daysPassed)}일</div>
          <div class="text-xs">현재 보존율: <span class="font-bold" style="color:${colorScale(d.retention)}">${Math.round(d.retention)}%</span></div>
        `);
      d3.select(event.currentTarget).transition().attr("r", (d: any) => Math.sqrt(d.val || 50) * 0.8 + 6).attr("stroke", "#000");
    })
    .on("mousemove", (event) => {
      tooltip
        .style("top", (event.offsetY - 50) + "px")
        .style("left", (event.offsetX + 15) + "px");
    })
    .on("mouseout", (event) => {
      tooltip.style("visibility", "hidden");
      d3.select(event.currentTarget).transition().attr("r", (d: any) => Math.sqrt(d.val || 50) * 0.8 + 3).attr("stroke", "#fff");
    });

  }, [nodes, onNodeClick]);

  return (
    <div ref={containerRef} className="w-full h-full bg-white relative rounded-xl overflow-hidden">
      <div className="absolute top-4 left-4 z-10 bg-white/90 p-3 rounded-xl border border-slate-200 shadow-sm text-xs pointer-events-none">
        <h4 className="font-bold text-slate-700 mb-1">망각 곡선 (Memory Decay)</h4>
        <p className="text-slate-500">붉은 영역(40% 미만)에 있는 지식은 복습이 시급합니다.</p>
      </div>
      <svg ref={svgRef} className="w-full h-full"></svg>
    </div>
  );
};