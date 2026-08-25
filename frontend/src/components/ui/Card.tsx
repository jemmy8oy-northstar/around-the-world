import React from "react";
import "./Card.css";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Lifts the card with a glow border on hover. */
  hover?: boolean;
}

type SectionProps = React.HTMLAttributes<HTMLDivElement>;

const Card: React.FC<CardProps> = ({
  hover = false,
  className,
  children,
  ...rest
}) => {
  const classes = ["ui-card", hover ? "ui-card--hover" : "", className ?? ""]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  );
};

export const CardHeader: React.FC<SectionProps> = ({
  className,
  children,
  ...rest
}) => (
  <div
    className={["ui-card__header", className ?? ""].filter(Boolean).join(" ")}
    {...rest}
  >
    {children}
  </div>
);

export const CardBody: React.FC<SectionProps> = ({
  className,
  children,
  ...rest
}) => (
  <div
    className={["ui-card__body", className ?? ""].filter(Boolean).join(" ")}
    {...rest}
  >
    {children}
  </div>
);

export const CardFooter: React.FC<SectionProps> = ({
  className,
  children,
  ...rest
}) => (
  <div
    className={["ui-card__footer", className ?? ""].filter(Boolean).join(" ")}
    {...rest}
  >
    {children}
  </div>
);

export default Card;
