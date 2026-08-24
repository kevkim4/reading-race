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
  teacherName: string;
  teacherEmail: string;
  studentCount: number;
  createdAt: string;
}

export interface ClassSummary {
  id: string;
  name: string;
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
}

export interface LeaderboardClass {
  classId: string;
  className: string;
  teacherName: string;
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

  getClassData: (classId: string) =>
    request<{ students: ApiStudent[]; books: ApiBook[] }>(`/classes/${classId}/data`),
  addStudent: (classId: string, name: string) =>
    request<ApiStudent>(`/classes/${classId}/students`, { method: "POST", body: JSON.stringify({ name }) }),
  removeStudent: (studentId: string) => request<void>(`/students/${studentId}`, { method: "DELETE" }),

  addBook: (studentId: string, source: BookSource, title: string) =>
    request<ApiBook>(`/students/${studentId}/books`, { method: "POST", body: JSON.stringify({ source, title }) }),
  removeBook: (bookId: string) => request<void>(`/books/${bookId}`, { method: "DELETE" }),

  getLeaderboard: () => request<LeaderboardResponse>("/leaderboard"),

  getRaceStatus: () => request<RaceStatus>("/race-settings"),
  updateRaceSettings: (startDate: string | null, deadlineDate: string | null) =>
    request<RaceStatus>("/race-settings", {
      method: "PUT",
      body: JSON.stringify({ startDate, deadlineDate }),
    }),

  getAdminClasses: () => request<AdminClass[]>("/admin/classes"),
  deleteAdminClass: (classId: string) => request<void>(`/admin/classes/${classId}`, { method: "DELETE" }),
};
