import { useState, type FormEvent } from 'react';
import { adminApi } from '../api';
import { useApi } from '../hooks/useApi';
import type { InformationSystem, Menu } from '../types';
import { LineIcon, Stat } from '../components/Common';

export function DashboardPage({ navigate, onAction, refreshKey, onSubmitted }: { navigate: (menu: Menu) => void; onAction: (message: string) => void; refreshKey: number; onSubmitted: () => void }): JSX.Element {
  const systems = useApi(adminApi.informationSystems, []);
  const [informationSystemId, setInformationSystemId] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [tenantQuery, setTenantQuery] = useState('');
  const [tenantPage, setTenantPage] = useState(1);
  const pageSize = 10;
  const dashboard = useApi(() => adminApi.dashboard(informationSystemId, tenantId), [refreshKey, informationSystemId, tenantId]);
  const [requestModal, setRequestModal] = useState(false);
  if (dashboard.loading) return <Loading />;
  if (dashboard.error || !dashboard.data) return <ErrorState message={dashboard.error} />;
  const selectedSystem = systems.data?.find((system) => system.id === informationSystemId);
  const tenants = selectedSystem?.tenants ?? [];
  const filteredTenantStats = dashboard.data.tenantStats.filter((row) => row.tenant_name.toLowerCase().includes(tenantQuery.toLowerCase()) || row.provider_name.toLowerCase().includes(tenantQuery.toLowerCase()));
  const totalTenantPages = Math.max(1, Math.ceil(filteredTenantStats.length / pageSize));
  const currentTenantPage = Math.min(tenantPage, totalTenantPages);
  const visibleTenantStats = filteredTenantStats.slice((currentTenantPage - 1) * pageSize, currentTenantPage * pageSize);
  return <section className="page dashboard-page"><div className="hero-panel"><div className="hero-copy"><p className="eyebrow">인공지능 공통기반</p><h1>AI Gateway 관리자 콘솔</h1><p className="description">보안 정책, 모델 접근권한, MCP 연결과 사용량을 한 화면에서 관리합니다.</p><div className="chip-row"><span className="chip">실시간 운영</span><span className="chip">멀티 테넌트</span><span className="chip">MCP / API</span></div></div><div className="hero-visual"><div className="hero-orb" /><div className="hero-metric"><strong>{dashboard.data.todayUsage}</strong><span>Today calls</span></div></div></div><div className="page-heading"><div><p className="eyebrow">OVERVIEW</p><h1>안녕하세요, 관리자님</h1><p className="description">정보시스템과 테넌트 범위별 주요 현황을 조회합니다.</p></div><button onClick={() => setRequestModal(true)} className="primary-button">+ 인증키 신청</button></div><section className="panel dashboard-filters"><div className="dashboard-filter-fields"><label className="form-field"><span>정보시스템</span><select value={informationSystemId} onChange={(event) => { setInformationSystemId(event.target.value); setTenantId(''); setTenantQuery(''); setTenantPage(1); }}><option value="">전체 정보시스템</option>{(systems.data ?? []).map((system) => <option key={system.id} value={system.id}>{system.name}</option>)}</select></label><label className="form-field"><span>테넌트</span><select value={tenantId} disabled={!informationSystemId} onChange={(event) => setTenantId(event.target.value)}><option value="">전체 테넌트</option>{tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.name}</option>)}</select></label></div></section><div className="stats dashboard-stats"><Stat label="활성 인증키" value={String(dashboard.data.activeKeys)} icon={<LineIcon name="key" />} color="key" /><Stat label="등록된 AI Model" value={String(dashboard.data.activeModels)} icon={<LineIcon name="model" />} color="model" /><Stat label="연결된 MCP" value={String(dashboard.data.activeMcps)} icon={<LineIcon name="mcp" />} color="mcp" /><Stat label="API 호출" value={String(dashboard.data.todayUsage)} icon={<LineIcon name="usage" />} color="usage" /></div><section className="panel table-panel dashboard-table"><div className="table-toolbar"><div className="result-count">테넌트 목록</div><label className="search table-search"><span>⌕</span><input value={tenantQuery} onChange={(event) => { setTenantQuery(event.target.value); setTenantPage(1); }} placeholder="테넌트/Provider 검색" /></label></div><table><thead><tr><th>테넌트</th><th>Provider</th><th>활성 인증키</th><th>제공 모델</th><th>API 호출</th></tr></thead><tbody>{visibleTenantStats.length ? visibleTenantStats.map((row) => <tr key={row.tenant_id}><td>{row.tenant_name}</td><td>{row.provider_name}</td><td>{row.api_key_count}</td><td>{row.model_count}</td><td>{row.api_call_count}</td></tr>) : <tr><td colSpan={5}><Empty /></td></tr>}</tbody></table>{totalTenantPages > 1 && <div className="pagination"><button type="button" className="page-button" disabled={currentTenantPage === 1} onClick={() => setTenantPage((value) => Math.max(1, value - 1))}>이전</button><span className="page-indicator">{currentTenantPage} / {totalTenantPages}</span><button type="button" className="page-button" disabled={currentTenantPage === totalTenantPages} onClick={() => setTenantPage((value) => Math.min(totalTenantPages, value + 1))}>다음</button></div>}</section>{requestModal && <ApiKeyRequestModal systems={systems.data ?? []} onClose={() => setRequestModal(false)} onCreated={() => { setRequestModal(false); onSubmitted(); onAction('인증키 신청이 접수되었습니다.'); }} />}</section>;
}

