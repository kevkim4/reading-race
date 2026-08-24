import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "reading-race:v1";

interface StoredState {
  students: import("./types").Student[];
  books: import("./types").BookEntry[];
}

function loadState(): StoredState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { students: [], books: [] };
    const parsed = JSON.parse(raw);
    return {
      students: Array.isArray(parsed.students) ? parsed.students : [],
      books: Array.isArray(parsed.books) ? parsed.books : [],
    };
  } catch {
    return { students: [], books: [] };
  }
}

function saveState(state: StoredState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function useReadingRaceStore() {
  const [state, setState] = useState<StoredState>(() => loadState());

  useEffect(() => {
    saveState(state);
  }, [state]);

  const addStudent = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setState((prev) => ({
      ...prev,
      students: [
        ...prev.students,
        { id: crypto.randomUUID(), name: trimmed },
      ],
    }));
  }, []);

  const removeStudent = useCallback((studentId: string) => {
    setState((prev) => ({
      students: prev.students.filter((s) => s.id !== studentId),
      books: prev.books.filter((b) => b.studentId !== studentId),
    }));
  }, []);

  const addBook = useCallback(
    (studentId: string, source: import("./types").BookSource, title: string) => {
      setState((prev) => ({
        ...prev,
        books: [
          ...prev.books,
          {
            id: crypto.randomUUID(),
            studentId,
            source,
            title: title.trim(),
            dateAdded: new Date().toISOString(),
          },
        ],
      }));
    },
    [],
  );

  const removeBook = useCallback((bookId: string) => {
    setState((prev) => ({
      ...prev,
      books: prev.books.filter((b) => b.id !== bookId),
    }));
  }, []);

  return {
    students: state.students,
    books: state.books,
    addStudent,
    removeStudent,
    addBook,
    removeBook,
  };
}
