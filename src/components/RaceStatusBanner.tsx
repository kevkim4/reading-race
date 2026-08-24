import { useRaceStatus } from "../RaceStatusContext";

function formatRaceDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, {
    dateStyle: "medium",
    timeZone: "UTC",
  });
}

export function RaceStatusBanner() {
  const { status } = useRaceStatus();

  if (!status || (!status.startDate && !status.deadlineDate)) return null;

  let message: string;
  let tone: "upcoming" | "active" | "over";
  if (!status.hasStarted && status.startDate) {
    message = `Race starts ${formatRaceDate(status.startDate)}`;
    tone = "upcoming";
  } else if (status.isOver && status.deadlineDate) {
    message = `Race ended ${formatRaceDate(status.deadlineDate)} — final standings are in`;
    tone = "over";
  } else if (status.deadlineDate) {
    message = `Race is on — ends ${formatRaceDate(status.deadlineDate)}`;
    tone = "active";
  } else {
    message = "Race is on";
    tone = "active";
  }

  return <div className={`race-banner race-banner-${tone}`}>🏁 {message}</div>;
}
