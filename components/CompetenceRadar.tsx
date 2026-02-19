import React, { useEffect, useRef } from 'react';
import { Node } from '../types';
import * as d3 from 'd3';

interface CompetenceRadarProps {
  nodes: Node[];
}

export const CompetenceRadar: React.FC<CompetenceRadarProps> = ({ nodes }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!nodes.length || !svgRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    const margin = 80; // Increased margin for larger text
    const radius = Math.min(width, height) / 2 - margin;

    // 1. Data Aggregation by Topic
    const topicStats = new Map<string, { totalScore: number; count: number }>();
    
    nodes.forEach(node => {
      const topic = node.tags && node.tags.length > 0 ? node.tags[0] : "General";
      const current = topicStats.get(topic) || { totalScore: 0, count: 0 };
      topicStats.set(topic, {
        totalScore: current.totalScore + (node.val || 50),
        count: current.count + 1
      });
    });

    // Convert to array and take Top 6-8 topics to avoid overcrowding
    let data = Array.from(topicStats.entries()).map(([axis, stats]) => ({
      axis,
      value: stats.totalScore / stats.count // Average Score (0-100)
    })).sort((a, b) => b.value - a.value).slice(0, 8);

    // If too few, add placeholders
    if (data.length < 3) {
      // Handle edge case of few topics
    }

    const allAxis = data.map(d => d.axis);
    const total = allAxis.length;
    const angleSlice = Math.PI * 2 / total;

    // 2. Scales
    const rScale = d3.scaleLinear().range([0, radius]).domain([0, 100]);

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const g = svg.append("g")
      .attr("transform", `translate(${width / 2},${height / 2})`);

    // 3. Draw Grid
    const axisGrid = g.append("g").attr("class", "axisWrapper");
    const levels = 4; // 25, 50, 75, 100

    for (let i = 0; i < levels; i++) {
      const levelFactor = radius * ((i + 1) / levels);
      axisGrid.selectAll(".levels")
        .data([1])
        .enter()
        .append("circle")
        .attr("r", levelFactor)
        .style("fill", "#CDCDCD")
        .style("stroke", "#CDCDCD")
        .style("fill-opacity", 0.1);
      
      axisGrid.append("text")
        .attr("x", 5)
        .attr("y", -levelFactor)
        .attr("dy", "0.4em")
        .style("font-size", "12px") // Increased from 10px
        .style("fill", "#64748b")
        .text(((i + 1) * 25).toString());
    }

    // 4. Draw Axes
    const axis = axisGrid.selectAll(".axis")
      .data(allAxis)
      .enter()
      .append("g")
      .attr("class", "axis");

    axis.append("line")
      .attr("x1", 0)
      .attr("y1", 0)
      .attr("x2", (d, i) => rScale(100) * Math.cos(angleSlice * i - Math.PI / 2))
      .attr("y2", (d, i) => rScale(100) * Math.sin(angleSlice * i - Math.PI / 2))
      .attr("class", "line")
      .style("stroke", "white")
      .style("stroke-width", "2px");

    axis.append("text")
      .attr("class", "legend")
      .style("font-size", "16px") // Increased from 11px
      .style("font-weight", "bold")
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .attr("x", (d, i) => rScale(115) * Math.cos(angleSlice * i - Math.PI / 2))
      .attr("y", (d, i) => rScale(115) * Math.sin(angleSlice * i - Math.PI / 2))
      .text(d => d)
      .call(wrap, 80); // Increased wrap width

    // 5. Draw Radar Blob
    const radarLine = d3.lineRadial<any>()
      .curve(d3.curveLinearClosed)
      .radius(d => rScale(d.value))
      .angle((d, i) => i * angleSlice);

    g.append("path")
      .datum(data)
      .attr("d", radarLine)
      .style("stroke-width", 2)
      .style("stroke", "#0ea5e9")
      .style("fill", "#0ea5e9")
      .style("fill-opacity", 0.3);

    // 6. Draw Dots
    g.selectAll(".radarCircle")
      .data(data)
      .enter().append("circle")
      .attr("class", "radarCircle")
      .attr("r", 4)
      .attr("cx", (d, i) => rScale(d.value) * Math.cos(angleSlice * i - Math.PI / 2))
      .attr("cy", (d, i) => rScale(d.value) * Math.sin(angleSlice * i - Math.PI / 2))
      .style("fill", "#0ea5e9")
      .style("fill-opacity", 0.8);

    // Text Wrap Helper
    function wrap(text: any, width: number) {
      text.each(function(this: SVGTextElement) {
        const text = d3.select(this);
        const words = text.text().split(/\s+/).reverse();
        let word, line: string[] = [], lineNumber = 0, lineHeight = 1.1, y = text.attr("y"), x = text.attr("x"), dy = parseFloat(text.attr("dy")), tspan = text.text(null).append("tspan").attr("x", x).attr("y", y).attr("dy", dy + "em");
        while (word = words.pop()) {
          line.push(word);
          tspan.text(line.join(" "));
          if ((tspan.node()?.getComputedTextLength() || 0) > width) {
            line.pop();
            tspan.text(line.join(" "));
            line = [word];
            tspan = text.append("tspan").attr("x", x).attr("y", y).attr("dy", ++lineNumber * lineHeight + dy + "em").text(word);
          }
        }
      });
    }

  }, [nodes]);

  return (
    <div ref={containerRef} className="w-full h-full bg-white relative rounded-xl overflow-hidden">
      <div className="absolute top-4 left-4 z-10 bg-white/90 p-3 rounded-xl border border-slate-200 shadow-sm text-xs pointer-events-none">
        <h4 className="font-bold text-slate-700 mb-1">역량 레이더 (Competence Radar)</h4>
        <p className="text-slate-500">주제별 지식의 깊이와 밸런스를 진단합니다.</p>
      </div>
      <svg ref={svgRef} className="w-full h-full"></svg>
    </div>
  );
};