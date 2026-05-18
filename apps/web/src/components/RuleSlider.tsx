import { useRef, useState, useEffect } from 'react';

interface Props {
  needs: number;
  wants: number;
  savings: number;
  colors: { needs: string; wants: string; savings: string };
  labels: { needs: string; wants: string; savings: string };
  onChange: (needs: number, wants: number, savings: number) => void;
}

export default function RuleSlider({ needs, wants, savings, colors, labels, onChange }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [vertical, setVertical] = useState(() => window.innerWidth <= 768);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const handler = (e: MediaQueryListEvent) => setVertical(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // dot1 sits at needs%, dot2 sits at (needs+wants)%
  const pos1 = needs;
  const pos2 = needs + wants;

  const getPct = (e: React.PointerEvent): number => {
    if (!trackRef.current) return 0;
    const rect = trackRef.current.getBoundingClientRect();
    const raw = vertical
      ? (e.clientY - rect.top) / rect.height
      : (e.clientX - rect.left) / rect.width;
    return Math.max(0, Math.min(100, raw * 100));
  };

  const updateDot1 = (pct: number) => {
    // dot1 moves: Needs ↕, Wants inverse, Savings fixed
    const newNeeds = Math.max(5, Math.min(pos2 - 5, Math.round(pct)));
    const newWants = pos2 - newNeeds;
    if (newWants >= 5) onChange(newNeeds, newWants, savings);
  };

  const updateDot2 = (pct: number) => {
    // dot2 moves: Wants ↕, Savings inverse, Needs fixed
    const newPos2 = Math.max(pos1 + 5, Math.min(95, Math.round(pct)));
    const newWants = newPos2 - pos1;
    const newSavings = 100 - newPos2;
    if (newWants >= 5 && newSavings >= 5) onChange(needs, newWants, newSavings);
  };

  const dotHandlers = (updater: (p: number) => void) => ({
    onPointerDown(e: React.PointerEvent) {
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    onPointerMove(e: React.PointerEvent) {
      if (e.buttons === 0) return;
      updater(getPct(e));
    },
  });

  if (vertical) {
    return (
      <div className="rs-v-wrap">
        {/* Track: ref div — dots and rail both positioned relative to this */}
        <div ref={trackRef} className="rs-v-track">
          {/* Rail with overflow:hidden to clip colored segments */}
          <div className="rs-v-rail">
            <div className="rs-seg-v" style={{ top: 0,       height: `${pos1}%`,  background: colors.needs   }} />
            <div className="rs-seg-v" style={{ top: `${pos1}%`, height: `${wants}%`, background: colors.wants   }} />
            <div className="rs-seg-v" style={{ top: `${pos2}%`, height: `${savings}%`, background: colors.savings }} />
          </div>
          {/* Dots outside the rail */}
          <div className="rs-dot-v" style={{ top: `${pos1}%`,  borderColor: colors.needs   }} {...dotHandlers(updateDot1)} />
          <div className="rs-dot-v" style={{ top: `${pos2}%`,  borderColor: colors.savings }} {...dotHandlers(updateDot2)} />
        </div>

        {/* Labels to the right of the track, height-aligned to each segment */}
        <div className="rs-v-labels">
          <div className="rs-v-seg-label" style={{ height: `${pos1}%` }}>
            <span className="rs-label-name" style={{ color: colors.needs }}>{labels.needs}</span>
            <span className="rs-label-pct"  style={{ color: colors.needs }}>{needs}%</span>
          </div>
          <div className="rs-v-seg-label" style={{ height: `${wants}%` }}>
            <span className="rs-label-name" style={{ color: colors.wants }}>{labels.wants}</span>
            <span className="rs-label-pct"  style={{ color: colors.wants }}>{wants}%</span>
          </div>
          <div className="rs-v-seg-label" style={{ height: `${savings}%` }}>
            <span className="rs-label-name" style={{ color: colors.savings }}>{labels.savings}</span>
            <span className="rs-label-pct"  style={{ color: colors.savings }}>{savings}%</span>
          </div>
        </div>
      </div>
    );
  }

  // Horizontal
  return (
    <div>
      {/* Track: ref div — dots and rail both positioned relative to this */}
      <div ref={trackRef} className="rs-h-track">
        {/* Rail with overflow:hidden to clip colored segments */}
        <div className="rs-h-rail">
          <div className="rs-seg-h" style={{ left: 0,         width: `${pos1}%`,    background: colors.needs   }} />
          <div className="rs-seg-h" style={{ left: `${pos1}%`, width: `${wants}%`,   background: colors.wants   }} />
          <div className="rs-seg-h" style={{ left: `${pos2}%`, width: `${savings}%`, background: colors.savings }} />
        </div>
        {/* Dots outside the rail */}
        <div className="rs-dot-h" style={{ left: `${pos1}%`, borderColor: colors.needs   }} {...dotHandlers(updateDot1)} />
        <div className="rs-dot-h" style={{ left: `${pos2}%`, borderColor: colors.savings }} {...dotHandlers(updateDot2)} />
      </div>

      {/* Labels below, width-aligned to each segment */}
      <div className="rs-h-labels">
        <div className="rs-h-seg-label" style={{ width: `${pos1}%` }}>
          <span className="rs-label-name" style={{ color: colors.needs }}>{labels.needs}</span>
          <span className="rs-label-pct"  style={{ color: colors.needs }}>{needs}%</span>
        </div>
        <div className="rs-h-seg-label" style={{ width: `${wants}%` }}>
          <span className="rs-label-name" style={{ color: colors.wants }}>{labels.wants}</span>
          <span className="rs-label-pct"  style={{ color: colors.wants }}>{wants}%</span>
        </div>
        <div className="rs-h-seg-label" style={{ width: `${savings}%` }}>
          <span className="rs-label-name" style={{ color: colors.savings }}>{labels.savings}</span>
          <span className="rs-label-pct"  style={{ color: colors.savings }}>{savings}%</span>
        </div>
      </div>
    </div>
  );
}
