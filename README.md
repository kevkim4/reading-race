# Reading Race

A small app for tracking a class's reading progress.

Each student's goal: **10 books minimum**, with **at least 2 from WonderRoom**
(the school library) and the rest from anywhere else (EPIC, home, personal
books, etc). Students can read more WonderRoom books, and more books overall,
than the minimum.

## Features

- Manage a student roster
- Log each book with a source toggle: **WonderRoom** or **Others**
- A stacked bar chart showing every student's WonderRoom vs. Others count,
  with a dashed line marking the 10-book goal
- A progress table with per-student status ("Goal met" / how many more books
  or WonderRoom books are needed)

Data is stored in the browser's local storage — no account or server needed,
but it's tied to this browser/device.

## Development

```bash
npm install
npm run dev
```

Build for production:

```bash
npm run build
```

Deploy `dist/` as a static site anywhere (GitHub Pages, Netlify, Vercel, etc).
