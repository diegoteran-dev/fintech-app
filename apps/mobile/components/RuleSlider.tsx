import { useRef, useState } from 'react';
import { View, Text, StyleSheet, PanResponder, LayoutChangeEvent, findNodeHandle, UIManager } from 'react-native';
import { colors, font } from '../constants/theme';

interface Props {
  needs: number;
  wants: number;
  savings: number;
  colors: { needs: string; wants: string; savings: string };
  labels: { needs: string; wants: string; savings: string };
  onChange: (needs: number, wants: number, savings: number) => void;
}

const MIN_SEG = 5;
const THUMB = 22;

/**
 * Horizontal two-thumb slider that partitions 100% into needs/wants/savings.
 * Dot1 (between needs and wants) moves needs ↔ wants (savings fixed).
 * Dot2 (between wants and savings) moves wants ↔ savings (needs fixed).
 */
export function RuleSlider({ needs, wants, savings, colors: segColors, labels, onChange }: Props) {
  const trackRef = useRef<View>(null);
  const [trackWidth, setTrackWidth] = useState(0);
  const trackX = useRef(0);

  const needsRef = useRef(needs);
  const wantsRef = useRef(wants);
  const savingsRef = useRef(savings);
  needsRef.current = needs;
  wantsRef.current = wants;
  savingsRef.current = savings;

  const pos1 = needs;
  const pos2 = needs + wants;

  const onLayout = (e: LayoutChangeEvent) => {
    setTrackWidth(e.nativeEvent.layout.width);
    const node = findNodeHandle(trackRef.current);
    if (node) UIManager.measure(node, (_x, _y, _w, _h, pageX) => { trackX.current = pageX; });
  };

  const measureOnGrant = () => {
    const node = findNodeHandle(trackRef.current);
    if (node) UIManager.measure(node, (_x, _y, _w, _h, pageX) => { trackX.current = pageX; });
  };

  const pctOf = (pageX: number) => {
    if (trackWidth <= 0) return 0;
    return Math.max(0, Math.min(100, ((pageX - trackX.current) / trackWidth) * 100));
  };

  const pan1 = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: measureOnGrant,
      onPanResponderMove: (_, g) => {
        const pct = pctOf(g.moveX);
        const p2 = needsRef.current + wantsRef.current;
        const newNeeds = Math.max(MIN_SEG, Math.min(p2 - MIN_SEG, Math.round(pct)));
        const newWants = p2 - newNeeds;
        if (newWants >= MIN_SEG) onChange(newNeeds, newWants, savingsRef.current);
      },
    }),
  ).current;

  const pan2 = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: measureOnGrant,
      onPanResponderMove: (_, g) => {
        const pct = pctOf(g.moveX);
        const newPos2 = Math.max(needsRef.current + MIN_SEG, Math.min(95, Math.round(pct)));
        const newWants = newPos2 - needsRef.current;
        const newSavings = 100 - newPos2;
        if (newWants >= MIN_SEG && newSavings >= MIN_SEG) {
          onChange(needsRef.current, newWants, newSavings);
        }
      },
    }),
  ).current;

  return (
    <View>
      <View ref={trackRef} style={s.track} onLayout={onLayout}>
        <View style={s.rail}>
          <View style={[s.seg, { left: 0,                 width: `${pos1}%` as any,    backgroundColor: segColors.needs }]} />
          <View style={[s.seg, { left: `${pos1}%` as any, width: `${wants}%` as any,   backgroundColor: segColors.wants }]} />
          <View style={[s.seg, { left: `${pos2}%` as any, width: `${savings}%` as any, backgroundColor: segColors.savings }]} />
        </View>
        <View
          {...pan1.panHandlers}
          style={[s.thumb, { left: `${pos1}%` as any, marginLeft: -THUMB / 2, borderColor: segColors.needs }]}
        />
        <View
          {...pan2.panHandlers}
          style={[s.thumb, { left: `${pos2}%` as any, marginLeft: -THUMB / 2, borderColor: segColors.savings }]}
        />
      </View>

      <View style={s.labels}>
        <View style={{ width: `${pos1}%` as any }}>
          <Text style={[s.labelName, { color: segColors.needs }]} numberOfLines={1}>{labels.needs}</Text>
          <Text style={[s.labelPct,  { color: segColors.needs }]}>{needs}%</Text>
        </View>
        <View style={{ width: `${wants}%` as any, alignItems: 'center' }}>
          <Text style={[s.labelName, { color: segColors.wants }]} numberOfLines={1}>{labels.wants}</Text>
          <Text style={[s.labelPct,  { color: segColors.wants }]}>{wants}%</Text>
        </View>
        <View style={{ width: `${savings}%` as any, alignItems: 'flex-end' }}>
          <Text style={[s.labelName, { color: segColors.savings }]} numberOfLines={1}>{labels.savings}</Text>
          <Text style={[s.labelPct,  { color: segColors.savings }]}>{savings}%</Text>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  track:     { height: THUMB + 4, justifyContent: 'center', marginTop: 4, marginBottom: 4 },
  rail:      { height: 10, backgroundColor: colors.bg3, borderRadius: 5, overflow: 'hidden' },
  seg:       { position: 'absolute', top: 0, bottom: 0 },
  thumb:     { position: 'absolute', top: '50%', marginTop: -THUMB / 2, width: THUMB, height: THUMB, borderRadius: THUMB / 2, backgroundColor: colors.card, borderWidth: 3 },
  labels:    { flexDirection: 'row', marginTop: 4 },
  labelName: { fontSize: font.sm, fontWeight: '600' },
  labelPct:  { fontSize: 11, fontWeight: '700' },
});
