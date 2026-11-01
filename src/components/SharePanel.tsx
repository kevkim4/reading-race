import { useState } from "react";

interface Props {
  className: string;
  shareToken: string | null;
  onEnable: () => Promise<void>;
  onDisable: () => Promise<void>;
}

export function SharePanel({ className, shareToken, onEnable, onDisable }: Props) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const link = shareToken ? `${window.location.origin}/view/${shareToken}` : null;

  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      // Clipboard API can be unavailable (e.g. non-HTTPS); fall back to selecting the text.
      (document.getElementById("share-link-input") as HTMLInputElement | null)?.select();
      document.execCommand("copy");
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section className="panel share-panel" aria-labelledby="share-heading">
      <h2 id="share-heading">Share with students</h2>
      {!link ? (
        <div className="share-off">
          <p className="empty-hint">
            Create a link for {className} that students can open without signing in, for example
            from Google Classroom. They'll see this class's chart and progress table, which updates
            on its own.
          </p>
          <button type="button" className="primary" disabled={busy} onClick={() => run(onEnable)}>
            Create student link
          </button>
        </div>
      ) : (
        <>
          <div className="share-link-row">
            <input
              id="share-link-input"
              type="text"
              readOnly
              value={link}
              aria-label="Student link"
              onFocus={(e) => e.target.select()}
            />
            <button type="button" className="primary" onClick={copy}>
              {copied ? "Copied" : "Copy link"}
            </button>
            <a className="link-button" href={link} target="_blank" rel="noreferrer">
              Open
            </a>
          </div>
          <p className="empty-hint share-note">
            Anyone with this link can see student names and book counts, but not book titles. If it
            gets shared outside your class, make a new link.
          </p>
          <div className="share-actions">
            <button
              type="button"
              className="link-button"
              disabled={busy}
              onClick={() => {
                if (confirm("Make a new link? The current link will stop working.")) run(onEnable);
              }}
            >
              Make a new link
            </button>
            <button
              type="button"
              className="link-button danger"
              disabled={busy}
              onClick={() => {
                if (confirm("Turn off the student link? Students won't be able to open it.")) run(onDisable);
              }}
            >
              Turn off link
            </button>
          </div>
        </>
      )}
    </section>
  );
}