function ApiKeyRequestModal({ systems, onClose, onCreated }: { systems: InformationSystem[]; onClose: () => void; onCreated: () => void }): JSX.Element {
  const [applicantName] = useState('관리자');
  const [applicantEmail] = useState('admin@ai-gateway.local');
  const [informationSystemId, setInformationSystemId] = useState(systems[0]?.id ?? '');
  const selectedSystem = systems.find((system) => system.id === informationSystemId);
  const availableModels = (selectedSystem?.tenants ?? []).flatMap((tenant) => (tenant.models ?? []).map((model) => ({
    ...model,
    tenantId: tenant.id,
    tenantName: tenant.name,
    providerName: tenant.provider?.name ?? 'Provider 미지정',
  })));
  const [selectedModels, setSelectedModels] = useState<Array<{ tenantId: string; modelId: string }>>([]);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setSaving(true); setError('');
    try { await adminApi.createApiKeyRequest({ applicantName, applicantEmail, informationSystemId, tenantId: '', modelIds: selectedModels.map((model) => model.modelId), reason }); onCreated(); }
    catch (reasonValue) { setError(reasonValue instanceof Error ? reasonValue.message : '신청에 실패했습니다.'); }
    finally { setSaving(false); }
  };
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><form className="modal" onSubmit={submit}><div className="modal-header"><div><p className="eyebrow">ACCESS CONTROL</p><h2>인증키 신청</h2><p>여러 Provider의 Model Alias를 선택하면 하나의 인증키로 모두 사용할 수 있습니다.</p></div><button type="button" className="modal-close" onClick={onClose}>×</button></div><label className="form-field"><span>신청자명</span><input value={applicantName} readOnly /></label><label className="form-field"><span>이메일</span><input type="email" value={applicantEmail} readOnly /></label><label className="form-field"><span>정보시스템 <b>*</b></span><select required value={informationSystemId} onChange={(event) => { setInformationSystemId(event.target.value); setSelectedModels([]); }}><option value="" disabled>정보시스템 선택</option>{systems.map((system) => <option key={system.id} value={system.id}>{system.name}</option>)}</select></label><fieldset className="model-choice"><legend>Model Alias <b>*</b></legend>{availableModels.map((model) => { const selected = selectedModels.some((item) => item.tenantId === model.tenantId && item.modelId === model.id); return <label className="model-option" key={`${model.tenantId}:${model.id}`}><input type="checkbox" checked={selected} onChange={() => setSelectedModels((current) => selected ? current.filter((item) => item.modelId !== model.id || item.tenantId !== model.tenantId) : [...current, { tenantId: model.tenantId, modelId: model.id }])} /><span><strong>{model.alias}</strong><small>{model.providerName} · {model.tenantName} · 연결 Model: {model.provider_model}</small></span></label>; })}</fieldset><label className="form-field"><span>신청 사유</span><textarea className="request-reason" value={reason} onChange={(event) => setReason(event.target.value)} rows={4} /></label>{systems.length === 0 && <p className="form-error">신청 가능한 정보시스템이 없습니다.</p>}{availableModels.length === 0 && systems.length > 0 && <p className="form-error">신청 가능한 Provider Model Alias가 없습니다.</p>}{error && <p className="form-error">{error}</p>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>취소</button><button className="primary-button" disabled={saving || systems.length === 0 || selectedModels.length === 0}>{saving ? '신청 중...' : '신청하기'}</button></div></form></div>;
}

export function Loading(): JSX.Element { return <div className="state-message">데이터를 불러오는 중입니다...</div>; }
export function Empty(): JSX.Element { return <div className="state-message">등록된 데이터가 없습니다.</div>; }
export function ErrorState({ message }: { message: string | null }): JSX.Element { return <div className="page"><div className="error-state">API 연결 실패: {message ?? '알 수 없는 오류'}</div></div>; }
