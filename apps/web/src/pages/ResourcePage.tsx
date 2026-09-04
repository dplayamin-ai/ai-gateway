import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { adminApi } from '../api';
import { useApi } from '../hooks/useApi';
import { Empty, ErrorState, Loading } from './DashboardPage';
import { getStatusClass } from '../components/Common';
import type { ApiKeyRequest, McpRecord, ModelRecord, Menu, UsageLog } from '../types';
import type { Provider } from '../types';

type RecordType = ApiKeyRequest | ModelRecord | McpRecord | UsageLog;
type ResourceMenu = Exclude<Menu, '대시보드' | '시스템 설정' | '최근 활동'>;
const configs: Record<ResourceMenu, { eyebrow: string; title: string; description: string; action: string; columns: string[]; load: () => Promise<RecordType[]>; map: (row: RecordType) => string[] }> = {
  '인증키 신청 관리': { eyebrow: 'ACCESS CONTROL', title: '인증키 신청 관리', description: '신청 권한을 검토하고 인증키를 발급합니다.', action: '', columns: ['신청자', '정보시스템', '테넌트 / Provider', 'Model Alias', '상태', '신청일시'], load: adminApi.apiKeyRequests, map: (row: RecordType) => { const item = row as ApiKeyRequest; return [item.applicant_name, item.system_name, `${item.tenant_names ?? '-'} / ${item.provider_names ?? '-'}`, item.model_aliases ?? '-', item.status, item.created_at]; } },
  'AI Model 관리': { eyebrow: 'MODEL REGISTRY', title: 'AI Model 관리', description: 'Model Provider와 Alias를 관리합니다.', action: '+ AI Model 등록', columns: ['Alias', 'Provider', '실제 Model', '상태'], load: adminApi.models, map: (row: RecordType) => { const item = row as ModelRecord; return [item.alias, item.provider, item.provider_model, item.status]; } },
  'MCP 관리': { eyebrow: 'MCP REGISTRY', title: 'MCP 관리', description: 'MCP 서버를 관리하고 연결 상태를 확인합니다.', action: '+ MCP 등록', columns: ['MCP Code', 'MCP 이름', 'Endpoint'], load: adminApi.mcps, map: (row: RecordType) => { const item = row as McpRecord; return [item.code ?? '-', item.name, item.endpoint]; } },
  'API 사용이력': { eyebrow: 'OBSERVABILITY', title: 'API 사용이력', description: '성공·실패를 포함한 모든 API 호출 이력을 조회합니다.', action: '↓ 이력 다운로드', columns: ['호출 시간', '자원', '응답시간', '결과', '오류코드'], load: adminApi.usageLogs, map: (row: RecordType) => { const item = row as UsageLog; return [new Date(item.requested_at).toLocaleString('ko-KR'), item.resource_name, item.latency_ms === null ? '-' : `${item.latency_ms}ms`, item.status, item.error_code ?? '-']; } },
};

