import { useEffect, useState } from "react";
import { useT } from "../i18n/context";
import { api, errMsg } from "../lib/api";
import type { SkillListItem } from "../lib/types";

interface Props {
  skill: SkillListItem | null;
  onClose: () => void;
}

export function SkillBodyModal({ skill, onClose }: Props) {
  const t = useT();
  const [body, setBody] = useState<string | null>(null);
  const [path, setPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!skill) {
      setBody(null);
      setPath(null);
      setError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setBody(null);
    setPath(null);
    setError(null);
    void api
      .getSkill(skill.id)
      .then((d) => {
        if (cancelled) return;
        setBody(d.body ?? "");
        setPath(d.absolutePath);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(errMsg(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [skill]);

  useEffect(() => {
    if (!skill) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [skill, onClose]);

  if (!skill) return null;

  return (
    <div
      className="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="skill-body-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-card modal-card--skill-body">
        <div className="modal-head skill-body-modal-head">
          <div className="skill-body-modal-title-row">
            <h3 id="skill-body-modal-title">{skill.name}</h3>
            <button
              type="button"
              className="btn skill-body-modal-close"
              onClick={onClose}
            >
              {t("common.close")}
            </button>
          </div>
          {skill.description ? (
            <p className="modal-desc muted">{skill.description}</p>
          ) : null}
          {path ? (
            <p className="skill-body-modal-path muted" title={path}>
              <code>{path}</code>
            </p>
          ) : null}
        </div>
        <div className="skill-body-modal-content">
          {loading ? (
            <p className="muted skill-body-modal-status">
              {t("list.viewContentLoading")}
            </p>
          ) : error ? (
            <p className="skill-body-modal-error">{error}</p>
          ) : (
            <pre className="code-block skill-body-modal-pre">
              {body || t("common.empty")}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
