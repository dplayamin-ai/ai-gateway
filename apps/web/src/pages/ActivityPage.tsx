import { adminApi } from '../api';
import { useApi } from '../hooks/useApi';
import { Empty, ErrorState, Loading } from './DashboardPage';

export function ActivityPage(): JSX.Element {
  const result = useApi(adminApi.activities, []);
  if (result.loading) return <Loading />;
  if (result.error) return <ErrorState message={result.error} />;
  return <section className="page"><div className="page-heading"><div><p className="eyebrow">SYSTEM</p><h1>최근 활동</h1><p className="description">관리자 작업과 시스템 변경 이력을 조회합니다.</p></div></div><section className="panel activity-panel"><div className="activity-list">{result.data?.length ? result.data.map((activity, index) => <div className="activity" key={`${activity.created_at}-${index}`}><div className="activity-icon blue">•</div><div><strong>{activity.action}</strong><span>{activity.resource_type} · {activity.actor_name ?? '시스템'} · {new Date(activity.created_at).toLocaleString('ko-KR')}</span></div></div>) : <Empty />}</div></section></section>;
}
