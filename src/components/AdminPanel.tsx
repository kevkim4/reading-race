import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, type AdminClass, type AdminTeacher } from "../api";
import { useRaceStatus } from "../RaceStatusContext";

function errorMessage(err: unknown, fallback: string) {
  return err instanceof Error ? err.message : fallback;
}

export function AdminPanel() {
  const [teachers, setTeachers] = useState<AdminTeacher[] | null>(null);
  const [classes, setClasses] = useState<AdminClass[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Teachers and classes reference each other (class counts, assignments),
  // so any change reloads both.
  const reload = useCallback(async () => {
    try {
      const [t, c] = await Promise.all([api.getAdminTeachers(), api.getAdminClasses()]);
      setTeachers(t);
      setClasses(c);
      setLoadError(null);
    } catch {
      setLoadError("Could not load teachers and classes.");
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <>
      <RaceDatesSection />
      {loadError && <p className="error-text">{loadError}</p>}
      <TeachersSection teachers={teachers} onChanged={reload} />
      <ClassesSection classes={classes} teachers={teachers ?? []} onChanged={reload} />
    </>
  );
}

function RaceDatesSection() {
  const { status, refresh } = useRaceStatus();
  const [startDate, setStartDate] = useState("");
  const [deadlineDate, setDeadlineDate] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setStartDate(status?.startDate ?? "");
    setDeadlineDate(status?.deadlineDate ?? "");
  }, [status]);

  async function handleSaveDates(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      await api.updateRaceSettings(startDate || null, deadlineDate || null);
      await refresh();
    } catch (err) {
      setSaveError(errorMessage(err, "Could not save race dates."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel" aria-labelledby="admin-race-heading">
      <h2 id="admin-race-heading">Race dates</h2>
      <p className="empty-hint standings-hint">
        Controls when books start counting toward the race, and when it's over. Leave either blank
        to leave that side open-ended.
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
  );
}

function TeachersSection({
  teachers,
  onChanged,
}: {
  teachers: AdminTeacher[] | null;
  onChanged: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.addAdminTeacher(name, email);
      setName("");
      setEmail("");
      await onChanged();
    } catch (err) {
      setError(errorMessage(err, "Could not add the teacher."));
    } finally {
      setBusy(false);
    }
  }

  async function handleRename(e: FormEvent) {
    e.preventDefault();
    if (!editingId || !editName.trim()) return;
    try {
      await api.renameAdminTeacher(editingId, editName);
      setEditingId(null);
      await onChanged();
    } catch (err) {
      setError(errorMessage(err, "Could not rename the teacher."));
    }
  }

  async function handleRemove(t: AdminTeacher) {
    const classesNote =
      t.classCount > 0
        ? ` Their ${t.classCount} ${t.classCount === 1 ? "class" : "classes"} will become unassigned (students and books are kept).`
        : "";
    if (!confirm(`Remove ${t.name} (${t.email})?${classesNote}`)) return;
    try {
      await api.removeAdminTeacher(t.id);
      await onChanged();
    } catch (err) {
      setError(errorMessage(err, "Could not remove the teacher."));
    }
  }

  return (
    <section className="panel" aria-labelledby="admin-teachers-heading">
      <h2 id="admin-teachers-heading">Teachers</h2>
      <p className="empty-hint standings-hint">
        Add a teacher by their school email. When they first sign in with Google, any classes you've
        assigned to them will be waiting.
      </p>
      <form className="admin-add-form" onSubmit={handleAdd}>
        <label className="field">
          <span>Name</span>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ms. Park" required />
        </label>
        <label className="field admin-add-grow">
          <span>School email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@school.org" required />
        </label>
        <button type="submit" className="primary" disabled={busy}>
          Add teacher
        </button>
      </form>
      {error && <p className="error-text">{error}</p>}

      {teachers === null ? (
        <p className="empty-hint">Loading…</p>
      ) : (
        <div className="table-scroll admin-table">
          <table>
            <thead>
              <tr>
                <th scope="col">Teacher</th>
                <th scope="col">Status</th>
                <th scope="col">Classes</th>
                <th scope="col">
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {teachers.map((t) => (
                <tr key={t.id}>
                  <th scope="row">
                    {editingId === t.id ? (
                      <form className="inline-edit" onSubmit={handleRename}>
                        <input
                          type="text"
                          autoFocus
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          aria-label={`Rename ${t.name}`}
                        />
                        <button type="submit" className="icon-button" aria-label="Save" title="Save">
                          ✓
                        </button>
                        <button type="button" className="icon-button" aria-label="Cancel" title="Cancel" onClick={() => setEditingId(null)}>
                          ×
                        </button>
                      </form>
                    ) : (
                      <>
                        {t.name}
                        {t.isYou && <span className="empty-hint"> (you)</span>}
                      </>
                    )}
                    <div className="empty-hint admin-sub">{t.email}</div>
                  </th>
                  <td>
                    <span className="admin-badges">
                      {t.signedIn ? (
                        <span className="badge badge-good">Signed in</span>
                      ) : (
                        <span className="badge badge-pending">Not signed in yet</span>
                      )}
                      {t.isAdmin && <span className="badge badge-pending">Admin</span>}
                    </span>
                  </td>
                  <td className="num">{t.classCount}</td>
                  <td className="admin-actions">
                    {editingId !== t.id && (
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => {
                          setEditingId(t.id);
                          setEditName(t.name);
                        }}
                      >
                        Rename
                      </button>
                    )}
                    {!t.isYou && (
                      <button type="button" className="link-button danger" onClick={() => handleRemove(t)}>
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function TeacherSelect({
  teachers,
  value,
  onChange,
  label,
  disabled,
}: {
  teachers: AdminTeacher[];
  value: string | null;
  onChange: (teacherId: string | null) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      aria-label={label}
      disabled={disabled}
    >
      <option value="">Unassigned</option>
      {teachers.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name}
        </option>
      ))}
    </select>
  );
}

function ClassesSection({
  classes,
  teachers,
  onChanged,
}: {
  classes: AdminClass[] | null;
  teachers: AdminTeacher[];
  onChanged: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.createAdminClass(name, teacherId);
      setName("");
      await onChanged();
    } catch (err) {
      setError(errorMessage(err, "Could not add the class."));
    } finally {
      setBusy(false);
    }
  }

  async function handleAssign(cls: AdminClass, newTeacherId: string | null) {
    setSavingId(cls.id);
    setError(null);
    try {
      await api.updateAdminClass(cls.id, { teacherId: newTeacherId });
      await onChanged();
    } catch (err) {
      setError(errorMessage(err, "Could not change the teacher."));
    } finally {
      setSavingId(null);
    }
  }

  async function handleRename(e: FormEvent) {
    e.preventDefault();
    if (!editingId || !editName.trim()) return;
    try {
      await api.updateAdminClass(editingId, { name: editName });
      setEditingId(null);
      await onChanged();
    } catch (err) {
      setError(errorMessage(err, "Could not rename the class."));
    }
  }

  async function handleDelete(cls: AdminClass) {
    const who = cls.teacherName ? ` (${cls.teacherName})` : "";
    if (!confirm(`Delete "${cls.name}"${who} and all its ${cls.studentCount} students and their books? This can't be undone.`)) return;
    await api.deleteAdminClass(cls.id);
    await onChanged();
  }

  return (
    <section className="panel" aria-labelledby="admin-classes-heading">
      <h2 id="admin-classes-heading">Classes</h2>
      <p className="empty-hint standings-hint">
        Each class has one teacher, who manages its students and books. Changing the teacher moves
        the whole class, with its students and books, to them.
      </p>
      <form className="admin-add-form" onSubmit={handleAdd}>
        <label className="field admin-add-grow">
          <span>Class name</span>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Grade 3 · Room 204" required />
        </label>
        <label className="field">
          <span>Teacher</span>
          <TeacherSelect teachers={teachers} value={teacherId} onChange={setTeacherId} label="Teacher for the new class" />
        </label>
        <button type="submit" className="primary" disabled={busy}>
          Add class
        </button>
      </form>
      {error && <p className="error-text">{error}</p>}

      {classes === null ? (
        <p className="empty-hint">Loading…</p>
      ) : classes.length === 0 ? (
        <p className="empty-hint">No classes yet.</p>
      ) : (
        <div className="table-scroll admin-table">
          <table>
            <thead>
              <tr>
                <th scope="col">Class</th>
                <th scope="col">Teacher</th>
                <th scope="col">Students</th>
                <th scope="col">
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {classes.map((c) => (
                <tr key={c.id}>
                  <th scope="row">
                    {editingId === c.id ? (
                      <form className="inline-edit" onSubmit={handleRename}>
                        <input
                          type="text"
                          autoFocus
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          aria-label={`Rename ${c.name}`}
                        />
                        <button type="submit" className="icon-button" aria-label="Save" title="Save">
                          ✓
                        </button>
                        <button type="button" className="icon-button" aria-label="Cancel" title="Cancel" onClick={() => setEditingId(null)}>
                          ×
                        </button>
                      </form>
                    ) : (
                      c.name
                    )}
                  </th>
                  <td>
                    <TeacherSelect
                      teachers={teachers}
                      value={c.teacherId}
                      onChange={(id) => handleAssign(c, id)}
                      label={`Teacher for ${c.name}`}
                      disabled={savingId === c.id}
                    />
                  </td>
                  <td className="num">{c.studentCount}</td>
                  <td className="admin-actions">
                    {editingId !== c.id && (
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => {
                          setEditingId(c.id);
                          setEditName(c.name);
                        }}
                      >
                        Rename
                      </button>
                    )}
                    <button type="button" className="link-button danger" onClick={() => handleDelete(c)}>
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
  );
}
