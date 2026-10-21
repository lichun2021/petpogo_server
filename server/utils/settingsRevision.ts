import crypto from 'node:crypto'

export function settingsRevision(rows: Array<{ key: string; value: unknown }>): string {
  const entries = rows.map(row => [row.key, String(row.value ?? '')]).sort((a, b) => a[0]!.localeCompare(b[0]!, 'en'))
  return crypto.createHash('sha256').update(JSON.stringify(entries)).digest('hex')
}
