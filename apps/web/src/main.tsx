import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Layout } from './components/Layout';
import { DashboardPage } from './pages/DashboardPage';
import { ResourcePage } from './pages/ResourcePage';
import { SettingsPage } from './pages/SettingsPage';
import { ActivityPage } from './pages/ActivityPage';
import { useApi } from './hooks/useApi';
import { adminApi } from './api';
import type { Menu } from './types';
import './styles.css';

function App(): JSX.Element {
  const [activeMenu, setActiveMenu] = useState<Menu>('대시보드');
  const [toast, setToast] = useState('');
  const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0);
  const dashboard = useApi(() => adminApi.dashboard(), [dashboardRefreshKey]);
  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2500); };
  const content = activeMenu === '대시보드' ? <DashboardPage navigate={setActiveMenu} onAction={notify} refreshKey={dashboardRefreshKey} onSubmitted={() => setDashboardRefreshKey((key) => key + 1)} /> : activeMenu === '시스템 설정' ? <SettingsPage onSave={notify} /> : activeMenu === '최근 활동' ? <ActivityPage /> : <ResourcePage menu={activeMenu} onAction={notify} />;
  return <Layout activeMenu={activeMenu} onNavigate={setActiveMenu} pendingKeyRequests={dashboard.data?.pendingKeyRequests ?? 0}>{content}{toast && <div className="toast"><span>✓</span>{toast}</div>}</Layout>;
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
