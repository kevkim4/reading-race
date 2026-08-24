import { useCallback, useEffect, useState } from "react";
import { api, type ApiBook, type ApiStudent } from "./api";
import type { BookSource } from "./types";

export function useClassData(classId: string | null) {
  const [students, setStudents] = useState<ApiStudent[]>([]);
  const [books, setBooks] = useState<ApiBook[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!classId) {
      setStudents([]);
      setBooks([]);
      return;
    }
    setLoading(true);
    try {
      const data = await api.getClassData(classId);
      setStudents(data.students);
      setBooks(data.books);
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const addStudent = useCallback(
    async (name: string) => {
      if (!classId || !name.trim()) return;
      await api.addStudent(classId, name.trim());
      await reload();
    },
    [classId, reload],
  );

  const removeStudent = useCallback(
    async (studentId: string) => {
      await api.removeStudent(studentId);
      await reload();
    },
    [reload],
  );

  const addBook = useCallback(
    async (studentId: string, source: BookSource, title: string) => {
      await api.addBook(studentId, source, title);
      await reload();
    },
    [reload],
  );

  return { students, books, loading, addStudent, removeStudent, addBook };
}
