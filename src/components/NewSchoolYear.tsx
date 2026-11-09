import { useEffect, useRef, useState, type FormEvent } from "react";
import { api, type AdminClass } from "../api";

const CONFIRM_PHRASE = "NEW YEAR";

type Step =
  | { kind: "closed" }
  | { kind: "choose"; error?: string }
  | { kind: "downloading" }
  | { kind: "confirm"; savedAs: string | null; error?: string }
  | { kind: "working" }
  | { kind: "done"; deletedStudents: number; deletedBooks: number };

export function NewSchoolYear({ classes }: { classes: AdminClass[] | null }) {
  const [step, setStep] = useState<Step>({ kind: "closed" });
  const [typed, setTyped] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);

  const studentCount = (classes ?? []).reduce((n, c) => n + c.studentCount, 0);
  const classCount = classes?.length ?? 0;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (step.kind === "closed" && dialog.open) dialog.close();
    if (step.kind !== "closed" && !dialog.open) dialog.showModal();
  }, [step.kind]);

  function open() {
    setTyped("");
    setStep({ kind: "choose" });
  }

  function close() {
    if (step.kind === "downloading" || step.kind === "working") return;
    if (step.kind === "done") {
      // Every view (My class, standings) shows last year's data until reloaded.
      window.location.reload();
      return;
    }
    setStep({ kind: "closed" });
  }

  async function download() {
    setStep({ kind: "downloading" });
    try {
      const filename = await api.downloadSchoolExport();
      setStep({ kind: "confirm", savedAs: filename });
    } catch (err) {
      setStep({ kind: "choose", error: err instanceof Error ? err.message : "Download failed." });
    }
  }

  async function startYear(e: FormEvent) {
    e.preventDefault();
    if (step.kind !== "confirm" || typed.trim() !== CONFIRM_PHRASE) return;
    const savedAs = step.savedAs;
    setStep({ kind: "working" });
    try {
      const result = await api.startNewSchoolYear(typed.trim());
      setStep({ kind: "done", ...result });
    } catch (err) {
      setStep({
        kind: "confirm",
        savedAs,
        error: err instanceof Error ? err.message : "Couldn't start the new school year. Nothing was deleted.",
      });
    }
  }

  return (
    <section className="panel new-year" aria-labelledby="admin-newyear-heading">
      <h2 id="admin-newyear-heading">New school year</h2>
      <p className="empty-hint standings-hint">
        Empties every class so teachers can add this year's students. Classes and teachers are kept,
        so you can rename or reassign them afterward. You'll be offered a spreadsheet of this year's
        data first.
      </p>
      <button type="button" className="danger-button" onClick={open}>
        Start new school year…
      </button>

      <dialog
        ref={dialogRef}
        className="modal"
        aria-labelledby="newyear-dialog-title"
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
      >
        <h2 id="newyear-dialog-title">Start a new school year</h2>

        {(step.kind === "choose" || step.kind === "downloading") && (
          <>
            <ul className="modal-list">
              <li>
                {studentCount === 0 ? (
                  <>
                    <strong>Deletes</strong> nothing right now: no class has any students yet.
                  </>
                ) : (
                  <>
                    <strong>Deletes</strong> all {studentCount} {studentCount === 1 ? "student" : "students"} and
                    every book they logged (including AR levels), across {classCount}{" "}
                    {classCount === 1 ? "class" : "classes"}.
                  </>
                )}
              </li>
              <li>
                <strong>Keeps</strong> every class and teacher, so you can rename or reassign them
                afterward.
              </li>
              <li>
                <strong>Clears</strong> the race start and deadline dates, and turns off every class's
                student link.
              </li>
            </ul>
            <p className="modal-question">Download a spreadsheet of this year's data first?</p>
            {step.kind === "choose" && step.error && <p className="error-text">{step.error}</p>}
            <div className="modal-actions">
              <button type="button" className="primary" onClick={download} disabled={step.kind === "downloading"}>
                {step.kind === "downloading" ? "Preparing spreadsheet…" : "Yes, download spreadsheet"}
              </button>
              <button
                type="button"
                className="secondary"
                disabled={step.kind === "downloading"}
                onClick={() => setStep({ kind: "confirm", savedAs: null })}
              >
                No, don't save
              </button>
              <button type="button" className="link-button" onClick={close} disabled={step.kind === "downloading"}>
                Cancel
              </button>
            </div>
          </>
        )}

        {(step.kind === "confirm" || step.kind === "working") && (
          <form onSubmit={startYear}>
            {step.kind === "confirm" && step.savedAs ? (
              <p className="modal-note good">
                ✓ Downloaded <strong>{step.savedAs}</strong>. Check that it's in your Downloads folder
                before you continue. Once cleared, this year's data can't be recovered.{" "}
                <button type="button" className="link-button" onClick={download}>
                  Download again
                </button>
              </p>
            ) : (
              <p className="modal-note warn">
                No copy will be saved. This year's students and books will be permanently deleted.
              </p>
            )}
            <label className="field">
              <span>
                Type <strong>{CONFIRM_PHRASE}</strong> to confirm
              </span>
              <input
                type="text"
                autoFocus
                autoComplete="off"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                disabled={step.kind === "working"}
              />
            </label>
            {step.kind === "confirm" && step.error && <p className="error-text">{step.error}</p>}
            <div className="modal-actions">
              <button
                type="submit"
                className="danger-button"
                disabled={typed.trim() !== CONFIRM_PHRASE || step.kind === "working"}
              >
                {step.kind === "working" ? "Clearing…" : "Clear and start new year"}
              </button>
              <button type="button" className="link-button" onClick={close} disabled={step.kind === "working"}>
                Cancel
              </button>
            </div>
          </form>
        )}

        {step.kind === "done" && (
          <>
            <p className="modal-note good">
              ✓ New school year started. Deleted {step.deletedStudents}{" "}
              {step.deletedStudents === 1 ? "student" : "students"} and {step.deletedBooks}{" "}
              {step.deletedBooks === 1 ? "book" : "books"}.
            </p>
            <p className="empty-hint">
              Next, in the Admin tab: rename or reassign classes, add or remove teachers, and set
              the new race dates. Then ask teachers to add their students and make a new student link.
            </p>
            <div className="modal-actions">
              <button type="button" className="primary" onClick={close}>
                Done
              </button>
            </div>
          </>
        )}
      </dialog>
    </section>
  );
}
