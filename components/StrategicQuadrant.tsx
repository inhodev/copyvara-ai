import React, { useEffect, useRef } from 'react';
import { Node, Edge } from '../types';
import * as d3 from 'd3';

interface StrategicQuadrantProps {
  nodes: Node[];
  edges: Edge[];
  onNodeClick?: (nodeId: string) => void;
}

export const StrategicQuadrant: React.FC<StrategicQuadrantProps> = ({ nodes, edges, onNodeClick }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!nodes.length || !svgRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    const margin = { top: 60, right: 60, bottom: 60, left: 70 };

    // 1. Metrics
    const degreeMap = new Map<string, number>();
    edges.forEach(e => {
        if(e.status === 'confirmed') {
            degreeMap.set(e.source, (degreeMap.get(e.source) || 0) + 1);
            degreeMap.set(e.target, (degreeMap.get(e.target) || 0) + 1);
        }
    });

    const data = nodes.map(n => ({
        ...n,
        connectivity: degreeMap.get(n.id) || 0,
        score: n.val || 0
    }));

    // 2. Scales
    const maxConn = Math.max(d3.max(data, d => d.connectivity) || 5, 5);
    const x = d3.scaleLinear().domain([0, maxConn * 1.1]).range([margin.left, width - margin.right]);
    const y = d3.scaleLinear().domain([0, 100]).range([height - margin.bottom, margin.top]);
    const color = d3.scaleOrdinal(d3.schemeTableau10);

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // 3. Draw Quadrant Backgrounds (Zones)
    const midX = x(maxConn / 2); // Split based on median or fixed value
    const midY = y(50); // Score 50

    // Helper to draw zone
    const drawZone = (x: number, y: number, w: number, h: number, color: string, label: string, desc: string) => {
        svg.append("rect")
            .attr("x", x).attr("y", y).attr("width", w).attr("height", h)
            .attr("fill", color).attr("opacity", 0.4);
        
        svg.append("text")
            .attr("x", x + w/2).attr("y", y + h/2 - 15)
            .attr("text-anchor", "middle")
            .attr("font-weight", "bold")
            .attr("font-size", "20px") // Increased from 14px
            .attr("fill", d3.rgb(color).darker(2).toString())
            .text(label);
            
        svg.append("text")
            .attr("x", x + w/2).attr("y", y + h/2 + 15)
            .attr("text-anchor", "middle")
            .attr("font-size", "14px") // Increased from 10px
            .attr("fill", d3.rgb(color).darker(2).toString())
            .text(desc);
    };

    // Q1: High Score, High Conn (Top Right) -> Core Assets
    drawZone(midX, margin.top, width - margin.right - midX, midY - margin.top, "#dcfce7", "핵심 자산 (Core)", "높은 가치 + 중심 역할");
    
    // Q2: High Score, Low Conn (Top Left) -> Specialists
    drawZone(margin.left, margin.top, midX - margin.left, midY - margin.top, "#e0f2fe", "전문 지식 (Specialist)", "높은 가치 + 독립적");

    // Q3: Low Score, Low Conn (Bottom Left) -> Emerging/Seeds
    drawZone(margin.left, midY, midX - margin.left, height - margin.bottom - midY, "#f1f5f9", "초기 씨앗 (Seeds)", "발전 필요 + 독립적");

    // Q4: Low Score, High Conn (Bottom Right) -> Connectors
    drawZone(midX, midY, width - margin.right - midX, height - margin.bottom - midY, "#ffedd5", "연결 고리 (Bridge)", "낮은 가치 + 중심 역할");

    // 4. Axes & Grid
    svg.append("g").attr("transform", `translate(0,${height - margin.bottom})`).call(d3.axisBottom(x).ticks(5));
    svg.append("g").attr("transform", `translate(${margin.left},0)`).call(d3.axisLeft(y).ticks(5));
    
    // Axis Titles
    svg.append("text").attr("x", width/2).attr("y", height - 15).attr("text-anchor", "middle").attr("font-weight", "bold").text("영향력 (연결 중심성) →").attr("font-size", "16px"); // Increased from 12px
    svg.append("text").attr("transform", "rotate(-90)").attr("x", -height/2).attr("y", 20).attr("text-anchor", "middle").attr("font-weight", "bold").text("← 지식 완성도 (Score)").attr("font-size", "16px"); // Increased from 12px

    // 5. Plot Points
    const circles = svg.selectAll("circle")
        .data(data)
        .join("circle")
        .attr("cx", d => x(d.connectivity))
        .attr("cy", d => y(d.score))
        .attr("r", 6)
        .attr("fill", d => color(d.tags?.[0] || "Other"))
        .attr("stroke", "#fff")
        .attr("stroke-width", 2)
        .attr("cursor", "pointer")
        .style("filter", "drop-shadow(0px 2px 2px rgba(0,0,0,0.1))")
        .on("click", (e, d) => onNodeClick && onNodeClick(d.id));

    // 6. Tooltip (Simple using title for now, can be upgraded)
    circles.append("title")
        .text(d => `[${d.title}]\n점수: ${d.score}\n연결: ${d.connectivity}`);

  }, [nodes, edges, onNodeClick]);

  return (
    <div ref={containerRef} className="w-full h-full bg-white relative rounded-xl overflow-hidden">
      <div className="absolute top-4 left-4 z-10 bg-white/90 p-3 rounded-xl border border-slate-200 shadow-sm text-xs pointer-events-none">
        <h4 className="font-bold text-slate-700 mb-1">전략 사분면 (Strategic Quadrant)</h4>
        <p className="text-slate-500">지식의 위상(Phase)을 분석하여 관리 전략을 수립하세요.</p>
      </div>
      <svg ref={svgRef} className="w-full h-full"></svg>
    </div>
  );
};