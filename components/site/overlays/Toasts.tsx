"use client";
import { useSite } from "../SiteProvider";
import "./toasts.css";

/** The toast stack: top-centre pills, newest last, each with an optional Undo and a dismiss button. A polite
 *  live region so screen readers announce messages without stealing focus. */
export default function Toasts() {
  const { toasts, dismissToast } = useSite();
  return (
    <div className="toast-wrap" aria-live="polite" aria-atomic="false">
      <div className="toast-stack">
        {toasts.map((t) => (
          <div key={t.id} className="toast" role="status">
            <span>{t.message}</span>
            {t.undo && (
              <button type="button" className="toast-undo" onClick={() => { t.undo?.(); dismissToast(t.id); }}>Undo</button>
            )}
            <button type="button" className="toast-x" aria-label="Dismiss" onClick={() => dismissToast(t.id)}>&times;</button>
          </div>
        ))}
      </div>
    </div>
  );
}
