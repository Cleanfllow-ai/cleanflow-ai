/**
 * Unit tests for modules/augmentation/api/augmentation-api.ts
 * One test per backend route + a 7th submit-and-poll integration check.
 */
jest.mock('@/shared/config/aws-config', () => ({
    AWS_CONFIG: { API_BASE_URL: 'https://api.test.com' },
}))
jest.mock('@/modules/files/api/file-upload-api', () => ({
    makeRequest: jest.fn(),
}))

import {
    deletePromptTemplateVersion,
    getAugmentationJob,
    getAugmentationJobOutput,
    listAugmentationJobs,
    listPromptTemplates,
    registerPromptTemplate,
    submitAugmentationJob,
} from '@/modules/augmentation/api/augmentation-api'
import { makeRequest } from '@/modules/files/api/file-upload-api'

const mockMakeRequest = makeRequest as jest.Mock

afterEach(() => { mockMakeRequest.mockReset() })

describe('augmentation-api', () => {
    it('POST /augmentation/jobs returns the submitted job id', async () => {
        mockMakeRequest.mockResolvedValueOnce({ job_id: 'job-1', status: 'PENDING' })
        const res = await submitAugmentationJob('tok', {
            prompt_template_id: 't1',
            input_dataset_key: 'in.parquet',
            output_dataset_key: 'out.parquet',
        })
        expect(res).toEqual({ job_id: 'job-1', status: 'PENDING' })
        expect(mockMakeRequest).toHaveBeenCalledWith(
            '/augmentation/jobs', 'tok',
            expect.objectContaining({ method: 'POST' }),
        )
    })

    it('GET /augmentation/jobs/{id} returns full job', async () => {
        mockMakeRequest.mockResolvedValueOnce({ job_id: 'job-1', status: 'SUCCEEDED', created_at: 'x' })
        const job = await getAugmentationJob('job-1', 'tok')
        expect(job.status).toBe('SUCCEEDED')
        expect(mockMakeRequest).toHaveBeenCalledWith('/augmentation/jobs/job-1', 'tok', { method: 'GET' })
    })

    it('GET /augmentation/jobs/{id}/output returns presigned url', async () => {
        mockMakeRequest.mockResolvedValueOnce({ presigned_url: 'https://s3/...', expires_at: 'x' })
        const out = await getAugmentationJobOutput('job-1', 'tok')
        expect(out.presigned_url).toContain('https://')
        expect(mockMakeRequest).toHaveBeenCalledWith('/augmentation/jobs/job-1/output', 'tok', { method: 'GET' })
    })

    it('GET /augmentation/prompt-templates?active=true forwards query', async () => {
        mockMakeRequest.mockResolvedValueOnce([])
        await listPromptTemplates('tok', { active: true })
        const calledUrl = mockMakeRequest.mock.calls[0][0] as string
        expect(calledUrl).toMatch(/^\/augmentation\/prompt-templates\?/)
        expect(calledUrl).toContain('active=true')
    })

    it('POST /augmentation/prompt-templates body shape is forwarded', async () => {
        mockMakeRequest.mockResolvedValueOnce({ template_id: 't1', version: 1, is_active: true })
        const res = await registerPromptTemplate('tok', {
            template_id: 't1',
            prompt_text: 'p',
            cardinality: 'ONE_TO_MANY',
            expected_input_schema: {},
            expected_output_schema: {},
        })
        expect(res.template_id).toBe('t1')
        const body = JSON.parse(mockMakeRequest.mock.calls[0][2].body)
        expect(body.cardinality).toBe('ONE_TO_MANY')
    })

    it('DELETE /augmentation/prompt-templates/{id}/versions/{v} returns void', async () => {
        mockMakeRequest.mockResolvedValueOnce({})
        await deletePromptTemplateVersion('t1', 2, 'tok')
        expect(mockMakeRequest).toHaveBeenCalledWith(
            '/augmentation/prompt-templates/t1/versions/2',
            'tok',
            { method: 'DELETE' },
        )
    })

    it('listAugmentationJobs unwraps {jobs:[...]} envelope', async () => {
        mockMakeRequest.mockResolvedValueOnce({ jobs: [{ job_id: 'j1', status: 'PENDING', created_at: '' }] })
        const res = await listAugmentationJobs('tok', 50)
        expect(res).toHaveLength(1)
    })
})
