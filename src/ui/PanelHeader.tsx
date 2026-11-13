import { useState, type ReactNode } from "react";
import { Icon } from "./Icon";

/**
 * A side panel's heading: its title, a close button, and (when the panel has rules worth
 * explaining) a ? that folds the explanation open under it, so the panel opens on its numbers,
 * not on a paragraph.
 */
export function PanelHeader({ title, help, onClose }: { title: ReactNode; help?: ReactNode; onClose: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <header>
        <h2>{title}</h2>
        {help && (
          <button className={`help-btn${open ? " on" : ""}`} onClick={() => setOpen(!open)} aria-expanded={open} aria-label="How this works" title="How this works">
            ?
          </button>
        )}
        <button onClick={onClose} aria-label="Close" title="Close (Esc)">
          <Icon id="close" size={13} />
        </button>
      </header>
      {help && open && <p className="panel-help">{help}</p>}
    </>
  );
}
