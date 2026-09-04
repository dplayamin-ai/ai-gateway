import { useEffect, useState } from 'react';
import { adminApi } from '../api';
import { useApi } from '../hooks/useApi';
import { ErrorState, Loading } from './DashboardPage';

export function SettingsPage({ onSave }: { onSave: (message: string) => void }): JSX.Element {
  const result = useApi(adminApi.settings, []);
  const [values, setValues] = useState<Record<string, string>>({});
  useEffect(() => { if (result.data) setValues(result.data); }, [result.data]);
  if (result.loading) return <Loading />;
  if (result.error) return <ErrorState message={result.error} />;
  const update = (key: string, value: string) => setValues((current) => ({ ...current, [key]: value }));
  return <section className="page"><div className="page-heading"><div><p className="eyebrow">SYSTEM</p><h1>시스템 설정</h1><p className="description">Gateway 운영에 필요한 기본 설정만 관리합니다.</p></div><button className="primary-button" onClick={() => adminApi.updateSettings(values).then(() => onSave('시스템 설정이 저장되었습니다.'))}>변경사항 저장</button></div><div className="settings-grid"><section className="panel setting-card"><div className="setting-card__header"><div><h2>Gateway 기본 설정</h2><p>운영 환경에서 사용되는 기본 리소스 값을 제어합니다.</p></div></div><div className="setting-list"><Setting label="기본 Timeout" value={values.default_timeout_seconds ?? ''} onChange={(value) => update('default_timeout_seconds', value)} /><Setting label="로그 보존 기간" value={values.log_retention_days ?? ''} onChange={(value) => update('log_retention_days', value)} /></div></section></div></section>;
}
function Setting({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }): JSX.Element { return <label className="setting-row"><span>{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} /></label>; }
