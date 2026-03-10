import type { FileStatusResponse } from '@/modules/files/types'

/**
 * Format file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
}

/**
 * Format date in human-readable format with IST timing
 */
export function formatDate(dateString: string): string {
  // Parse the UTC date string
  const date = new Date(dateString)
  const now = new Date()
  
  // Convert both to IST for comparison
  const nowIST = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
  const dateIST = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
  
  const diffMs = nowIST.getTime() - dateIST.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  
  // Show full IST time for older dates
  return date.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }) + ' IST'
}

/**
 * Get status color class for file status
 */
export function getStatusColor(status: string): string {
  switch (status) {
    // Success states - Green
    case 'DQ_FIXED':
    case 'COMPLETED':
      return 'bg-green-500/20 text-green-400 border-green-500/30'
    
    // Active processing - Yellow
    case 'DQ_RUNNING':
    case 'NORMALIZING':
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
    
    // Queued/Dispatched - Orange
    case 'DQ_DISPATCHED':
    case 'QUEUED':
      return 'bg-orange-500/20 text-orange-400 border-orange-500/30'
    
    // Initial states - Blue
    case 'UPLOADED':
    case 'VALIDATED':
    case 'UPLOADING':
      return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
    
    // Error states - Red
    case 'DQ_FAILED':
    case 'FAILED':
    case 'REJECTED':
      return 'bg-red-500/20 text-red-400 border-red-500/30'
    
    // Unknown/Default - Gray
    default:
      return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
  }
}

/**
 * Get status display name
 */
export function getStatusDisplayName(status: string): string {
  const names: Record<string, string> = {
    'UPLOADED': 'Uploaded',
    'QUEUED': 'Queued',
    'DQ_RUNNING': 'Processing',
    'NORMALIZING': 'Normalizing',
    'DQ_FIXED': 'Completed',
    'DQ_FAILED': 'Failed',
    'FAILED': 'Failed',
    'COMPLETED': 'Completed'
  }
  return names[status] || status
}

/**
 * Convert file data to CSV format
 */
export function convertToCSV(data: { headers: string[]; rows: Record<string, any>[] }): string {
  if (!data || !data.headers || !data.rows) {
    console.error('Invalid data for CSV conversion:', { hasHeaders: !!data?.headers, hasRows: !!data?.rows })
    return ''
  }
  
  if (data.headers.length === 0 || data.rows.length === 0) {
    console.warn('Empty data for CSV conversion')
    return data.headers.join(',')
  }
  
  try {
    const csvContent = [
      data.headers.join(','),
      ...data.rows.map(row => 
        data.headers.map(header => {
          const value = row[header]
          if (value === null || value === undefined) return ''
          
          const stringValue = String(value)
          // Escape commas, quotes, and newlines in CSV
          if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
            return `"${stringValue.replace(/"/g, '""')}"`
          }
          return stringValue
        }).join(',')
      )
    ].join('\n')
    
    return csvContent
  } catch (error) {
    console.error('Error converting to CSV:', error)
    throw error
  }
}

/**
 * Convert file data to JSON format
 */
export function convertToJSON(data: { rows: Record<string, any>[] }): string {
  if (!data || !data.rows) {
    console.error('Invalid data for JSON conversion:', { hasRows: !!data?.rows })
    return '[]'
  }
  
  try {
    return JSON.stringify(data.rows, null, 2)
  } catch (error) {
    console.error('Error converting to JSON:', error)
    throw error
  }
}

/**
 * Download blob as file
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Download file data in specific format
 */
export function downloadFileData(
  fileData: { headers: string[]; rows: Record<string, any>[] },
  filename: string,
  format: 'csv' | 'json' | 'excel'
): void {
  if (!fileData || !fileData.rows || fileData.rows.length === 0) {
    throw new Error('No data available to download')
  }

  const baseFilename = filename.replace(/\.[^/.]+$/, '')
  
  try {
    switch (format) {
      case 'csv': {
        const csvContent = convertToCSV(fileData)
        if (!csvContent) {
          throw new Error('Failed to convert to CSV')
        }
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        downloadBlob(blob, `${baseFilename}_processed.csv`)
        break
      }
      
      case 'json': {
        const jsonContent = convertToJSON(fileData)
        if (!jsonContent || jsonContent === '[]') {
          throw new Error('Failed to convert to JSON')
        }
        const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' })
        downloadBlob(blob, `${baseFilename}_processed.json`)
        break
      }
      
      case 'excel': {
        // For Excel, download as CSV with .xlsx extension
        // In production, use a library like xlsx for proper Excel files
        const excelContent = convertToCSV(fileData)
        if (!excelContent) {
          throw new Error('Failed to convert to Excel format')
        }
        const blob = new Blob([excelContent], { 
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
        })
        downloadBlob(blob, `${baseFilename}_processed.xlsx`)
        break
      }
      
      default:
        throw new Error(`Unsupported format: ${format}`)
    }
  } catch (error) {
    console.error('Download error:', error)
    throw error
  }
}

/**
 * Calculate analytics from files
 */
export function calculateFileAnalytics(files: FileStatusResponse[]) {
  const completedFiles = files.filter(f => f.status === 'DQ_FIXED')
  const processingFiles = files.filter(f => ['DQ_RUNNING', 'NORMALIZING', 'QUEUED', 'UPLOADING'].includes(f.status))
  const failedFiles = files.filter(f => ['DQ_FAILED', 'FAILED'].includes(f.status))
  
  const avgDqScore = completedFiles.length > 0 
    ? completedFiles.reduce((sum, f) => sum + (f.dq_score || 0), 0) / completedFiles.length 
    : 0
    
  const totalRowsProcessed = completedFiles.reduce((sum, f) => sum + (f.rows_out || 0), 0)
  const totalRowsIn = completedFiles.reduce((sum, f) => sum + (f.rows_in || 0), 0)
  const totalQuarantined = completedFiles.reduce((sum, f) => sum + (f.rows_quarantined || 0), 0)
  
  // Collect all DQ issues
  const allIssues = completedFiles.flatMap(f => f.dq_issues || [])
  const issueCount: Record<string, number> = {}
  allIssues.forEach(issue => {
    issueCount[issue] = (issueCount[issue] || 0) + 1
  })
  
  const topIssues = Object.entries(issueCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([issue, count]) => ({
      issue: issue.replace(/_/g, ' '),
      count,
      severity: issue.includes('duplicate_primary_key') || issue.includes('invalid_calendar_date') ? 'Fatal' :
                issue.includes('missing_required') || issue.includes('schema_drift') ? 'High' : 'Medium'
    }))
  
  return {
    totalFiles: files.length,
    completedFiles: completedFiles.length,
    processingFiles: processingFiles.length,
    failedFiles: failedFiles.length,
    avgDqScore: Math.round(avgDqScore * 10) / 10,
    totalRowsProcessed,
    totalRowsIn,
    totalQuarantined,
    quarantineRate: totalRowsIn > 0 ? Math.round((totalQuarantined / totalRowsIn) * 100 * 10) / 10 : 0,
    topIssues
  }
}
