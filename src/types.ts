export type BookSource = "WonderRoom" | "Others";

export interface Student {
  id: string;
  name: string;
}

export interface BookEntry {
  id: string;
  studentId: string;
  source: BookSource;
  title: string;
  dateAdded: string; // ISO date
}

export const GOAL_TOTAL_BOOKS = 10;
export const GOAL_WONDERROOM_BOOKS = 2;
