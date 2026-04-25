import { useState } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent } from 'react-native';
import Svg, { Path, Circle, Line as SvgLine, G } from 'react-native-svg';
import { colors, font } from '../constants/theme';

export interface LineChartPoint {
  x: number | string;
  y: number;
  label?: string;
}

interface Props {
  data: LineChartPoint[];
  height?: number;
  color?: string;
  fill?: boolean;
  yFormat?: (v: number) => string;
  xFormat?: (x: number | string, i: number) => string;
  yTicks?: number;
  xTicks?: number;
  emptyText?: string;
  /** When true, x positions are evenly spaced regardless of x value type. */
  evenSpacing?: boolean;
}

const PADDING = { top: 12, right: 12, bottom: 24, left: 36 };

/**
 * Lightweight SVG line chart. No external charting lib — just react-native-svg.
 * Computes x positions either from numeric values (date/year) or evenly when
 * x values are categorical.
 */
export function LineChart({
  data,
  height = 160,
  color = '#7C3AED',
  fill = true,
  yFormat = v => v.toFixed(0),
  xFormat,
  yTicks = 3,
  xTicks = 4,
  emptyText = 'No data',
  evenSpacing = false,
}: Props) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  if (data.length === 0) {
    return (
      <View style={[s.empty, { height }]}>
        <Text style={{ color: colors.text3, fontSize: font.sm }}>{emptyText}</Text>
      </View>
    );
  }

  const innerW = Math.max(0, width - PADDING.left - PADDING.right);
  const innerH = Math.max(0, height - PADDING.top - PADDING.bottom);

  const ys = data.map(d => d.y);
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);
  const yPad = (yMax - yMin) * 0.1 || Math.max(1, Math.abs(yMax) * 0.1);
  const lo = yMin - yPad;
  const hi = yMax + yPad;
  const yToPx = (y: number) =>
    innerH - ((y - lo) / Math.max(1e-9, hi - lo)) * innerH;

  const numericXs = data.map(d => Number(d.x)).filter(n => !Number.isNaN(n));
  const useNumeric = !evenSpacing && numericXs.length === data.length && numericXs.length > 1;
  const xMin = useNumeric ? Math.min(...numericXs) : 0;
  const xMax = useNumeric ? Math.max(...numericXs) : data.length - 1;
  const xToPx = (i: number) => {
    if (data.length === 1) return innerW / 2;
    if (useNumeric) {
      return ((Number(data[i].x) - xMin) / Math.max(1e-9, xMax - xMin)) * innerW;
    }
    return (i / (data.length - 1)) * innerW;
  };

  const points = data.map((d, i) => ({ x: xToPx(i), y: yToPx(d.y) }));
  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ');
  const fillPath = fill && points.length > 1
    ? `${linePath} L ${points[points.length - 1].x} ${innerH} L ${points[0].x} ${innerH} Z`
    : '';

  // Y axis ticks (rounded between lo/hi)
  const yLabels: { v: number; px: number }[] = [];
  for (let i = 0; i < yTicks; i++) {
    const v = lo + ((hi - lo) * i) / (yTicks - 1);
    yLabels.push({ v, px: yToPx(v) });
  }

  // X axis ticks (sample evenly across data)
  const xLabels: { x: number; label: string }[] = [];
  const stride = Math.max(1, Math.floor((data.length - 1) / Math.max(1, xTicks - 1)));
  for (let i = 0; i < data.length; i += stride) {
    const raw = data[i].label ?? data[i].x;
    const label = xFormat ? xFormat(data[i].x, i) : String(raw);
    xLabels.push({ x: xToPx(i), label });
  }
  if (xLabels.length && xLabels[xLabels.length - 1].x < innerW - 10 && data.length > 1) {
    const last = data.length - 1;
    const raw = data[last].label ?? data[last].x;
    const label = xFormat ? xFormat(data[last].x, last) : String(raw);
    xLabels.push({ x: xToPx(last), label });
  }

  return (
    <View onLayout={onLayout} style={{ width: '100%', height }}>
      {width > 0 && (
        <Svg width={width} height={height}>
          {/* Y-axis tick lines + labels */}
          {yLabels.map((t, i) => (
            <SvgLine
              key={`yg-${i}`}
              x1={PADDING.left}
              x2={width - PADDING.right}
              y1={PADDING.top + t.px}
              y2={PADDING.top + t.px}
              stroke={colors.border}
              strokeDasharray="3 4"
              strokeWidth={1}
            />
          ))}

          <G x={PADDING.left} y={PADDING.top}>
            {/* Fill area */}
            {fillPath ? (
              <Path
                d={fillPath}
                fill={color}
                fillOpacity={0.18}
              />
            ) : null}

            {/* Line */}
            <Path
              d={linePath}
              stroke={color}
              strokeWidth={2}
              fill="none"
            />

            {/* Dots */}
            {points.map((p, i) => (
              <Circle
                key={`pt-${i}`}
                cx={p.x}
                cy={p.y}
                r={3}
                fill={color}
              />
            ))}
          </G>
        </Svg>
      )}

      {/* Y labels overlay */}
      <View pointerEvents="none" style={s.yLabels}>
        {yLabels.map((t, i) => (
          <Text
            key={`yl-${i}`}
            style={[
              s.yLabel,
              { top: PADDING.top + t.px - 6 },
            ]}
            numberOfLines={1}
          >
            {yFormat(t.v)}
          </Text>
        ))}
      </View>

      {/* X labels overlay */}
      <View pointerEvents="none" style={s.xLabels}>
        {xLabels.map((t, i) => (
          <Text
            key={`xl-${i}`}
            style={[
              s.xLabel,
              { left: PADDING.left + t.x - 30, width: 60 },
            ]}
            numberOfLines={1}
          >
            {t.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  empty:   { alignItems: 'center', justifyContent: 'center' },
  yLabels: { position: 'absolute', left: 0, top: 0, bottom: 0, width: PADDING.left - 4 },
  yLabel:  { position: 'absolute', right: 0, fontSize: 9, color: colors.text3, textAlign: 'right' },
  xLabels: { position: 'absolute', left: 0, right: 0, bottom: 4, height: 14 },
  xLabel:  { position: 'absolute', textAlign: 'center', fontSize: 9, color: colors.text3 },
});
