'use client';

import { useEffect, useRef, useMemo } from 'react';
import { useDashboardStore } from '@/store/dashboardStore';
import styles from './TelemetryChart.module.css';

interface TelemetryChartProps {
  label: string;
  values: number[];
  color: string;
  fillColor?: string;
  min?: number;
  max?: number;
  unit?: string;
  height?: number;
  stepped?: boolean;
}

const W = 100;
const SAMPLES = 500;

function buildPath(
  values: number[],
  minV: number,
  maxV: number,
  h: number,
  stepped: boolean
): string {
  if (values.length < 2) return '';
  const range = maxV - minV || 1;
  const step = Math.max(1, Math.floor(values.length / SAMPLES));
  const sampled = values.filter((_, i) => i % step === 0);

  return sampled
    .map((v, i) => {
      const x = (i / (sampled.length - 1)) * W;
      const y = h - ((v - minV) / range) * h;
      if (i === 0) return `M ${x.toFixed(1)} ${y.toFixed(1)}`;
      if (stepped) {
        const prevX = ((i - 1) / (sampled.length - 1)) * W;
        return `L ${x.toFixed(1)} ${h - ((sampled[i - 1] - minV) / range) * h} L ${x.toFixed(1)} ${y.toFixed(1)}`;
      }
      return `L ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
}

function buildAreaPath(path: string, h: number): string {
  if (!path) return '';
  const first = path.slice(1, path.indexOf(' ', 2));
  return `${path} L ${W} ${h} L ${first.split(' ')[0]} ${h} Z`;
}

export function TelemetryChart({
  label,
  values,
  color,
  fillColor,
  min,
  max,
  unit = '',
  height = 40,
  stepped = false,
}: TelemetryChartProps) {
  const cursorRef = useRef<SVGLineElement>(null);

  const minV = min ?? Math.min(...(values.length ? values : [0]));
  const maxV = max ?? Math.max(...(values.length ? values : [1]));

  const linePath = useMemo(
    () => buildPath(values, minV, maxV, height, stepped),
    [values, minV, maxV, height, stepped]
  );
  const areaPath = useMemo(
    () => (fillColor ? buildAreaPath(linePath, height) : ''),
    [linePath, fillColor, height]
  );

  // Direct DOM update — avoids re-renders every frame
  useEffect(() => {
    const unsub = useDashboardStore.subscribe(
      s => s.frameIndex,
      (fi) => {
        if (!cursorRef.current || values.length === 0) return;
        const x = ((fi / (values.length - 1)) * W).toFixed(2);
        cursorRef.current.setAttribute('x1', x);
        cursorRef.current.setAttribute('x2', x);
      }
    );
    return unsub;
  }, [values.length]);

  if (values.length === 0) return null;

  return (
    <div className={styles.chart}>
      <div className={styles.labelRow}>
        <span className={styles.label}>{label}</span>
        <span className={styles.unit} style={{ color }}>{unit}</span>
      </div>
      <svg
        className={styles.svg}
        viewBox={`0 0 ${W} ${height}`}
        preserveAspectRatio="none"
        style={{ height }}
      >
        {areaPath && (
          <path d={areaPath} fill={fillColor} opacity={0.18} />
        )}
        <path d={linePath} stroke={color} fill="none" strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
        {/* Cursor line */}
        <line
          ref={cursorRef}
          x1="0" y1="0" x2="0" y2={height}
          stroke="#ffffff"
          strokeWidth="1"
          opacity="0.5"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}
