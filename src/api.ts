import type { BookSource } from "./types";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: "include",
    cache: "no-store",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    ...init,
  });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(body?.error || `Request failed (${res.status})`);
  }
  return body as T;
}

export interface Teacher {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
}

export interface ServerConfig {
  googleClientId: string | null;
  allowedEmailDomain: string | null;
  /** True only on a developer's machine with no Google client configured. */
  testSignIn: boolean;
}

export interface RaceStatus {
  startDate: string | null;
  deadlineDate: string | null;
  hasStarted: boolean;
  isOver: boolean;
}

export interface AdminClass {
  id: string;
  name: string;
  /** null = unassigned */
  teacherId: string | null;
  teacherName: string | null;
  teacherEmail: string | null;
  studentCount: number;
  createdAt: string;
}

export interface AdminTeacher {
  id: string;
  name: string;
  email: string;
  /** false = added by an admin and hasn't signed in yet */
  signedIn: boolean;
  isAdmin: boolean;
  isYou: boolean;
  classCount: number;
}

export interface ClassSummary {
  id: string;
  name: string;
  shareToken: string | null;
}

export interface PublicClassView {
  className: string;
  raceStatus: RaceStatus;
  students: ApiStudent[];
  books: { studentId: string; source: BookSource; arLevel: number | null }[];
}

export interface ApiStudent {
  id: string;
  name: string;
}

export interface ApiBook {
  id: string;
  studentId: string;
  source: BookSource;
  title: string;
  dateAdded: string;
  arLevel: number | null;
}

export interface LeaderboardClass {
  classId: string;
  className: string;
  teacherName: string | null;
  totalStudents: number;
  finishedCount: number;
  allFinished: boolean;
  classFinishTime: string | null;
}

export interface LeaderboardResponse {
  classes: LeaderboardClass[];
  raceStatus: RaceStatus;
}

export const api = {
  getConfig: () => request<ServerConfig>("/config"),
  getMe: () => request<Teacher>("/me"),
  signInWithGoogle: (credential: string) =>
    request<Teacher>("/auth/google", { method: "POST", body: JSON.stringify({ credential }) }),
  devSignIn: (name: string, email: string) =>
    request<Teacher>("/auth/dev-login", { method: "POST", body: JSON.stringify({ name, email }) }),
  logout: () => request<void>("/auth/logout", { method: "POST" }),

  getClasses: () => request<ClassSummary[]>("/classes"),
  createClass: (name: string) =>
    request<ClassSummary>("/classes", { method: "POST", body: JSON.stringify({ name }) }),
  deleteClass: (classId: string) => request<void>(`/classes/${classId}`, { method: "DELETE" }),
  enableShare: (classId: string) =>
    request<{ shareToken: string }>(`/classes/${classId}/share`, { method: "POST" }),
  disableShare: (classId: string) => request<void>(`/classes/${classId}/share`, { method: "DELETE" }),
  getPublicClass: (token: string) =>
    request<PublicClassView>(`/public/classes/${encodeURIComponent(token)}`),

  getClassData: (classId: string) =>
    request<{ students: ApiStudent[]; books: ApiBook[] }>(`/classes/${classId}/data`),
  addStudent: (classId: string, name: string) =>
    request<ApiStudent>(`/classes/${classId}/students`, { method: "POST", body: JSON.stringify({ name }) }),
  renameStudent: (studentId: string, name: string) =>
    request<ApiStudent>(`/students/${studentId}`, { method: "PATCH", body: JSON.stringify({ name }) }),
  removeStudent: (studentId: string) => request<void>(`/students/${studentId}`, { method: "DELETE" }),

  addBook: (studentId: string, source: BookSource, title: string, arLevel: number | null) =>
    request<ApiBook>(`/students/${studentId}/books`, {
      method: "POST",
      body: JSON.stringify({ source, title, arLevel }),
    }),
  updateBook: (bookId: string, source: BookSource, title: string, arLevel: number | null) =>
    request<ApiBook>(`/books/${bookId}`, {
      method: "PATCH",
      body: JSON.stringify({ source, title, arLevel }),
    }),
  removeBook: (bookId: string) => request<void>(`/books/${bookId}`, { method: "DELETE" }),

  getLeaderboard: () => request<LeaderboardResponse>("/leaderboard"),

  getRaceStatus: () => request<RaceStatus>("/race-settings"),
  updateRaceSettings: (startDate: string | null, deadlineDate: string | null) =>
    request<RaceStatus>("/race-settings", {
      method: "PUT",
      body: JSON.stringify({ startDate, deadlineDate }),
    }),

  getAdminClasses: () => request<AdminClass[]>("/admin/classes"),
  createAdminClass: (name: string, teacherId: string | null) =>
    request<{ id: string }>("/admin/classes", { method: "POST", body: JSON.stringify({ name, teacherId }) }),
  updateAdminClass: (classId: string, changes: { name?: string; teacherId?: string | null }) =>
    request<{ id: string }>(`/admin/classes/${classId}`, { method: "PATCH", body: JSON.stringify(changes) }),
  deleteAdminClass: (classId: string) => request<void>(`/admin/classes/${classId}`, { method: "DELETE" }),

  /** Downloads the whole-school spreadsheet; resolves with the filename once the browser has the file. */
  downloadSchoolExport: async (): Promise<string> => {
    const res = await fetch("/api/admin/export", { credentials: "include", cache: "no-store" });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error || `Download failed (${res.status})`);
    }
    const blob = await res.blob();
    const match = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "");
    const filename = match?.[1] ?? "reading-race.xlsx";
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return filename;
  },
  startNewSchoolYear: (confirm: string) =>
    request<{ deletedStudents: number; deletedBooks: number }>("/admin/new-school-year", {
      method: "POST",
      body: JSON.stringify({ confirm }),
    }),

  getAdminTeachers: () => request<AdminTeacher[]>("/admin/teachers"),
  addAdminTeacher: (name: string, email: string) =>
    request<AdminTeacher>("/admin/teachers", { method: "POST", body: JSON.stringify({ name, email }) }),
  renameAdminTeacher: (teacherId: string, name: string) =>
    request<{ id: string }>(`/admin/teachers/${teacherId}`, { method: "PATCH", body: JSON.stringify({ name }) }),
  removeAdminTeacher: (teacherId: string) => request<void>(`/admin/teachers/${teacherId}`, { method: "DELETE" }),
};
