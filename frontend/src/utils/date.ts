function ordinalSuffix(day: number): string {
  if (day >= 11 && day <= 13) return 'th'
  switch (day % 10) {
    case 1:
      return 'st'
    case 2:
      return 'nd'
    case 3:
      return 'rd'
    default:
      return 'th'
  }
}

/** "2026-03-22T00:00:00Z" -> "March 22nd 2026" */
export function formatOrdinalDate(dateString: string): string {
  const date = new Date(dateString)
  const month = date.toLocaleDateString(undefined, { month: 'long' })
  const day = date.getDate()
  return `${month} ${day}${ordinalSuffix(day)} ${date.getFullYear()}`
}
