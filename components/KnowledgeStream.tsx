import React, { useEffect, useRef, useState } from 'react';
import { Node } from '../types';
import * as d3 from 'd3';

interface KnowledgeStreamProps {
  nodes: Node[];
}

export const KnowledgeStream: React.FC<KnowledgeStreamProps> = ({ nodes }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltipData, setTooltipData] = useState<{ date: Date; values: { key: string; value: number }[] } | null>(null);

  useEffect(() => {
    if (!nodes.length || !svgRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    const margin = { top: 20, right: 30, bottom: 50, left: 30 };

    // 1. Data Processing
    const topics = new Set<string>();
    
    // Find Date Range
    const dates = nodes.map(n => new Date((n as any).createdAt).getTime()).filter(d => !isNaN(d));
    let minTime = Math.min(...dates);
    let maxTime = Math.max(...dates);
    
    // Default range if empty
    const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;
    if (dates.length === 0) {
        minTime = Date.now() - ONE_WEEK * 4;
        maxTime = Date.now();
    }
    // Add buffer
    minTime -= ONE_WEEK;
    maxTime += ONE_WEEK;

    // Create time buckets (Weekly)
    const buckets = new Map<number, Record<string, number>>();
    for (let t = minTime; t <= maxTime; t += ONE_WEEK) {
        buckets.set(t, {});
    }

    nodes.forEach(node => {
        const d = new Date((node as any).createdAt);
        if (isNaN(d.getTime())) return;
        
        // Find closest bucket
        const t = Math.floor((d.getTime() - minTime) / ONE_WEEK) * ONE_WEEK + minTime;
        const topic = node.tags && node.tags.length > 0 ? node.tags[0] : "기타";
        topics.add(topic);

        if (buckets.has(t)) {
            const b = buckets.get(t)!;
            b[topic] = (b[topic] || 0) + (node.val || 10);
        }
    });

    const allTopics = Array.from(topics).sort();
    const sortedTimes = Array.from(buckets.keys()).sort();

    // Transform to D3 Stack format
    const chartData = sortedTimes.map(time => {
        const entry: any = { date: new Date(time) };
        const bucket = buckets.get(time)!;
        allTopics.forEach(topic => {
            // Add slight random noise/base to prevent flat-line issues
            entry[topic] = (bucket[topic] || 0) + 0.1; 
        });
        return entry;
    });

    // 2. Stack Layout (Silhouette for centered stream)
    const stack = d3.stack()
        .keys(allTopics)
        .offset(d3.stackOffsetSilhouette) 
        .order(d3.stackOrderNone);

    const series = stack(chartData);

    // 3. Scales
    const x = d3.scaleTime()
        .domain([new Date(minTime), new Date(maxTime)])
        .range([margin.left, width - margin.right]);

    const y = d3.scaleLinear()
        .domain([
            d3.min(series, layer => d3.min(layer, d => d[0])) || 0,
            d3.max(series, layer => d3.max(layer, d => d[1])) || 100
        ])
        .range([height - margin.bottom, margin.top]);

    const color = d3.scaleOrdinal(d3.schemeTableau10).domain(allTopics);
    
    // Smooth Area
    const area = d3.area()
        .curve(d3.curveMonotoneX) // Smooth curve
        .x((d: any) => x(d.data.date))
        .y0((d: any) => y(d[0]))
        .y1((d: any) => y(d[1]));

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // Definitions for Gradients
    const defs = svg.append("defs");
    allTopics.forEach((topic, i) => {
        const gradientId = `grad-${i}`;
        const baseColor = color(topic);
        const grad = defs.append("linearGradient")
            .attr("id", gradientId)
            .attr("x1", "0%")
            .attr("y1", "0%")
            .attr("x2", "0%")
            .attr("y2", "100%"); // Vertical gradient for depth
        
        grad.append("stop").attr("offset", "0%").attr("stop-color", d3.rgb(baseColor as string).brighter(0.5).toString());
        grad.append("stop").attr("offset", "50%").attr("stop-color", baseColor as string);
        grad.append("stop").attr("offset", "100%").attr("stop-color", d3.rgb(baseColor as string).darker(0.5).toString());
    });

    // 4. Draw Streams
    svg.selectAll("path")
        .data(series)
        .join("path")
        .attr("fill", (d, i) => `url(#grad-${i})`)
        .attr("d", area as any)
        .attr("opacity", 0.9)
        .attr("stroke", "white")
        .attr("stroke-width", 0.5)
        .attr("stroke-opacity", 0.3);

    // 5. Axes
    const xAxis = d3.axisBottom(x)
        .ticks(5)
        .tickFormat(d3.timeFormat("%b %d") as any)
        .tickSizeOuter(0);
    
    svg.append("g")
        .attr("transform", `translate(0,${height - margin.bottom})`)
        .call(xAxis)
        .attr("color", "#94a3b8")
        .select(".domain").remove();

    // 6. Interactive Cursor
    const cursor = svg.append("line")
        .attr("stroke", "#475569")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "4 4")
        .style("opacity", 0);

    svg.on("mousemove", (event) => {
        const [mx] = d3.pointer(event);
        if (mx < margin.left || mx > width - margin.right) {
            setTooltipData(null);
            cursor.style("opacity", 0);
            return;
        }

        const date = x.invert(mx);
        // Find nearest data point
        const index = d3.bisector((d: any) => d.date).center(chartData, date);
        const d = chartData[index];

        if (d) {
            cursor
                .attr("x1", x(d.date))
                .attr("x2", x(d.date))
                .attr("y1", margin.top)
                .attr("y2", height - margin.bottom)
                .style("opacity", 1);

            const values = allTopics.map(t => ({ key: t, value: Math.floor(d[t]) }))
                .filter(v => v.value > 0)
                .sort((a, b) => b.value - a.value);

            setTooltipData({ date: d.date, values });
        }
    }).on("mouseleave", () => {
        setTooltipData(null);
        cursor.style("opacity", 0);
    });

    // 7. Labels on widest part
    series.forEach(s => {
        let maxDiff = 0;
        let bestPoint: any = null;
        s.forEach((d: any) => {
            const diff = d[1] - d[0];
            if (diff > maxDiff) {
                maxDiff = diff;
                bestPoint = d;
            }
        });

        if (bestPoint && maxDiff > (y.domain()[1] - y.domain()[0]) * 0.08) { // Only show if thick enough
            svg.append("text")
                .attr("x", x(bestPoint.data.date))
                .attr("y", y((bestPoint[0] + bestPoint[1]) / 2))
                .attr("text-anchor", "middle")
                .attr("dy", "0.35em")
                .style("fill", "white")
                .style("font-size", "11px")
                .style("font-weight", "bold")
                .style("pointer-events", "none")
                .style("text-shadow", "0 1px 3px rgba(0,0,0,0.4)")
                .text(s.key);
        }
    });

  }, [nodes]);

  return (
    <div ref={containerRef} className="w-full h-full bg-white relative rounded-xl overflow-hidden">
        <div className="absolute top-4 left-4 z-10 bg-white/90 p-3 rounded-xl border border-slate-200 shadow-sm text-xs pointer-events-none">
            <h4 className="font-bold text-slate-700 mb-1">지식 흐름도 (Knowledge Stream)</h4>
            <p className="text-slate-500">시간에 따른 주제별 학습 강도의 변화를 보여줍니다.</p>
        </div>
        
        <svg ref={svgRef} className="w-full h-full cursor-crosshair"></svg>
        
        {/* HTML Tooltip Overlay */}
        {tooltipData && (
            <div className="absolute top-4 right-4 z-10 bg-white/95 p-3 rounded-xl border border-slate-200 shadow-lg min-w-[150px] animate-fadeIn pointer-events-none">
                <div className="text-xs font-bold text-slate-400 mb-2 uppercase">
                    {tooltipData.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </div>
                <div className="space-y-1">
                    {tooltipData.values.map(v => (
                        <div key={v.key} className="flex justify-between items-center text-xs">
                            <span className="font-semibold text-slate-700">{v.key}</span>
                            <span className="font-mono text-slate-500">{v.value}</span>
                        </div>
                    ))}
                    {tooltipData.values.length === 0 && <div className="text-xs text-slate-400 italic">No activity</div>}
                </div>
            </div>
        )}
    </div>
  );
};