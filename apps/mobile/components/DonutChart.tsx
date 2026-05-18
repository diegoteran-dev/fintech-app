import { useState } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent } from 'react-native';
import Svg, { Path, G, Circle } from 'react-native-svg';
import { colors, font } from '../constants/theme';

export interface DonutSlice {
  key: string;
  value: number;
  color: string;
  label?: string;
}

interface Props {
  data: DonutSlice[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string;
}

function arcPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  // Avoid exact 360° collapsing to a zero-length path
  if (endAngle - startAngle >= Math.PI * 2 - 0.0001) {
    const x1 = cx + r;
    const y1 = cy;
    const x2 = cx - r;
    const y2 = cy;
    return `M ${x1} ${y1} A ${r} ${r} 0 1 1 ${x2} ${y2} A ${r} ${r} 0 1 1 ${x1} ${y1}`;
  }
  const x1 = cx + Math.cos(startAngle) * r;
  const y1 = cy + Math.sin(startAngle) * r;
  const x2 = cx + Math.cos(endAngle) * r;
  const y2 = cy + Math.sin(endAngle) * r;
  const large = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
}

export function DonutChart({
  data,
  size = 180,
  thickness = 22,
  centerLabel,
  centerValue,
}: Props) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const total = data.reduce((s, d) => s + d.value, 0);
  if (total <= 0) {
    return (
      <View style={[s.empty, { height: size }]}>
        <Text style={{ color: colors.text3, fontSize: font.sm }}>No data</Text>
      </View>
    );
  }

  const cx = size / 2;
  const cy = size / 2;
  const r  = size / 2 - thickness / 2;

  let acc = -Math.PI / 2;
  const arcs = data.map(d => {
    const angle = (d.value / total) * Math.PI * 2;
    const start = acc;
    const end   = acc + angle;
    acc = end;
    return { ...d, start, end };
  });

  return (
    <View onLayout={onLayout} style={{ width: '100%', alignItems: 'center' }}>
      <Svg width={size} height={size}>
        {/* Background ring (so 100% single-slice still shows nicely) */}
        <Circle cx={cx} cy={cy} r={r} stroke={colors.bg3} strokeWidth={thickness} fill="none" />
        <G>
          {arcs.map(a => (
            <Path
              key={a.key}
              d={arcPath(cx, cy, r, a.start, a.end)}
              stroke={a.color}
              strokeWidth={thickness}
              strokeLinecap="butt"
              fill="none"
            />
          ))}
        </G>
      </Svg>
      {(centerLabel || centerValue) && (
        <View pointerEvents="none" style={[s.center, { width: size, height: size, marginTop: -size }]}>
          {centerValue ? <Text style={s.centerValue}>{centerValue}</Text> : null}
          {centerLabel ? <Text style={s.centerLabel}>{centerLabel}</Text> : null}
        </View>
      )}
      {/* keep width var read so RN doesn't tree-shake the layout listener */}
      <View style={{ width }} />
    </View>
  );
}

const s = StyleSheet.create({
  empty:       { alignItems: 'center', justifyContent: 'center' },
  center:      { alignItems: 'center', justifyContent: 'center' },
  centerValue: { color: colors.text, fontSize: font.md, fontWeight: '800' },
  centerLabel: { color: colors.text3, fontSize: 10, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.6 },
});
