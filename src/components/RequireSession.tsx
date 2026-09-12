import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAppStore } from '../store/AppStore';

export const RequireSession = () => {
  const { state, ready } = useAppStore();
  const location = useLocation();
  if (!ready) return <div className="boot-screen"><div className="proof-orbit proof-orbit--small" /><p>Opening your private vault…</p></div>;
  if (!state.session.connected) return <Navigate to="/" replace state={{ from: location.pathname }} />;
  return <Outlet />;
};
