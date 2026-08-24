import "./EmptyState.css";

export function EmptyState({
  icon,
  title,
  message,
}: {
  icon: string;
  title: string;
  message: string;
}) {
  return (
    <div className="empty">
      <span className="empty__icon" aria-hidden="true">
        {icon}
      </span>
      <h2 className="empty__title">{title}</h2>
      <p className="empty__message">{message}</p>
    </div>
  );
}
