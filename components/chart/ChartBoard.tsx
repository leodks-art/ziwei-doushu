'use client';

import BaseChartBoard from '@/components/ChartBoard';
import type { Palace, Star, ZiweiChart } from '@/lib/ziwei/types';
import type { TimeView } from './TopBar';

interface ChartBoardProps {
  chart: ZiweiChart;
  view?: TimeView;
  liunianYear?: number;
  onStarClick?: (star: Star, palace: Palace) => void;
  onPalaceClick?: (palace: Palace) => void;
  onSiHuaBadgeClick?: (starName: string, siHua: string) => void;
  onTimeViewChange?: (view: TimeView) => void;
}

export default function ChartBoard({
  chart,
  onStarClick,
  onPalaceClick,
  onSiHuaBadgeClick,
}: ChartBoardProps) {
  return (
    <BaseChartBoard
      chart={chart}
      onStarSelect={onStarClick}
      onPalaceSelect={onPalaceClick}
      onSiHuaClick={(starName, siHua) => onSiHuaBadgeClick?.(starName, siHua)}
    />
  );
}
