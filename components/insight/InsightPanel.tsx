'use client';

import BaseInsightPanel from '@/components/InsightPanel';
import type { Palace, Star, ZiweiChart } from '@/lib/ziwei/types';
import type { TimeView } from '@/components/chart/TopBar';

export interface FocusState {
  type: 'palace' | 'star' | 'sihua';
  label: string;
  palace?: Palace;
  star?: Star;
  siHua?: string;
  starName?: string;
}

interface InsightPanelProps {
  chart: ZiweiChart;
  view: TimeView;
  liunianYear: number;
  liuyueMonth: number;
  focus: FocusState | null;
  onClearFocus?: () => void;
}

export default function InsightPanel({ chart, view, focus }: InsightPanelProps) {
  const selectedPalace = focus?.palace ?? null;
  const starName = focus?.starName ?? focus?.star?.name ?? parseStarName(focus?.label ?? '');
  const selectedSiHua = focus?.type === 'sihua' && focus.siHua
    ? { starName, siHua: focus.siHua, view }
    : null;

  return (
    <BaseInsightPanel
      chart={chart}
      selectedPalace={selectedPalace}
      selectedSiHua={selectedSiHua}
    />
  );
}

function parseStarName(label: string): string {
  const [starName] = label.split(' 化');
  return starName?.trim() || '';
}
