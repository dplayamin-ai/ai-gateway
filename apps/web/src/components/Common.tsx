import type { ReactNode } from 'react';

export type LineIconName = 'dashboard' | 'key' | 'model' | 'mcp' | 'history' | 'activity' | 'settings' | 'usage';

export function LineIcon({ name }: { name: LineIconName }): JSX.Element {
  const commonProps = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  switch (name) {
    case 'dashboard':
      return <svg {...commonProps}><path d="M4 11.2 12 4l8 7.2V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" /><path d="M9 20v-6h6v6" /></svg>;
    case 'key':
      return <svg {...commonProps}><circle cx="12" cy="8" r="3.2" /><path d="M7.5 13.5a5.5 5.5 0 0 0 0 7.8l.8-.8m6.7-6.9h2.2v2.2M9.7 16.3 19 19.2l-2.8-9.3" /></svg>;
    case 'model':
      return <svg {...commonProps}><path d="m12 2.8 2.3 4.7 5.2.8-3.8 3.7.9 5.2-4.6-2.4-4.6 2.4.9-5.2-3.8-3.7 5.2-.8z" /></svg>;
    case 'mcp':
      return <svg {...commonProps}><path d="M7 7h10v10H7z" /><path d="M10 10h4v4h-4z" /><path d="M4 12h3M17 12h3M12 4v3M12 17v3" /></svg>;
    case 'history':
      return <svg {...commonProps}><path d="M4 7.5h16" /><path d="M4 12h10" /><path d="M4 16.5h16" /><path d="M16 4.5v6l4 2.5" /></svg>;
    case 'activity':
      return <svg {...commonProps}><path d="M3 15.5h4l2.5-7 3.2 10 2.3-5.5H21" /></svg>;
    case 'settings':
      return <svg {...commonProps}><circle cx="12" cy="12" r="3.2" /><path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a1.8 1.8 0 0 1-2.5 2.5l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V19a1.8 1.8 0 1 1-3.6 0v-.2a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a1.8 1.8 0 0 1-2.5-2.5l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H5a1.8 1.8 0 1 1 0-3.6h.2a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a1.8 1.8 0 1 1 2.5-2.5l.1.1a1 1 0 0 0 1.1.2h.1a1 1 0 0 0 .6-.9V5a1.8 1.8 0 1 1 3.6 0v.2a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a1.8 1.8 0 1 1 2.5 2.5l-.1.1a1 1 0 0 0-.2 1.1v.1a1 1 0 0 0 .9.6H19a1.8 1.8 0 0 1 0 3.6h-.2a1 1 0 0 0-.9.6z" /></svg>;
    case 'usage':
      return <svg {...commonProps}><path d="M5 18V7.5M12 18V4M19 18v-9" /><path d="M3 18h18" /></svg>;
    default:
      return <svg {...commonProps}><path d="M12 5v14M5 12h14" /></svg>;
  }
}

export function Stat({ label, value, trend, note, icon, color }: { label: string; value: string; trend?: string; note?: string; icon: ReactNode; color: string }): JSX.Element { return <article className="stat-card"><span className="stat-label">{label}</span><strong>{value}</strong>{(trend || note) && <small className={trend?.startsWith('↑') ? 'positive' : 'neutral'}>{trend}<em>{note}</em></small>}<div className={`stat-symbol ${color}`}>{icon}</div></article>; }
export function PanelHeader({ title, description, action, onAction }: { title: string; description: string; action?: string; onAction?: () => void }): JSX.Element { return <div className="panel-header"><div><h2>{title}</h2><p>{description}</p></div>{action && <button onClick={onAction} className="text-button">{action}</button>}</div>; }
export function getStatusClass(value: string | null | undefined): string { if (!value) return ''; const raw = String(value).trim().toUpperCase(); if (raw.includes('REJECT') || raw.includes('FAIL') || raw.includes('오류') || raw.includes('점검') || raw.includes('TIMEOUT') || raw.includes('ERROR')) return 'status failure'; if (raw.includes('PENDING') || raw.includes('대기') || raw.includes('WAIT') || raw.includes('확인') || raw.includes('INACTIVE') || raw.includes('휴면')) return 'status warning'; if (raw.includes('APPROV') || raw.includes('ACTIVE') || raw.includes('SUCCESS') || raw.includes('정상') || raw.includes('성공') || raw.includes('완료') || raw.includes('ONLINE') || raw.includes('READY')) return 'status success'; return ''; }
