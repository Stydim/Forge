import { NavLink, Link } from 'react-router-dom';
import { getCharacter, DEFAULT_CHARACTER_ID } from '../lib/characters';

const character = getCharacter(DEFAULT_CHARACTER_ID);

const navItems = [
  { to: '/tasks', label: 'Задачи', count: 3 },
  { to: '/goals', label: 'Цели', count: 2 },
  { to: '/progress', label: 'Прогресс' },
  { to: '/characters', label: 'Персонажи' },
  { to: '/settings', label: 'Настройки' },
];

export default function Sidebar({ onNewTask }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon" />
        <span className="sidebar-logo-text">Forge</span>
      </div>

      <button className="sidebar-new-task" onClick={onNewTask}>+ Новая задача</button>

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

      <Link to="/characters" className="sidebar-companion">
        <img className="sidebar-companion-avatar" src={character.avatar} alt={character.name} />
        <div>
          <div className="sidebar-companion-name">{character.name}</div>
          <div className="sidebar-companion-desc">{character.tagline}</div>
        </div>
      </Link>

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
