import React, { useId } from 'react';
import './Input.css';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    /** Visible label, always rendered (required for accessibility). */
    label: string;
    /** Muted guidance shown under the field. */
    helperText?: string;
    /** Error message; when set, the field renders in its error state. */
    error?: string;
}

const Input: React.FC<InputProps> = ({
    label,
    helperText,
    error,
    id,
    className,
    ...rest
}) => {
    const autoId = useId();
    const inputId = id ?? autoId;
    const messageId = `${inputId}-message`;
    const invalid = Boolean(error);
    const message = error ?? helperText;

    const classes = ['ui-field', invalid ? 'ui-field--error' : '', className ?? '']
        .filter(Boolean).join(' ');

    return (
        <div className={classes}>
            <label className="ui-field__label" htmlFor={inputId}>{label}</label>
            <input
                id={inputId}
                className="ui-field__input"
                aria-invalid={invalid || undefined}
                aria-describedby={message ? messageId : undefined}
                {...rest}
            />
            {message && (
                <p id={messageId} className="ui-field__message" role={invalid ? 'alert' : undefined}>
                    {message}
                </p>
            )}
        </div>
    );
};

export default Input;
