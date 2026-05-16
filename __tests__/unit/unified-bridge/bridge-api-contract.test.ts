/**
 * Contract tests for unified-bridge ingestion API
 * Asserts: URL shape, HTTP method, body shape, Authorization header presence,
 *          INGEST_* error code propagation from the API layer
 */

// Override fetch globally before module loads
const mockFetch = jest.fn()
;(globalThis as any).fetch = mockFetch

import {
  ingestFromFtp,
  ingestFromHttp,
  ingestFromTcp,
  testFtpConnection,
  testHttpEndpoint,
} from '@/modules/files/api/file-ingestion-api'
import type {
  FtpIngestionConfig,
  HttpIngestionConfig,
  TcpIngestionConfig,
} from '@/modules/files/api/file-ingestion-api'

const API_BASE = 'https://test.example.com/prod'
const TOKEN = 'bearer-test-token'

function mockSuccess(data: object) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => data,
  } as any)
}

function mockFailure(status: number, errorBody: object) {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    statusText: 'Error',
    json: async () => errorBody,
  } as any)
}

beforeEach(() => jest.clearAllMocks())

describe('ingestFromFtp — URL + body contract', () => {
  const ftpConfig: FtpIngestionConfig = {
    host: 'ftp.example.com',
    port: 21,
    protocol: 'ftp',
    username: 'user',
    password: 'pass',
    remote_path: '/data/file.csv',
    filename: 'file.csv',
  }

  it('POSTs to /unified-bridge/ftp/ingest with correct Authorization header', async () => {
    mockSuccess({ upload_id: 'u1', filename: 'file.csv', size_bytes: 100 })
    await ingestFromFtp(ftpConfig, TOKEN)
    const [url, opts] = mockFetch.mock.calls[0]
    expect(url).toContain('/unified-bridge/ftp/ingest')
    expect(opts.method).toBe('POST')
    expect(opts.headers['Authorization']).toBe(`Bearer ${TOKEN}`)
  })

  it('serialises protocol + host + port in the request body', async () => {
    mockSuccess({ upload_id: 'u1', filename: 'file.csv', size_bytes: 100 })
    await ingestFromFtp(ftpConfig, TOKEN)
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.host).toBe('ftp.example.com')
    expect(body.port).toBe(21)
    expect(body.protocol).toBe('ftp')
  })

  it('throws with error message from JSON body on non-2xx (INGEST_FTP_FAILED)', async () => {
    mockFailure(502, { error: 'INGEST_FTP_FAILED: host unreachable' })
    await expect(ingestFromFtp(ftpConfig, TOKEN)).rejects.toThrow('INGEST_FTP_FAILED')
  })

  it('serialises ssh_key auth when provided', async () => {
    const sshConfig: FtpIngestionConfig = {
      ...ftpConfig,
      protocol: 'sftp',
      auth: { type: 'ssh_key', private_key: '-----BEGIN RSA...', key_passphrase: 'secret' },
    }
    mockSuccess({ upload_id: 'u2', filename: 'file.csv', size_bytes: 200 })
    await ingestFromFtp(sshConfig, TOKEN)
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.auth?.type).toBe('ssh_key')
    expect(body.auth?.private_key).toBe('-----BEGIN RSA...')
  })
})

describe('ingestFromHttp — URL + body contract', () => {
  const httpConfig: HttpIngestionConfig = {
    url: 'https://api.example.com/export',
    method: 'GET',
    filename: 'export.csv',
  }

  it('POSTs to /unified-bridge/http/ingest with correct Authorization header', async () => {
    mockSuccess({ upload_id: 'u3', filename: 'export.csv', size_bytes: 512 })
    await ingestFromHttp(httpConfig, TOKEN)
    const [url, opts] = mockFetch.mock.calls[0]
    expect(url).toContain('/unified-bridge/http/ingest')
    expect(opts.method).toBe('POST')
    expect(opts.headers['Authorization']).toBe(`Bearer ${TOKEN}`)
  })

  it('includes url + method + filename in the request body', async () => {
    mockSuccess({ upload_id: 'u3', filename: 'export.csv', size_bytes: 512 })
    await ingestFromHttp(httpConfig, TOKEN)
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.url).toBe('https://api.example.com/export')
    expect(body.method).toBe('GET')
    expect(body.filename).toBe('export.csv')
  })

  it('throws with INGEST_HTTP_FAILED error code on 403', async () => {
    mockFailure(403, { error: 'INGEST_HTTP_FAILED: 403 Forbidden' })
    await expect(ingestFromHttp(httpConfig, TOKEN)).rejects.toThrow('INGEST_HTTP_FAILED')
  })
})

describe('ingestFromTcp — URL + body contract', () => {
  const tcpConfig: TcpIngestionConfig = {
    host: 'tcp.example.com',
    port: 9000,
    filename: 'stream.csv',
  }

  it('POSTs to /unified-bridge/tcp/ingest', async () => {
    mockSuccess({ upload_id: 'u4', filename: 'stream.csv', size_bytes: 256 })
    await ingestFromTcp(tcpConfig, TOKEN)
    const [url] = mockFetch.mock.calls[0]
    expect(url).toContain('/unified-bridge/tcp/ingest')
  })

  it('includes host + port in the request body', async () => {
    mockSuccess({ upload_id: 'u4', filename: 'stream.csv', size_bytes: 256 })
    await ingestFromTcp(tcpConfig, TOKEN)
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.host).toBe('tcp.example.com')
    expect(body.port).toBe(9000)
  })

  it('throws with error message on non-2xx (INGEST_TCP_FAILED)', async () => {
    mockFailure(500, { error: 'INGEST_TCP_FAILED: timeout' })
    await expect(ingestFromTcp(tcpConfig, TOKEN)).rejects.toThrow('INGEST_TCP_FAILED')
  })
})

describe('validateFtpConfig (client-side, no fetch)', () => {
  it('returns success:false when host is missing', async () => {
    const result = await testFtpConnection({ protocol: 'ftp', remote_path: '/data', port: 21 } as any)
    expect(result.success).toBe(false)
  })

  it('returns success:true when host + remote_path provided', async () => {
    const result = await testFtpConnection({ host: 'ftp.example.com', protocol: 'ftp', remote_path: '/data' } as any)
    expect(result.success).toBe(true)
  })
})

describe('testHttpEndpoint (client-side URL validation, no fetch)', () => {
  it('returns success:false for empty URL', async () => {
    const result = await testHttpEndpoint({ url: '' } as any)
    expect(result.success).toBe(false)
  })

  it('returns success:true for a valid URL', async () => {
    const result = await testHttpEndpoint({ url: 'https://api.example.com/data' } as any)
    expect(result.success).toBe(true)
  })

  it('returns success:false for a malformed URL', async () => {
    const result = await testHttpEndpoint({ url: 'not-a-url' } as any)
    expect(result.success).toBe(false)
  })
})
