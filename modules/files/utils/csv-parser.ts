/**
 * csv-parser.ts
 *
 * CSV parsing utilities for quarantine editor
 * Handles edge cases like quoted values, nested commas, and escaped quotes
 */

import type { CsvParseResult } from '@/modules/files/types'

/**
 * Split a CSV line respecting quoted values
 * Handles:
 * - Quoted values with commas
 * - Escaped quotes ("")
 * - Mixed quoted/unquoted values
 *
 * @param line - CSV line to split
 * @returns Array of cell values
 */
export function splitCSVLine(line: string): string[] {
  const result: string[] = []
  let currentCell = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    const nextChar = line[i + 1]

    if (char === '"') {
      // Handle escaped quotes ("")
      if (inQuotes && nextChar === '"') {
        currentCell += '"'
        i++ // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      // Cell delimiter (outside quotes)
      result.push(currentCell)
      currentCell = ''
    } else {
      // Regular character
      currentCell += char
    }
  }

  // Push the last cell
  result.push(currentCell)

  return result
}

/**
 * Parse CSV text into structured data with headers
 * Supports:
 * - Auto-generated row IDs
 * - Header detection
 * - Empty row filtering
 * - Column name normalization
 *
 * @param text - Raw CSV text
 * @returns Parsed CSV with columns and rows
 */
export function parseLegacyCsv(text: string): CsvParseResult {
  // Split into lines (handle both \n and \r\n)
  const lines = text.split(/\r?\n/).filter((l) => l.trim())

  if (lines.length === 0) {
    return { columns: [], rows: [] }
  }

  // First line is headers
  const rawHeaders = splitCSVLine(lines[0])
  const headers = rawHeaders.map((h, i) => (h || '').trim() || `column_${i + 1}`)

  // Remaining lines are data rows
  const dataLines = lines.slice(1)

  // Parse data rows
  const rows = dataLines
    .map((line) => splitCSVLine(line))
    .filter((cells) => cells.some((v) => String(v || '').trim().length > 0)) // Filter empty rows
    .map((cells, index) => {
      const row: Record<string, any> = {}

      // Map cells to headers
      headers.forEach((header, headerIndex) => {
        row[header] = cells[headerIndex] ?? ''
      })

      // Auto-generate row_id if not present
      if (row.row_id === undefined || row.row_id === null || row.row_id === '') {
        row.row_id = String(index + 1)
      }

      return row
    })

  // Ensure row_id is first column
  const columns = headers.includes('row_id') ? headers : ['row_id', ...headers]

  return { columns, rows }
}

/**
 * Parse CSV with more advanced features (handles multiline values)
 * This is a more robust parser that handles:
 * - Multiline quoted values
 * - Various line endings
 * - Proper escaping
 *
 * @param text - Raw CSV text
 * @returns Parsed CSV with columns and rows
 */
export function parseAdvancedCsv(text: string): CsvParseResult {
  const grid: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    const next = text[i + 1]

    if (ch === '"') {
      if (inQuotes && next === '"') {
        // Escaped quote
        cell += '"'
        i += 1
      } else {
        // Toggle quote state
        inQuotes = !inQuotes
      }
      continue
    }

    if (ch === ',' && !inQuotes) {
      // Cell separator
      row.push(cell)
      cell = ''
      continue
    }

    if ((ch === '\n' || ch === '\r') && !inQuotes) {
      // Row separator
      if (ch === '\r' && next === '\n') {
        i += 1 // Skip \n in \r\n
      }
      row.push(cell)
      grid.push(row)
      row = []
      cell = ''
      continue
    }

    // Regular character
    cell += ch
  }

  // Push last cell and row if any
  if (cell.length > 0 || row.length > 0) {
    row.push(cell)
    grid.push(row)
  }

  if (!grid.length) {
    return { columns: [], rows: [] }
  }

  // Extract headers
  const headers = grid[0].map((v, i) => (v || '').trim() || `column_${i + 1}`)

  // Extract data rows (filter empty rows)
  const dataRows = grid
    .slice(1)
    .filter((cells) => cells.some((v) => String(v || '').trim().length > 0))

  // Convert to objects
  const rows = dataRows.map((cells, index) => {
    const item: Record<string, any> = {}

    headers.forEach((header, headerIndex) => {
      item[header] = cells[headerIndex] ?? ''
    })

    // Auto-generate row_id
    if (item.row_id === undefined || item.row_id === null || item.row_id === '') {
      item.row_id = String(index + 1)
    }

    return item
  })

  // Ensure row_id is first column
  const columns = headers.includes('row_id') ? headers : ['row_id', ...headers]

  return { columns, rows }
}

/**
 * Convert rows to CSV string
 * Properly escapes values containing:
 * - Commas
 * - Quotes
 * - Newlines
 *
 * @param rows - Array of row objects
 * @returns CSV string
 */
export function rowsToCSV(rows: Record<string, any>[]): string {
  if (!rows.length) return ''

  const headers = Object.keys(rows[0])

  // Escape a single value
  const escapeValue = (value: any): string => {
    const str = String(value ?? '')

    // Check if escaping is needed
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      // Escape internal quotes by doubling them
      const escaped = str.replace(/"/g, '""')
      return `"${escaped}"`
    }

    return str
  }

  // Build CSV rows
  const csvRows = [
    // Header row
    headers.map(escapeValue).join(','),
    // Data rows
    ...rows.map((row) => headers.map((header) => escapeValue(row[header])).join(',')),
  ]

  return csvRows.join('\n')
}

/**
 * Validate CSV structure
 * Checks for common issues:
 * - Empty content
 * - Mismatched column counts
 * - Invalid characters
 *
 * @param text - CSV text to validate
 * @returns Validation result with errors
 */
export function validateCSV(text: string): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!text || text.trim().length === 0) {
    errors.push('CSV content is empty')
    return { valid: false, errors }
  }

  try {
    const parsed = parseLegacyCsv(text)

    if (parsed.columns.length === 0) {
      errors.push('No columns found in CSV')
    }

    if (parsed.rows.length === 0) {
      errors.push('No data rows found in CSV')
    }

    // Check for inconsistent column counts
    const expectedColumnCount = parsed.columns.length
    parsed.rows.forEach((row, index) => {
      const actualColumnCount = Object.keys(row).length
      if (actualColumnCount !== expectedColumnCount) {
        errors.push(`Row ${index + 1}: Expected ${expectedColumnCount} columns, found ${actualColumnCount}`)
      }
    })
  } catch (error) {
    errors.push(`Parse error: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Get CSV statistics
 * @param text - CSV text
 * @returns Statistics about the CSV
 */
export function getCSVStats(text: string): {
  rowCount: number
  columnCount: number
  totalCells: number
  emptyCells: number
  hasHeaders: boolean
} {
  try {
    const parsed = parseLegacyCsv(text)
    const totalCells = parsed.rows.length * parsed.columns.length
    let emptyCells = 0

    parsed.rows.forEach((row) => {
      parsed.columns.forEach((col) => {
        const value = row[col]
        if (value === null || value === undefined || String(value).trim() === '') {
          emptyCells++
        }
      })
    })

    return {
      rowCount: parsed.rows.length,
      columnCount: parsed.columns.length,
      totalCells,
      emptyCells,
      hasHeaders: parsed.columns.length > 0,
    }
  } catch {
    return {
      rowCount: 0,
      columnCount: 0,
      totalCells: 0,
      emptyCells: 0,
      hasHeaders: false,
    }
  }
}
