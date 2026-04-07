export type DataDownloadType = 'raw' | 'original' | 'all' | 'clean' | 'quarantine'

const PREFIX_BY_TYPE: Record<DataDownloadType, string> = {
  raw: 'original',
  original: 'original',
  all: 'processed',
  clean: 'clean',
  quarantine: 'quarantined',
}

export function stripExtension(filename: string | undefined | null): string {
  const value = (filename || 'file').trim()
  return value.replace(/\.[^/.]+$/, '')
}

export function sanitizeFilenamePart(value: string | undefined | null): string {
  return (value || '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export function buildPrefixedDataFilename(options: {
  sourceName?: string | null
  dataType: DataDownloadType
  extension: string
  versionNumber?: number | null
  tags?: Array<string | null | undefined>
}): string {
  const extension = options.extension.startsWith('.') ? options.extension : `.${options.extension}`
  const prefix = PREFIX_BY_TYPE[options.dataType]
  let base = sanitizeFilenamePart(stripExtension(options.sourceName))
  if (base.startsWith(`${prefix}_`)) {
    base = base.slice(prefix.length + 1)
  }
  const parts = [prefix, base || 'file']

  if (options.versionNumber != null) {
    parts.push(`v${options.versionNumber}`)
  }

  for (const tag of options.tags || []) {
    const normalized = sanitizeFilenamePart(tag)
    if (normalized) {
      parts.push(normalized)
    }
  }

  return `${parts.join('_')}${extension}`
}
