import { useEffect, useRef, useState } from "react";
import "./PostActionsMenu.css";

export interface PostAction {
  label: string;
  onSelect: () => void;
  /** Renders in the danger colour and asks before firing. */
  destructive?: boolean;
  /** Shown in a confirm dialog before the action runs. */
  confirm?: string;
}

/**
 * The "⋯" affordance on a post. Only the admin ever sees one, so it holds the
 * moderation actions rather than a general-purpose overflow menu.
 *
 * Hand-rolled rather than pulled from a library: this is the only menu in the
 * app, and a dependency for one component is more surface than the thirty lines
 * of focus and dismissal handling below.
 */
export function PostActionsMenu({
  actions,
  label = "Post options",
}: {
  actions: PostAction[];
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent | TouchEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    // Dismissing on an outside tap matters more here than on a desktop menu:
    // on a phone there is no Escape key and no click-away instinct, and a menu
    // stuck open over the feed reads as the app having frozen.
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!actions.length) return null;

  return (
    <div className="postmenu" ref={containerRef}>
      <button
        className="postmenu__trigger"
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
      >
        <span aria-hidden="true">⋯</span>
      </button>

      {open && (
        <div className="postmenu__sheet" role="menu">
          {actions.map((action) => (
            <button
              key={action.label}
              className={`postmenu__item${
                action.destructive ? " postmenu__item--destructive" : ""
              }`}
              type="button"
              role="menuitem"
              onClick={() => {
                if (action.confirm && !window.confirm(action.confirm)) return;
                setOpen(false);
                action.onSelect();
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
