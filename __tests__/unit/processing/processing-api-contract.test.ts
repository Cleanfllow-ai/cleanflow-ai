/**
 * Unit tests for processing API contract
 * Covers: URL shapes, request body structure, method assertions
 */
jest.mock('@/shared/config/aws-config', () => ({
  AWS_CONFIG: { API_BASE_URL: 'https://api.test.com' },
}))

jest.mock('@/modules/shared/auth-token-bridge', () => ({
  getValidTokenAsync: jest.fn().mockResolvedValue('tok-refreshed'),
}))

import {
  getFileStatus,
  getFileColumns,
  startProcessing,
  suggestCustomRule,
  suggestCrossColumnRule,
} from '@/modules/files/api/file-upload-api'

const UPLOAD_ID = 'upload-abc-123'
const TOKEN = 'Bearer test-token'

function mockFetch(body: object, status = 200) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status,
    json: () => Promise.resolve(body),
    headers: { get: () => null },
  } as any)
}

afterEach(() => jest.resetAllMocks())

describe('getFileStatus — URL contract', () => {
  it('calls GET /files/{id}/status with auth header', async () => {
    mockFetch({ status: 'DQ_FIXED' })
    await getFileStatus(UPLOAD_ID, TOKEN)
    const [url, opts] = (global.fetch as jest.Mock).mock.calls[0]
    expect(url).toBe(`https://api.test.com/files/${UPLOAD_ID}/status`)
    expect(opts.method).toBe('GET')
    expect(opts.headers['Authorization']).toBe(`Bearer ${TOKEN}`)
  })
})

describe('getFileColumns — URL contract', () => {
  it('calls GET /files/{id}/columns', async () => {
    mockFetch({ columns: ['col_a', 'col_b'] })
    await getFileColumns(UPLOAD_ID, TOKEN)
    const [url, opts] = (global.fetch as jest.Mock).mock.calls[0]
    expect(url).toBe(`https://api.test.com/files/${UPLOAD_ID}/columns`)
    expect(opts.method).toBe('GET')
  })
})

describe('startProcessing — URL + body contract', () => {
  it('calls POST /files/{id}/process with no body when no options', async () => {
    mockFetch({ ok: true })
    await startProcessing(UPLOAD_ID, TOKEN)
    const [url, opts] = (global.fetch as jest.Mock).mock.calls[0]
    expect(url).toBe(`https://api.test.com/files/${UPLOAD_ID}/process`)
    expect(opts.method).toBe('POST')
    expect(opts.body).toBeUndefined()
  })

  it('includes selected_columns and custom_rules in body', async () => {
    mockFetch({ ok: true })
    await startProcessing(UPLOAD_ID, TOKEN, {
      selected_columns: ['col_a', 'col_b'],
      custom_rules: [{ rule_id: 'CUST_1', rule_name: 'My Rule', column: 'col_a', code: 'return True' } as any],
    })
    const [, opts] = (global.fetch as jest.Mock).mock.calls[0]
    const body = JSON.parse(opts.body)
    expect(body.selected_columns).toEqual(['col_a', 'col_b'])
    expect(body.custom_rules).toHaveLength(1)
    expect(body.custom_rules[0].rule_id).toBe('CUST_1')
  })

  it('includes column_type_overrides when provided', async () => {
    mockFetch({ ok: true })
    await startProcessing(UPLOAD_ID, TOKEN, {
      column_type_overrides: {
        amount: { core_type: 'decimal', key_type: 'none', nullable: true } as any,
      },
    })
    const [, opts] = (global.fetch as jest.Mock).mock.calls[0]
    const body = JSON.parse(opts.body)
    expect(body.column_type_overrides.amount.core_type).toBe('decimal')
  })

  it('includes cross_field_rules when provided', async () => {
    mockFetch({ ok: true })
    await startProcessing(UPLOAD_ID, TOKEN, {
      cross_field_rules: [{ rule_id: 'col_ref_integrity', cols: ['a', 'b'], predicate: 'a < b' } as any],
    })
    const [, opts] = (global.fetch as jest.Mock).mock.calls[0]
    const body = JSON.parse(opts.body)
    expect(body.cross_field_rules).toHaveLength(1)
    expect(body.cross_field_rules[0].rule_id).toBe('col_ref_integrity')
  })
})

describe('suggestCustomRule — URL + body contract', () => {
  it('calls POST /files/{id}/custom-rule-suggest with column + prompt', async () => {
    mockFetch({ suggestion: { rule_id: 'CUST_1', rule_name: 'x' } })
    await suggestCustomRule(UPLOAD_ID, TOKEN, { column: 'email_col', prompt: 'must be valid email' })
    const [url, opts] = (global.fetch as jest.Mock).mock.calls[0]
    expect(url).toBe(`https://api.test.com/files/${UPLOAD_ID}/custom-rule-suggest`)
    expect(opts.method).toBe('POST')
    const body = JSON.parse(opts.body)
    expect(body.column).toBe('email_col')
    expect(body.prompt).toBe('must be valid email')
  })
})

describe('suggestCrossColumnRule — URL + body contract', () => {
  it('calls POST /files/{id}/cross-rule-suggest with prompt + columns', async () => {
    mockFetch({ rules: [] })
    await suggestCrossColumnRule(UPLOAD_ID, TOKEN, {
      prompt: '@start_date must be before @end_date',
      columns: ['start_date', 'end_date'],
    })
    const [url, opts] = (global.fetch as jest.Mock).mock.calls[0]
    expect(url).toBe(`https://api.test.com/files/${UPLOAD_ID}/cross-rule-suggest`)
    expect(opts.method).toBe('POST')
    const body = JSON.parse(opts.body)
    expect(body.prompt).toContain('start_date')
    expect(body.columns).toEqual(['start_date', 'end_date'])
  })

  it('passes rule_scope for cross-row rules', async () => {
    mockFetch({ rules: [] })
    await suggestCrossColumnRule(UPLOAD_ID, TOKEN, {
      prompt: 'Legal entity same per order',
      rule_scope: 'cross_row',
    })
    const [, opts] = (global.fetch as jest.Mock).mock.calls[0]
    const body = JSON.parse(opts.body)
    expect(body.rule_scope).toBe('cross_row')
  })
})
