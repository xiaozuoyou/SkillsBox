import { useEffect, useState } from "react";
import { useT } from "../i18n/context";

interface Props {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    description: string;
    body: string;
  }) => void;
}

export function CreateModal({ open, busy, onClose, onSubmit }: Props) {
  const t = useT();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [body, setBody] = useState("");

  useEffect(() => {
    if (open) {
      setName("");
      setDescription("");
      setBody("");
    }
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="modal-card modal-card--wide">
        <div className="modal-head">
          <h3 id="create-modal-title">{t("create.title")}</h3>
          <p className="modal-desc muted">
            {t("create.desc")} <code>SKILL.md</code>
            {t("create.descEnd")}
          </p>
        </div>
        <div className="modal-fields">
          <div className="field">
            <label htmlFor="create-name">{t("create.name")}</label>
            <input
              id="create-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="my-skill"
              autoComplete="off"
              autoFocus
              disabled={busy}
            />
          </div>
          <div className="field">
            <label htmlFor="create-desc">{t("create.description")}</label>
            <input
              id="create-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("create.descriptionPlaceholder")}
              disabled={busy}
            />
          </div>
          <div className="field">
            <label htmlFor="create-body">{t("create.body")}</label>
            <textarea
              id="create-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={t("create.bodyPlaceholder")}
              rows={8}
              disabled={busy}
            />
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn" disabled={busy} onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button
            type="button"
            className="btn primary"
            disabled={busy || !name.trim()}
            onClick={() =>
              onSubmit({
                name: name.trim(),
                description: description.trim(),
                body: body.trim(),
              })
            }
          >
            {busy ? t("create.submitting") : t("create.submit")}
          </button>
        </div>
      </div>
    </div>
  );
}
