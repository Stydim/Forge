import { NavLink } from 'react-router-dom';

const navItems = [
  { to: '/tasks', label: 'Задачи', count: 3 },
  { to: '/goals', label: 'Цели', count: 2 },
  { to: '/progress', label: 'Прогресс' },
  { to: '/characters', label: 'Персонажи' },
  { to: '/settings', label: 'Настройки' },
];

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon" />
        <span className="sidebar-logo-text">
          Nudge<span className="brand-light">Me</span>
        </span>
      </div>

      <button className="sidebar-new-task">+ Новая задача</button>

      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
          >
            <span>{item.label}</span>
            {item.count != null && <span className="sidebar-link-count">{item.count}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-spacer" />

      <div className="sidebar-companion">
        <div className="sidebar-companion-avatar">🧙</div>
        <div>
          <div className="sidebar-companion-name">Ворчливый гном</div>
          <div className="sidebar-companion-desc">Ступень 5 из 7. Дальше только тише.</div>
        </div>
      </div>

      <div className="sidebar-plan">
        <div className="sidebar-plan-label">БЕСПЛАТНО · 3 ИЗ 5</div>
        <div className="sidebar-plan-bar">
          <div className="sidebar-plan-bar-fill" style={{ width: '60%' }} />
        </div>
        <button className="sidebar-plan-btn">Снять лимит — 299 ₽</button>
      </div>
    </aside>
  );
}
