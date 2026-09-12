import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { Logo } from './components/Logo';
import { RequireSession } from './components/RequireSession';

const LandingPage = lazy(() => import('./pages/LandingPage').then((module) => ({ default: module.LandingPage })));
const ExternalSharePage = lazy(() => import('./pages/ExternalSharePage').then((module) => ({ default: module.ExternalSharePage })));
const DrivePage = lazy(() => import('./pages/DrivePage').then((module) => ({ default: module.DrivePage })));
const SharedPage = lazy(() => import('./pages/SharedPage').then((module) => ({ default: module.SharedPage })));
const WorkspacesPage = lazy(() => import('./pages/WorkspacesPage').then((module) => ({ default: module.WorkspacesPage })));
const DataRoomsPage = lazy(() => import('./pages/DataRoomsPage').then((module) => ({ default: module.DataRoomsPage })));
const ProofsPage = lazy(() => import('./pages/ProofsPage').then((module) => ({ default: module.ProofsPage })));
const ActivityPage = lazy(() => import('./pages/ActivityPage').then((module) => ({ default: module.ActivityPage })));
const TrashPage = lazy(() => import('./pages/TrashPage').then((module) => ({ default: module.TrashPage })));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage').then((module) => ({ default: module.PrivacyPage })));
const AdminPage = lazy(() => import('./pages/AdminPage').then((module) => ({ default: module.AdminPage })));
const DeveloperPage = lazy(() => import('./pages/DeveloperPage').then((module) => ({ default: module.DeveloperPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((module) => ({ default: module.SettingsPage })));

const RouteFallback = () => (
  <div className="route-fallback" role="status" aria-live="polite">
    <Logo />
    <span>Opening your private workspace</span>
  </div>
);

export const App = () => (
  <Suspense fallback={<RouteFallback />}>
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/share/:token" element={<ExternalSharePage />} />
      <Route element={<RequireSession />}>
        <Route element={<AppShell />}>
          <Route path="/drive" element={<DrivePage />} />
          <Route path="/shared" element={<SharedPage />} />
          <Route path="/workspaces" element={<WorkspacesPage />} />
          <Route path="/data-rooms" element={<DataRoomsPage />} />
          <Route path="/proofs" element={<ProofsPage />} />
          <Route path="/activity" element={<ActivityPage />} />
          <Route path="/trash" element={<TrashPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/developer" element={<DeveloperPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  </Suspense>
);
