import {
  Pulse,
  Bell,
  BracketsCurly,
  CaretDown,
  CirclesThreePlus,
  FolderOpen,
  GearSix,
  HardDrives,
  List,
  LockKeyOpen,
  MagnifyingGlass,
  ShieldCheck,
  SidebarSimple,
  Trash,
  UsersThree,
  Vault,
  X,
} from '@phosphor-icons/react';
import { FormEvent, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { unreadNotifications, useAppStore } from '../store/AppStore';
import { relativeTime } from '../lib/format';
import { Logo } from './Logo';
import './AppShell.css';

const navigation = [
  { to: '/drive', label: 'My drive', icon: FolderOpen },
  { to: '/shared', label: 'Shared', icon: UsersThree },
  { to: '/workspaces', label: 'Workspaces', icon: CirclesThreePlus },
  { to: '/data-rooms', label: 'Data rooms', icon: Vault },
  { to: '/proofs', label: 'Proofs', icon: ShieldCheck },
  { to: '/activity', label: 'Activity', icon: Pulse },
  { to: '/trash', label: 'Trash', icon: Trash },
] as const;

const secondary = [
  { to: '/privacy', label: 'Privacy center', icon: LockKeyOpen },
  { to: '/admin', label: 'Admin', icon: HardDrives },
  { to: '/developer', label: 'Developer', icon: BracketsCurly },
  { to: '/settings', label: 'Settings', icon: GearSix },
] as const;

export const AppShell = () => {
  const { state, actions } = useAppStore();
  const [noticesOpen, setNoticesOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const unread = unreadNotifications(state.notifications);

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    navigate(`/drive${search.trim() ? `?q=${encodeURIComponent(search.trim())}` : ''}`);
  };

  return (
    <div className={`app-shell ${state.sidebarCollapsed ? 'app-shell--collapsed' : ''}`}>
      <aside className="sidebar">
        <div className="sidebar__head">
          <Logo compact={state.sidebarCollapsed} />
          <button className="icon-button sidebar__collapse" onClick={actions.toggleSidebar} aria-label="Toggle sidebar"><SidebarSimple size={20} weight="light" /></button>
        </div>
        <nav className="sidebar__nav" aria-label="Primary navigation">
          {navigation.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `sidebar__link ${isActive ? 'is-active' : ''}`}>
              <Icon size={21} weight="light" /><span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <nav className="sidebar__nav sidebar__nav--secondary" aria-label="Management navigation">
          {secondary.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `sidebar__link ${isActive ? 'is-active' : ''}`}>
              <Icon size={21} weight="light" /><span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <button className="account-card" onClick={() => setAccountOpen((open) => !open)}>
          <span className="account-card__avatar">{state.session.avatarInitials}</span>
          <span className="account-card__copy"><strong>{state.session.displayName}</strong><small>{state.session.walletAddress.slice(0, 8)}…{state.session.walletAddress.slice(-4)}</small></span>
          <CaretDown size={14} weight="light" />
        </button>
        {accountOpen && (
          <div className="account-menu">
            <p><span className="status-dot" /> Midnight preprod</p>
            <button onClick={actions.disconnect}>Disconnect wallet</button>
          </div>
        )}
      </aside>

      <header className="topbar">
        <form className="global-search" onSubmit={submitSearch}>
          <MagnifyingGlass size={19} weight="light" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search files, proofs, people…" aria-label="Search" />
          <kbd>⌘ K</kbd>
        </form>
        <div className="topbar__actions">
          <span className="network-pill"><span className="status-dot" /> Preprod</span>
          <button className="icon-button notice-button" onClick={() => setNoticesOpen(true)} aria-label={`${unread} unread notifications`}>
            <Bell size={20} weight="light" />{unread > 0 && <span>{unread}</span>}
          </button>
        </div>
      </header>

      <main className="app-main" key={location.pathname}><Outlet /></main>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        {navigation.slice(0, 5).map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) => isActive ? 'is-active' : ''}>
            <Icon size={21} weight="light" /><span>{label.replace('My ', '')}</span>
          </NavLink>
        ))}
      </nav>

      <aside className={`notice-drawer ${noticesOpen ? 'is-open' : ''}`} aria-hidden={!noticesOpen}>
        <header><div><span className="eyebrow">Signals</span><h2>Notifications</h2></div><button className="icon-button" onClick={() => setNoticesOpen(false)} aria-label="Close notifications"><X size={20} weight="light" /></button></header>
        <div className="notice-drawer__list">
          {state.notifications.map((notice) => (
            <article className={notice.read ? '' : 'is-unread'} key={notice.id}>
              <span className="notice-type"><List size={16} weight="light" /></span>
              <div><strong>{notice.title}</strong><p>{notice.body}</p><small>{relativeTime(notice.createdAt)}</small></div>
            </article>
          ))}
        </div>
        <button className="text-action" onClick={actions.markNotificationsRead}>Mark all as read</button>
      </aside>
      {noticesOpen && <button className="drawer-scrim" onClick={() => setNoticesOpen(false)} aria-label="Close notifications" />}
    </div>
  );
};
