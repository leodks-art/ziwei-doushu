'use client';

import type { ZiweiChart } from '@/lib/ziwei/types';
import { STEMS } from '@/lib/ziwei/constants';

export type TimeView = 'mingpan' | 'daxian' | 'liunian';

interface TopBarProps {
  chart: ZiweiChart;
  view: TimeView;
  liunianYear: number;
  liuyueMonth: number;
  onViewChange: (view: TimeView) => void;
  onYearChange: (year: number) => void;
  onMonthChange: (month: number) => void;
  onShare?: () => void;
  onExport?: () => void;
  copied?: boolean;
}

export default function TopBar({
  chart,
  view,
  liunianYear,
  liuyueMonth,
  onViewChange,
  onYearChange,
  onMonthChange,
  onShare,
  onExport,
  copied,
}: TopBarProps) {
  const currentDx = chart.daXians[chart.currentDaXianIndex];
  const yearStem = STEMS[((liunianYear - 4) % 10 + 10) % 10] ?? '';

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 40,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '10px 18px',
        background: 'color-mix(in srgb, var(--bg-0) 92%, transparent)',
        borderBottom: '1px solid var(--bdr)',
        backdropFilter: 'blur(18px)',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '11px', color: 'var(--tx-3)', letterSpacing: '0.18em' }}>
          紫微斗数命盘
        </div>
        <div style={{ fontSize: '13px', color: 'var(--tx-0)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {chart.birthInfo.name ? `${chart.birthInfo.name} · ` : ''}
          {chart.wuxingJuName}
          {currentDx ? ` · 当前大限 ${currentDx.startAge}-${currentDx.endAge}岁` : ''}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <Segment active={view === 'mingpan'} onClick={() => onViewChange('mingpan')}>本命</Segment>
        <Segment active={view === 'daxian'} onClick={() => onViewChange('daxian')}>大限</Segment>
        <Segment active={view === 'liunian'} onClick={() => onViewChange('liunian')}>流年</Segment>
        <button
          type="button"
          onClick={() => { onYearChange(liunianYear - 1); onViewChange('liunian'); }}
          style={iconButtonStyle}
          aria-label="上一流年"
        >
          ‹
        </button>
        <button
          type="button"
          onClick={() => onViewChange('liunian')}
          style={{ ...chipStyle, minWidth: '74px' }}
          title={`${liunianYear}${yearStem ? ` · ${yearStem}年` : ''}`}
        >
          {liunianYear}
        </button>
        <button
          type="button"
          onClick={() => { onYearChange(liunianYear + 1); onViewChange('liunian'); }}
          style={iconButtonStyle}
          aria-label="下一流年"
        >
          ›
        </button>
        <button
          type="button"
          onClick={() => { onMonthChange(liuyueMonth === 12 ? 1 : liuyueMonth + 1); onViewChange('liunian'); }}
          style={chipStyle}
          title="流月记录"
        >
          {liuyueMonth}月
        </button>
        {onExport && (
          <button type="button" onClick={onExport} style={chipStyle}>
            导出
          </button>
        )}
        {onShare && (
          <button type="button" onClick={onShare} style={chipStyle}>
            {copied ? '已复制' : '分享'}
          </button>
        )}
      </div>
    </div>
  );
}

function Segment({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...chipStyle,
        color: active ? 'var(--ac)' : 'var(--tx-3)',
        borderColor: active ? 'var(--ac-bdr)' : 'var(--bdr)',
        background: active ? 'rgba(184,146,42,0.10)' : 'transparent',
      }}
    >
      {children}
    </button>
  );
}

const chipStyle: React.CSSProperties = {
  border: '1px solid var(--bdr)',
  borderRadius: '999px',
  background: 'transparent',
  color: 'var(--tx-2)',
  fontSize: '11px',
  padding: '5px 10px',
  cursor: 'pointer',
  lineHeight: 1.2,
};

const iconButtonStyle: React.CSSProperties = {
  ...chipStyle,
  width: '28px',
  height: '28px',
  padding: 0,
  fontSize: '16px',
};
