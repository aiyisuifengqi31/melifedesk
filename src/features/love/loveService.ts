export function calculateDaysTogether(startDate: string, today: string) {
  const start = new Date(`${startDate}T00:00:00Z`);
  const current = new Date(`${today}T00:00:00Z`);
  return Math.max(0, Math.floor((current.getTime() - start.getTime()) / 86_400_000) + 1);
}

export function calculateCycleWindow(startDate: string, cycleLength = 28, periodLength = 5) {
  const start = new Date(`${startDate}T00:00:00Z`);
  const next = new Date(start);
  next.setUTCDate(start.getUTCDate() + cycleLength);
  const end = new Date(next);
  end.setUTCDate(next.getUTCDate() + periodLength - 1);
  return {
    endDate: end.toISOString().slice(0, 10),
    startDate: next.toISOString().slice(0, 10)
  };
}
