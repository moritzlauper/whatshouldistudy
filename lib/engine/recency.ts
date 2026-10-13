/** Product rule, not a psychological norm: half the weight every two calendar years. */
export const ACTIVITY_YEARS = 6

export function activityAgeWeight(year: number, now = new Date().getFullYear()): number {
  const age = now - year
  if (!Number.isInteger(year) || year < 2004 || !Number.isFinite(age) || age < -1 || age >= ACTIVITY_YEARS) return 0
  return 2 ** (-Math.max(0, age) / 2)
}
