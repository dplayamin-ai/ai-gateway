import { useState, type PropsWithChildren } from 'react';
import { LineIcon, type LineIconName } from './Common';
import type { Menu } from '../types';

export const menus: { label: Menu; icon: LineIconName }[] = [
  { label: '대시보드', icon: 'dashboard' }, { label: '인증키 신청 관리', icon: 'key' },
  { label: 'AI Model 관리', icon: 'model' }, { label: 'MCP 관리', icon: 'mcp' },
  { label: 'API 사용이력', icon: 'history' }, { label: '최근 활동', icon: 'activity' }, { label: '시스템 설정', icon: 'settings' },
];

export function Layout({ activeMenu, onNavigate, pendingKeyRequests, children }: PropsWithChildren<{ activeMenu: Menu; onNavigate: (menu: Menu) => void; pendingKeyRequests: number }>): JSX.Element {
  const [guideOpen, setGuideOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return <div className="app-shell"><aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}><div className="brand"><button className="sidebar-toggle" type="button" aria-label={sidebarCollapsed ? '메뉴 열기' : '메뉴 접기'} onClick={() => setSidebarCollapsed((value) => !value)}>{sidebarCollapsed ? '»' : '«'}</button><div className="brand-text"><strong>정부 인공지능 공통기반</strong><span>AI Gateway</span></div></div><nav className="menu" aria-label="관리자 메뉴"><p className="menu-heading">WORKSPACE</p>{menus.slice(0, 5).map((menu) => <MenuButton key={menu.label} menu={menu} active={activeMenu === menu.label} pendingKeyRequests={pendingKeyRequests} collapsed={sidebarCollapsed} onClick={() => onNavigate(menu.label)} />)}<p className="menu-heading secondary">SYSTEM</p>{menus.slice(5).map((menu) => <MenuButton key={menu.label} menu={menu} active={activeMenu === menu.label} pendingKeyRequests={pendingKeyRequests} collapsed={sidebarCollapsed} onClick={() => onNavigate(menu.label)} />)}</nav><div className="sidebar-footer"><div className="status-dot" /><div><strong>정상 운영 중</strong><span>실시간 모니터링</span></div></div></aside><main className="content"><header className="topbar"><div className="breadcrumb"><span>운영센터</span><b>/</b><strong>{activeMenu}</strong></div><div className="topbar-actions"><button className="guide-button" aria-label="개발자 API 사용가이드" title="개발자 API 사용가이드" onClick={() => setGuideOpen(true)}>개발자 API 사용가이드</button><div className="profile"><div className="avatar">김</div><div><strong>김관리자</strong><span>System Admin</span></div></div></div></header>{children}<footer className="page-footer"><span>© SAMSUNG SDS. All rights reserved.</span></footer></main>{guideOpen && <ApiGuideModal onClose={() => setGuideOpen(false)} />}</div>;
}

function ApiGuideModal({ onClose }: { onClose: () => void }): JSX.Element {
  const [tab, setTab] = useState<'api' | 'mcp'>('api');
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div className="modal api-guide-modal"><div className="modal-header"><div><p className="eyebrow">DEVELOPER GUIDE</p><h2>AI Gateway 사용 가이드</h2><p>발급받은 토큰으로 API와 MCP를 호출하는 방법입니다.</p></div><button className="modal-close" onClick={onClose}>×</button></div><div className="guide-tabs" role="tablist"><button className={tab === 'api' ? 'active' : ''} onClick={() => setTab('api')}>OpenAI API 사용 방법</button><button className={tab === 'mcp' ? 'active' : ''} onClick={() => setTab('mcp')}>MCP 사용 방법</button></div><div className="guide-content">{tab === 'api' ? <ApiGuideContent /> : <McpGuideContent />}</div><div className="modal-actions"><button className="primary-button" onClick={onClose}>확인</button></div></div></div>;
}

function ApiGuideContent(): JSX.Element {
  return <><h3>1. 인증키 발급</h3><p><b>인증키 신청 관리</b>에서 정보시스템과 사용할 Model Alias를 선택해 신청합니다. 관리자 승인 후 토큰 원문이 한 번 표시되므로 안전하게 복사합니다.</p><h3>2. 사용 가능한 모델 확인</h3><p><code>&lt;발급받은 토큰&gt;</code>을 실제 토큰으로 바꾸세요. 응답에 표시된 Alias를 completions의 model 값으로 사용합니다.</p><pre>{`curl.exe "http://localhost:3000/chat/v1/models" -H "Authorization: Bearer <발급받은 토큰>"`}</pre><h3>3. AI Model 호출</h3><pre>{`curl.exe "http://localhost:3000/chat/v1/completions" -H "Authorization: Bearer <발급받은 토큰>" -H "Content-Type: application/json" --data-raw "{\\"model\\":\\"<models 응답의 Alias>\\",\\"messages\\":[{\\"role\\":\\"user\\",\\"content\\":\\"안녕하세요\\"}],\\"stream\\":false}"`}</pre><p>위 명령은 Windows PowerShell에서 그대로 실행할 수 있습니다. 호출 결과와 오류는 <b>API 사용이력</b>에 기록됩니다.</p></>;
}

function McpGuideContent(): JSX.Element {
  return <><h3>1. MCP 준비</h3><p>관리자가 <b>MCP 관리</b>에서 MCP endpoint를 등록하고 연결 확인으로 Tool 목록을 확인합니다. 테스트 Code는 <code>MS_LEARN</code>, <code>AWS_KNOWLEDGE</code>입니다.</p><h3>2. Tool 목록 조회</h3><pre>{`curl.exe "http://localhost:3000/mcp/MS_LEARN" -H "Authorization: Bearer <발급받은 토큰>" -H "Content-Type: application/json" --data-raw "{\\"jsonrpc\\":\\"2.0\\",\\"id\\":1,\\"method\\":\\"tools/list\\",\\"params\\":{}}"`}</pre><h3>3. Tool 호출</h3><p><code>tools/list</code> 응답의 Tool 이름과 inputSchema에 맞춰 method와 arguments를 구성합니다.</p><pre>{`{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"<tool 이름>","arguments":{}}}`}</pre><p>등록되지 않은 Code는 404, 토큰 오류는 401, 원격 MCP 오류는 Gateway 오류로 반환되며 모든 결과는 <b>API 사용이력</b>에 남습니다.</p></>;
}

function MenuButton({ menu, active, pendingKeyRequests, collapsed, onClick }: { menu: { label: Menu; icon: LineIconName }; active: boolean; pendingKeyRequests: number; collapsed: boolean; onClick: () => void }): JSX.Element {
  return <button onClick={onClick} className={`menu-item ${active ? 'active' : ''} ${collapsed ? 'collapsed' : ''}`} title={collapsed ? menu.label : undefined}><span className="menu-icon"><LineIcon name={menu.icon} /></span>{!collapsed && <span>{menu.label}</span>}{menu.label === '인증키 신청 관리' && pendingKeyRequests > 0 && <b className="badge">{pendingKeyRequests}</b>}</button>;
}
