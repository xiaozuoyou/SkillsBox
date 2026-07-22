import { createPortal } from "react-dom";
import {
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";

type Props = {
  /** Visible tooltip + accessibility label */
  label: string;
  children: ReactNode;
  className?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "title" | "aria-label">;

/**
 * Icon-only control with an immediate hover/focus tooltip
 * (native `title` is delayed and clipped by sidebar overflow).
 */
export function GhostIconButton({
  label,
  children,
  className = "",
  disabled,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onBlur,
  ...rest
}: Props) {
  const tipId = useId();
  const wrapRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(
    null,
  );

  const place = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    // Integer pixels avoid subpixel blur from transform + fractional left/top
    setCoords({
      top: Math.round(r.bottom + 6),
      left: Math.round(r.left + r.width / 2),
    });
  }, []);

  const show = useCallback(() => {
    place();
    setOpen(true);
  }, [place]);

  const hide = useCallback(() => {
    setOpen(false);
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    const onScroll = () => place();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open, place]);

  return (
    <>
      {/* Wrapper receives hover even when the button is disabled */}
      <span
        ref={wrapRef}
        className="btn-ghost-icon-wrap"
        onMouseEnter={show}
        onMouseLeave={hide}
      >
        <button
          type="button"
          className={`btn-ghost-icon${className ? ` ${className}` : ""}`}
          disabled={disabled}
          aria-label={label}
          aria-describedby={open ? tipId : undefined}
          onMouseEnter={(e) => {
            show();
            onMouseEnter?.(e);
          }}
          onMouseLeave={(e) => {
            hide();
            onMouseLeave?.(e);
          }}
          onFocus={(e) => {
            show();
            onFocus?.(e);
          }}
          onBlur={(e) => {
            hide();
            onBlur?.(e);
          }}
          {...rest}
        >
          {children}
        </button>
      </span>
      {open && coords
        ? createPortal(
            <div
              id={tipId}
              role="tooltip"
              className="icon-tooltip"
              style={{ top: coords.top, left: coords.left }}
            >
              {label}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
