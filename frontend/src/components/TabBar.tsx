import type { CSSProperties } from "react";
import { NavLink } from "react-router-dom";
import { useSession } from "../auth/useSession";
import "./TabBar.css";

const TABS = [
  { to: "/", label: "Feed", icon: "🍻", end: true },
  { to: "/map", label: "Map", icon: "🗺️", end: false },
  { to: "/post", label: "Post", icon: "📸", end: false },
  { to: "/board", label: "Board", icon: "🏆", end: false },
];

const ADMIN_TAB = { to: "/admin", label: "Admin", icon: "🎛️", end: false };

/**
 * Fixed to the bottom because this is a phone-only app and the bottom of the
 * screen is the only place a thumb reaches comfortably.
 *
 * The admin tab shows for exactly one player. It is not a security boundary —
 * the server authorises every admin call from the token, so a hand-edited
 * localStorage buys a tab whose every button returns 403. It is the difference
 * between the person running the night having the controls to hand and having
 * to remember an unlisted URL and a shared key in a pub at midnight.
 */
export function TabBar() {
  const session = useSession();
  const tabs = session?.isAdmin ? [...TABS, ADMIN_TAB] : TABS;

  return (
    <nav
      className="tabbar"
      aria-label="Main"
      // The column count follows the tabs rather than being hard-coded, so the
      // fifth tab resizes the bar instead of overflowing it.
      style={{ "--tabbar-columns": tabs.length } as CSSProperties}
    >
      {tabs.map((tab) => (
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
