import { useEffect, useState } from "react";
import { api, type AdminClass } from "../api";
import { useRaceStatus } from "../RaceStatusContext";

export function AdminPanel() {
  const { status, refresh } = useRaceStatus();
  const [startDate, setStartDate] = useState("");
  const [deadlineDate, setDeadlineDate] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [classes, setClasses] = useState<AdminClass[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  useEffect(() => {
    setStartDate(status?.startDate ?? "");
    setDeadlineDate(status?.deadlineDate ?? "");
  }, [status]);

  function loadClasses() {
    api
      .getAdminClasses()
      .then(setClasses)
      .catch(() => setListError("Could not load classes."));
  }

  useEffect(() => {
    loadClasses();
  }, []);

  async function handleSaveDates(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      await api.updateRaceSettings(startDate || null, deadlineDate || null);
      await refresh();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Could not save race dates.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteClass(cls: AdminClass) {
    if (!confirm(`Delete "${cls.name}" (${cls.teacherName}) and all its students and books?`)) return;
    await api.deleteAdminClass(cls.id);
    loadClasses();
  }

  return (
    <>
      <section className="panel" aria-labelledby="admin-race-heading">
        <h2 id="admin-race-heading">Race dates</h2>
        <p className="empty-hint standings-hint">
          Controls when books start counting toward the race, and when it's over. Leave either
          blank to leave that side open-ended.
        </p>
        <form className="race-dates-form" onSubmit={handleSaveDates}>
          <label className="field">
            <span>Start date</span>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>
          <label className="field">
            <span>Deadline</span>
            <input type="date" value={deadlineDate} onChange={(e) => setDeadlineDate(e.target.value)} />
          </label>
          <button type="submit" className="primary" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </form>
        {saveError && <p className="error-text">{saveError}</p>}
        {status && (
          <p className="empty-hint" style={{ marginTop: 10 }}>
            Current status: {!status.hasStarted ? "not started yet" : status.isOver ? "race over" : "active"}
          </p>
        )}
      </section>

      <section className="panel" aria-labelledby="admin-classes-heading">
        <h2 id="admin-classes-heading">All classes</h2>
        {listError && <p className="error-text">{listError}</p>}
        {!listError && classes === null && <p className="empty-hint">Loading…</p>}
        {classes && classes.length === 0 && <p className="empty-hint">No classes have been created yet.</p>}
        {classes && classes.length > 0 && (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Class</th>
                  <th scope="col">Teacher</th>
                  <th scope="col">Students</th>
                  <th scope="col"></th>
                </tr>
              </thead>
              <tbody>
                {classes.map((c) => (
                  <tr key={c.id}>
                    <th scope="row">{c.name}</th>
                    <td>
                      {c.teacherName}
                      <div className="empty-hint">{c.teacherEmail}</div>
                    </td>
                    <td className="num">{c.studentCount}</td>
                    <td>
                      <button type="button" className="link-button" onClick={() => handleDeleteClass(c)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