export function ResourcePage({ menu, onAction }: { menu: ResourceMenu; onAction: (message: string) => void }): JSX.Element {
  const config = configs[menu];
  const [refreshKey, setRefreshKey] = useState(0);
  const [modalModel, setModalModel] = useState<ModelRecord | null | undefined>(undefined);
  const [modalMcp, setModalMcp] = useState<McpRecord | null | undefined>(undefined);
  const [mcpCheck, setMcpCheck] = useState<{ code: string; phase: string; tools?: Array<Record<string, unknown>>; error?: string }>();
  const [reviewRequest, setReviewRequest] = useState<ApiKeyRequest | undefined>(undefined);
  const [issuedToken, setIssuedToken] = useState<string | undefined>(undefined);
  const [openRowId, setOpenRowId] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const [errorLog, setErrorLog] = useState<UsageLog | undefined>();
  const load = () => menu === 'API 사용이력' ? adminApi.usageLogs(fromDate, toDate) : config.load();
  const result = useApi(load, [menu, refreshKey, fromDate, toDate]);
  const providers = useApi(adminApi.providers, []);
  const [query, setQuery] = useState('');
  useEffect(() => {
    setQuery('');
    setFromDate('');
    setToDate('');
    setPage(1);
    setOpenRowId(null);
    setModalModel(undefined);
    setModalMcp(undefined);
  }, [menu]);
  useEffect(() => {
    setPage(1);
  }, [query, fromDate, toDate]);
  const filteredRecords = useMemo(() => (result.data ?? []).filter((record) => config.map(record).join(' ').toLowerCase().includes(query.toLowerCase())), [result.data, config, query]);
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visibleRecords = useMemo(() => filteredRecords.slice((currentPage - 1) * pageSize, currentPage * pageSize), [filteredRecords, currentPage]);
  const rows = useMemo(() => visibleRecords.map(config.map), [visibleRecords, config]);
  if (result.loading) return <Loading />;
  if (result.error) return <ErrorState message={result.error} />;
  const downloadLogs = () => {
    const csv = [config.columns, ...rows].map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
    link.download = `usage-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };
  const checkMcp = async (id: string) => {
    const mcp = (result.data ?? []).find((item) => item.id === id) as McpRecord | undefined;
    const code = mcp?.code ?? 'MCP';
    setOpenRowId(null);
    setMcpCheck({ code, phase: '연결 확인 요청을 준비하고 있습니다.' });
    try {
      setMcpCheck({ code, phase: 'MCP endpoint에 연결하고 있습니다.' });
      const response = await adminApi.checkMcp(id);
      setMcpCheck({ code, phase: 'initialize 및 세션 협상을 완료했습니다.' });
      await new Promise((resolve) => window.setTimeout(resolve, 350));
      const tools = response.response?.result?.tools ?? response.tools ?? [];
      setMcpCheck({ code, phase: 'tools/list 결과를 확인했습니다.', tools });
    } catch (reason) {
      setMcpCheck({ code, phase: '연결 확인에 실패했습니다.', error: reason instanceof Error ? reason.message : 'MCP 연결에 실패했습니다.' });
    }
  };
  return <section className="page"><div className="page-heading"><div><p className="eyebrow">{config.eyebrow}</p><h1>{config.title}</h1><p className="description">{config.description}</p></div>{config.action && <button onClick={() => menu === 'API 사용이력' ? downloadLogs() : menu === 'AI Model 관리' ? setModalModel(null) : menu === 'MCP 관리' ? setModalMcp(null) : onAction(`${config.title} 작업은 API 연결 후 활성화됩니다.`)} className="primary-button">{config.action}</button>}</div>{menu === 'API 사용이력' && <div className="log-filters"><label>시작일<input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></label><label>종료일<input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></label></div>}      <ResourceTable showRowMenu={menu !== 'API 사용이력'} onCheckMcp={checkMcp} onErrorLog={(log) => setErrorLog(log)} menu={menu} columns={config.columns} rows={rows} records={visibleRecords} openRowId={openRowId} onToggleRow={setOpenRowId} onEditModel={(model) => setModalModel(model)} onEditMcp={(mcp) => setModalMcp(mcp)} onReviewRequest={(request) => setReviewRequest(request)} onDeleteRequest={(id) => adminApi.deleteApiKeyRequest(id).then(() => { setOpenRowId(null); setRefreshKey((key) => key + 1); onAction('인증키 신청이 삭제되었습니다.'); }).catch((reason: unknown) => onAction(reason instanceof Error ? reason.message : '삭제에 실패했습니다.'))} onDeleteModel={(id) => adminApi.deleteModel(id).then(() => { setOpenRowId(null); setRefreshKey((key) => key + 1); onAction('AI Model이 삭제되었습니다.'); }).catch((reason: unknown) => onAction(reason instanceof Error ? reason.message : '삭제에 실패했습니다.'))} onDeleteMcp={(id) => adminApi.deleteMcp(id).then(() => { setOpenRowId(null); setRefreshKey((key) => key + 1); onAction('MCP가 삭제되었습니다.'); }).catch((reason: unknown) => onAction(reason instanceof Error ? reason.message : '삭제에 실패했습니다.'))} query={query} onQueryChange={setQuery} />{totalPages > 1 && <div className="pagination"><button type="button" className="page-button" disabled={currentPage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>이전</button><span className="page-indicator">{currentPage} / {totalPages}</span><button type="button" className="page-button" disabled={currentPage === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>다음</button></div>}{reviewRequest && <ApiKeyReviewModal request={reviewRequest} onClose={() => setReviewRequest(undefined)} onReviewed={(token) => { setReviewRequest(undefined); setIssuedToken(token); setRefreshKey((key) => key + 1); onAction('인증키 신청이 처리되었습니다.'); }} />}{issuedToken && <TokenModal token={issuedToken} onClose={() => setIssuedToken(undefined)} />}{menu === 'AI Model 관리' && modalModel !== undefined && modalModel !== null && <ModelModal model={modalModel} providers={providers.data ?? []} onClose={() => setModalModel(undefined)} onCreated={() => { setModalModel(undefined); setRefreshKey((key) => key + 1); onAction('AI Model이 수정되었습니다.'); }} />}{menu === 'AI Model 관리' && modalModel === null && <ModelModal providers={providers.data ?? []} onClose={() => setModalModel(undefined)} onCreated={() => { setModalModel(undefined); setRefreshKey((key) => key + 1); onAction('AI Model이 DB에 등록되었습니다.'); }} />}{menu === 'MCP 관리' && modalMcp !== undefined && <McpModal model={modalMcp ?? undefined} onClose={() => setModalMcp(undefined)} onCreated={() => { setModalMcp(undefined); setRefreshKey((key) => key + 1); onAction(modalMcp ? 'MCP가 수정되었습니다.' : 'MCP가 DB에 등록되었습니다.'); }} />  }{errorLog && <div className="modal-backdrop" onClick={() => setErrorLog(undefined)}><div className="modal" onClick={(event) => event.stopPropagation()}><div className="modal-header"><div><p className="eyebrow">ERROR DETAIL</p><h2>API 오류 이력</h2></div><button className="modal-close" onClick={() => setErrorLog(undefined)}>×</button></div><div className="detail-list"><p><b>호출 시간</b>{new Date(errorLog.requested_at).toLocaleString('ko-KR')}</p><p><b>자원</b>{errorLog.resource_name}</p><p><b>오류 코드</b>{errorLog.error_code ?? '-'}</p><p><b>오류 메시지</b>{String(errorLog.metadata?.errorMessage ?? '-')}</p></div></div></div>}  {mcpCheck && <McpCheckModal check={mcpCheck} onClose={() => setMcpCheck(undefined)} />}</section>;
}

function ResourceTable({ menu, columns, rows, records, showRowMenu, onCheckMcp, onErrorLog, openRowId, onToggleRow, onEditModel, onEditMcp, onReviewRequest, onDeleteRequest, onDeleteModel, onDeleteMcp, query, onQueryChange }: { menu: ResourceMenu; columns: string[]; rows: string[][]; records: RecordType[]; showRowMenu: boolean; onCheckMcp: (id: string) => void; onErrorLog: (log: UsageLog) => void; openRowId: string | null; onToggleRow: (id: string | null) => void; onEditModel: (model: ModelRecord) => void; onEditMcp: (mcp: McpRecord) => void; onReviewRequest: (request: ApiKeyRequest) => void; onDeleteRequest: (id: string) => void; onDeleteModel: (id: string) => void; onDeleteMcp: (id: string) => void; query: string; onQueryChange: (value: string) => void }): JSX.Element {
  return <section className="panel table-panel"><div className="toolbar"><span className="result-count">총 {rows.length}건</span><label className="search">⌕ <input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="검색어를 입력하세요" /></label></div><table><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}{showRowMenu && <th />}</tr></thead><tbody>{rows.map((row, index) => { const record = records[index]; const rowId = record?.id; return   <tr key={rowId ?? index} className={menu === 'API 사용이력' && (record as UsageLog).status === 'FAILURE' ? 'error-log-row' : ''} onClick={() => menu === 'API 사용이력' && (record as UsageLog).status === 'FAILURE' && onErrorLog(record as UsageLog)}>{row.map((cell, cellIndex) =>   <td key={cellIndex} onClick={() => menu === 'API 사용이력' && (record as UsageLog).status === 'FAILURE' && onErrorLog(record as UsageLog)}><span className={menu === 'API 사용이력' && cellIndex === 3 && (record as UsageLog).status === 'FAILURE' ? 'status failure' : getStatusClass(cell)}>{cell}</span></td>)}{showRowMenu && <td className="row-menu-cell"><button className="row-action" onClick={() => onToggleRow(openRowId === rowId ? null : rowId ?? null)}>⋯</button>{openRowId === rowId && rowId && menu === '인증키 신청 관리' && <div className="row-menu">{(record as ApiKeyRequest).status === 'PENDING' && <button onClick={() => onReviewRequest(record as ApiKeyRequest)}>신청 검토</button>}<button className="danger" onClick={() => { if (window.confirm('인증키 신청을 삭제하시겠습니까?')) { onDeleteRequest(rowId); onToggleRow(null); } }}>삭제</button></div>}{openRowId === rowId && rowId && (menu === 'AI Model 관리' || menu === 'MCP 관리') &&   <div className="row-menu">{menu === 'MCP 관리' && <button onClick={() => onCheckMcp(rowId)}>연결 확인</button>}<button onClick={() => menu === 'AI Model 관리' ? onEditModel(record as ModelRecord) : onEditMcp(record as McpRecord)}>수정</button><button className="danger" onClick={() => { if (window.confirm(`${row[0]}을(를) 삭제하시겠습니까?`)) { menu === 'AI Model 관리' ? onDeleteModel(rowId) : onDeleteMcp(rowId); onToggleRow(null); } }}>삭제</button></div>}</td>}</tr>; })}</tbody></table>{rows.length === 0 && <Empty />}</section>;
}

function McpToolsModal({ tools, onClose }: { tools: Array<Record<string, unknown>>; onClose: () => void }): JSX.Element {
  return <div className="modal-backdrop" onClick={onClose}><div className="modal" onClick={(event) => event.stopPropagation()}><div className="modal-header"><div><p className="eyebrow">MCP TOOLS</p><h2>사용 가능한 Tool 목록</h2></div><button className="modal-close" onClick={onClose}>×</button></div>{tools.length === 0 ? <Empty /> : tools.map((tool, index) => <div className="tool-item" key={index}><strong>{String(tool.name ?? `Tool ${index + 1}`)}</strong><span>{String(tool.description ?? '설명 없음')}</span></div>)}</div></div>;
}

function McpCheckModal({ check, onClose }: { check: { code: string; phase: string; tools?: Array<Record<string, unknown>>; error?: string }; onClose: () => void }): JSX.Element {
  const running = !check.tools && !check.error;
  return <div className="modal-backdrop" onClick={() => !running && onClose()}><div className="modal mcp-check-modal" onClick={(event) => event.stopPropagation()}><div className="modal-header"><div><p className="eyebrow">MCP CONNECTION CHECK</p><h2>{check.code} 연결 확인</h2></div>{!running && <button className="modal-close" onClick={onClose}>×</button>}</div><div className="mcp-check-status"><span className={running ? 'check-spinner' : check.error ? 'check-failure' : 'check-success'}>{running ? '…' : check.error ? '!' : '✓'}</span><strong>{check.phase}</strong></div>{running && <p className="check-hint">원격 MCP의 초기화와 Tool 목록 조회를 진행 중입니다. 잠시만 기다려 주세요.</p>}{check.error && <p className="form-error">{check.error}</p>}{check.tools && <><div className="tool-list-heading">확인된 Tool {check.tools.length}개</div>{check.tools.length === 0 ? <Empty /> : check.tools.map((tool, index) => <div className="tool-item" key={index}><strong>{String(tool.name ?? `Tool ${index + 1}`)}</strong><span>{String(tool.description ?? '설명 없음')}</span></div>)}</>} {!running && <div className="modal-actions"><button className="primary-button" onClick={onClose}>확인</button></div>}</div></div>;
}

function ApiKeyReviewModal({ request, onClose, onReviewed }: { request: ApiKeyRequest; onClose: () => void; onReviewed: (token?: string) => void }): JSX.Element {
  const [rejectionReason, setRejectionReason] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const review = async (decision: 'APPROVED' | 'REJECTED') => { setSaving(true); setError(''); try { const result = await adminApi.reviewApiKeyRequest(request.id, decision, rejectionReason); onReviewed(result.token); } catch (reason) { setError(reason instanceof Error ? reason.message : '처리에 실패했습니다.'); } finally { setSaving(false); } };
  return <div className="modal-backdrop"><div className="modal"><div className="modal-header"><div><p className="eyebrow">ACCESS CONTROL</p><h2>인증키 신청 검토</h2><p>{request.applicant_name} · {request.applicant_email ?? '-'}</p></div><button className="modal-close" onClick={onClose}>×</button></div><div className="detail-list"><p><b>신청자</b>{request.applicant_name} ({request.applicant_email ?? '-'})</p><p><b>정보시스템</b>{request.system_name}</p><p><b>테넌트</b>{request.tenant_names ?? '-'}</p><p><b>Provider</b>{request.provider_names ?? '-'}</p><p><b>Model Alias</b>{request.model_aliases ?? '-'}</p><p><b>신청일시</b>{request.created_at}</p><p><b>신청사유</b>{request.reason || '-'}</p></div><label className="form-field"><span>거절 사유</span><textarea value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} rows={3} placeholder="거절 시 사유를 입력하세요." /></label>{error && <p className="form-error">{error}</p>}<div className="modal-actions"><button className="secondary-button" onClick={onClose}>취소</button><button className="secondary-button" disabled={saving} onClick={() => review('REJECTED')}>거절</button><button className="primary-button" disabled={saving} onClick={() => review('APPROVED')}>허용 및 토큰 발급</button></div></div></div>;
}

function TokenModal({ token, onClose }: { token: string; onClose: () => void }): JSX.Element {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');
  const copyToken = async () => {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      setCopyError('');
    } catch {
      setCopied(false);
      setCopyError('클립보드 복사에 실패했습니다.');
    }
  };
  return <div className="modal-backdrop"><div className="modal"><div className="modal-header"><div><p className="eyebrow">ACCESS CONTROL</p><h2>인증키 발급 완료</h2><p>토큰은 다시 표시되지 않을 수 있으니 안전하게 보관하세요.</p></div><button className="modal-close" onClick={onClose}>×</button></div><label className="form-field"><span>발급된 인증키</span><div className="token-copy-field"><input readOnly value={token} /><button type="button" className="secondary-button" onClick={copyToken}>{copied ? '복사 완료' : '클립보드 복사'}</button></div></label>{copyError && <p className="form-error">{copyError}</p>}<div className="modal-actions"><button className="primary-button" onClick={onClose}>확인</button></div></div></div>;
}

function McpModal({ model, onClose, onCreated }: { model?: McpRecord; onClose: () => void; onCreated: () => void }): JSX.Element {
  const [code, setCode] = useState(model?.code ?? '');
  const [name, setName] = useState(model?.name ?? '');
  const [endpoint, setEndpoint] = useState(model?.endpoint ?? '');
  const [bearerToken, setBearerToken] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setSaving(true); setError('');
    try {
      const payload = { code, name, endpoint, bearerToken };
      if (model) await adminApi.updateMcp(model.id, payload); else await adminApi.createMcp(payload);
      onCreated();
    } catch (reason) { setError(reason instanceof Error ? reason.message : '저장에 실패했습니다.'); }
    finally { setSaving(false); }
  };
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><form className="modal" onSubmit={submit}><div className="modal-header"><div><p className="eyebrow">MCP REGISTRY</p><h2>MCP {model ? '수정' : '등록'}</h2><p>MCP 서버 연결 정보를 관리합니다.</p></div><button type="button" className="modal-close" onClick={onClose}>×</button></div><label className="form-field"><span>Code <b>*</b></span><input required value={code} onChange={(event) => setCode(event.target.value)} placeholder="예: COMMON_RAG" /></label><label className="form-field"><span>MCP 이름 <b>*</b></span><input required value={name} onChange={(event) => setName(event.target.value)} placeholder="예: 공통RAG MCP" /></label><label className="form-field"><span>Endpoint <b>*</b></span><input required type="url" value={endpoint} onChange={(event) => setEndpoint(event.target.value)} placeholder="https://mcp.example.com" /></label><label className="form-field"><span>Bearer Token (선택)</span><textarea value={bearerToken} onChange={(event) => setBearerToken(event.target.value)} rows={3} placeholder="Bearer 토큰 값이 필요한 경우 입력하세요." /></label>{error && <p className="form-error">{error}</p>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>취소</button><button className="primary-button" disabled={saving}>{saving ? '저장 중...' : model ? '저장하기' : '등록하기'}</button></div></form></div>;
}

function ModelModal({ model, providers, onClose, onCreated }: { model?: ModelRecord; providers: Provider[]; onClose: () => void; onCreated: () => void }): JSX.Element {
  const [alias, setAlias] = useState(model?.alias ?? '');
  const [providerId, setProviderId] = useState(model?.provider_id ?? providers[0]?.id ?? '');
  const [providerModel, setProviderModel] = useState(model?.provider_model ?? '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (model) await adminApi.updateModel(model.id, { alias, providerId, providerModel });
      else await adminApi.createModel({ alias, providerId, providerModel });
      onCreated();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '등록에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><form className="modal" onSubmit={submit}><div className="modal-header"><div><p className="eyebrow">MODEL REGISTRY</p><h2>AI Model {model ? '수정' : '등록'}</h2><p>Provider와 실제 Model을 Alias에 연결합니다.</p></div><button type="button" className="modal-close" onClick={onClose}>×</button></div><label className="form-field"><span>Model Alias <b>*</b></span><input required value={alias} onChange={(event) => setAlias(event.target.value)} placeholder="예: gpt-4o" /></label><label className="form-field"><span>Provider <b>*</b></span><select required value={providerId} onChange={(event) => setProviderId(event.target.value)}><option value="" disabled>Provider 선택</option>{providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.name} ({provider.code})</option>)}</select></label><label className="form-field"><span>실제 Model <b>*</b></span><input required value={providerModel} onChange={(event) => setProviderModel(event.target.value)} placeholder="예: gpt-4o-2024-08-06" /></label>{error && <p className="form-error">{error}</p>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>취소</button><button className="primary-button" disabled={saving || providers.length === 0}>{saving ? '저장 중...' : model ? '저장하기' : '등록하기'}</button></div></form></div>;
}
