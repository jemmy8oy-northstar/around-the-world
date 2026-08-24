import React from "react";
import "./Badge.css";

export type BadgeVariant =
  | "neutral"
  | "accent"
  | "success"
  | "warning"
  | "danger";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Colour role. Defaults to 'neutral'. */
  variant?: BadgeVariant;
}

const Badge: React.FC<BadgeProps> = ({
  variant = "neutral",
  className,
  children,
  ...rest
}) => {
  const classes = ["ui-badge", `ui-badge--${variant}`, className ?? ""]
    .filter(Boolean)
    .join(" ");
  return (
    <span className={classes} {...rest}>
      {children}
    </span>
  );
};

export default Badge;
