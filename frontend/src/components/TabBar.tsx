import { NavLink } from "react-router-dom";
import "./TabBar.css";

const TABS = [
  { to: "/", label: "Feed", icon: "🍻", end: true },
  { to: "/map", label: "Map", icon: "🗺️", end: false },
  { to: "/post", label: "Post", icon: "📸", end: false },
  { to: "/board", label: "Board", icon: "🏆", end: false },
];

/**
 * Fixed to the bottom because this is a phone-only app and the bottom of the
 * screen is the only place a thumb reaches comfortably. Deliberately does not
 * link to /admin — that page is unlisted.
 */
export function TabBar() {
  return (
    <nav className="tabbar" aria-label="Main">
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) =>
            `tabbar__tab${isActive ? " tabbar__tab--active" : ""}`
          }
        >
          <span className="tabbar__icon" aria-hidden="true">
            {tab.icon}
          </span>
          <span className="tabbar__label">{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
