import { useEffect, useRef } from 'react';
import Plotly from 'plotly.js-dist-min';
import type { Config, Data, Layout } from 'plotly.js-dist-min';

export const CHART_PALETTE = [
  '#10233F', // Deep Navy
  '#F5A623', // Amber
  '#4D83A8', // Muted Blue
  '#2E7D6B', // Academic Sage
  '#B65A3A', // Warm Rust
  '#6F5A8E', // Slate Plum
  '#8A6D3B', // Ochre
  '#3A6B7C', // Steel Teal
];

interface PlotlyChartProps {
  data: Data[];
  layout?: Partial<Layout>;
  config?: Partial<Config>;
  className?: string;
  height?: number;
}

export function PlotlyChart({
  data,
  layout,
  config,
  className = '',
  height = 300,
}: PlotlyChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const mergedLayout: Partial<Layout> = {
      paper_bgcolor: 'rgba(255, 252, 246, 0)',
      plot_bgcolor: 'rgba(255, 252, 246, 0)',
      font: {
        family: 'Inter, sans-serif',
        color: '#292724',
        size: 12,
      },
      margin: { l: 50, r: 20, t: 32, b: 42 },
      height,
      hovermode: 'closest',
      xaxis: {
        gridcolor: '#ECE5D6',
        linecolor: '#D5CCB9',
        zerolinecolor: '#D5CCB9',
        tickfont: { color: '#4A463F', size: 11 },
        ...layout?.xaxis,
      },
      yaxis: {
        gridcolor: '#ECE5D6',
        linecolor: '#D5CCB9',
        zerolinecolor: '#D5CCB9',
        tickfont: { color: '#4A463F', size: 11 },
        ...layout?.yaxis,
      },
      legend: {
        orientation: 'h',
        x: 0.5,
        xanchor: 'center',
        y: 1.12,
        font: { size: 12, color: '#292724' },
        ...layout?.legend,
      },
      ...layout,
    };

    // Preserve explicit axis sub-overrides if layout passed xaxis/yaxis
    if (layout?.xaxis) {
      mergedLayout.xaxis = {
        gridcolor: '#ECE5D6',
        linecolor: '#D5CCB9',
        zerolinecolor: '#D5CCB9',
        tickfont: { color: '#4A463F', size: 11 },
        ...layout.xaxis,
      };
    }
    if (layout?.yaxis) {
      mergedLayout.yaxis = {
        gridcolor: '#ECE5D6',
        linecolor: '#D5CCB9',
        zerolinecolor: '#D5CCB9',
        tickfont: { color: '#4A463F', size: 11 },
        ...layout.yaxis,
      };
    }

    const mergedConfig: Partial<Config> = {
      responsive: true,
      displayModeBar: true,
      displaylogo: false,
      modeBarButtonsToRemove: ['lasso2d', 'select2d', 'autoScale2d'],
      ...config,
    };

    Plotly.react(el, data, mergedLayout, mergedConfig);

    const observer = new ResizeObserver(() => {
      if (el) {
        Plotly.Plots.resize(el);
      }
    });
    observer.observe(el);

    return () => {
      observer.disconnect();
      Plotly.purge(el);
    };
  }, [data, layout, config, height]);

  return <div ref={containerRef} className={`w-full ${className}`} style={{ minHeight: height }} />;
}
