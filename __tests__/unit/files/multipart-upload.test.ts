/**
 * Phase 2 - multipart-upload.ts `getChunkSize` tests.
 * Target: modules/files/api/multipart-upload.ts
 *
 * getChunkSize picks the S3 multipart upload part size based on file size.
 * Rules (from the source):
 *  - Files <= 100 MB -> single chunk equal to fileSize
 *  - Files > 100 MB  -> max(100 MB, ceil(fileSize / 9999))
 *    (the /9999 guard keeps part count <= S3's 10,000-part ceiling)
 */
import { getChunkSize } from "@/modules/files/api/multipart-upload";

const MB = 1024 * 1024;
const GB = 1024 * MB;
const THRESHOLD = 100 * MB;

describe("getChunkSize - small files (<= 100 MB)", () => {
  it("returns 0 for an empty file", () => {
    expect(getChunkSize(0)).toBe(0);
  });

  it("returns fileSize for a 1 MB file", () => {
    expect(getChunkSize(MB)).toBe(MB);
  });

  it("returns fileSize at the 100 MB boundary exactly", () => {
    expect(getChunkSize(THRESHOLD)).toBe(THRESHOLD);
  });

  it("returns fileSize for a 50 MB file (single-chunk path)", () => {
    expect(getChunkSize(50 * MB)).toBe(50 * MB);
  });
});

describe("getChunkSize - multipart files (> 100 MB)", () => {
  it("uses 100 MB parts for a 200 MB file", () => {
    // 200 MB > THRESHOLD; ceil(200MB/9999) << 100MB, so max picks 100MB
    expect(getChunkSize(200 * MB)).toBe(100 * MB);
  });

  it("uses 100 MB parts for a 1 GB file", () => {
    expect(getChunkSize(GB)).toBe(100 * MB);
  });

  it("keeps part count under 10 000 for very large files", () => {
    // 10 TB file - aggressive test. The /9999 guard should make parts bigger
    // than 100 MB so that count stays under 10,000.
    const fileSize = 10 * 1024 * GB;
    const chunk = getChunkSize(fileSize);
    const partCount = Math.ceil(fileSize / chunk);
    expect(partCount).toBeLessThanOrEqual(10_000);
  });

  it("returns at least the MIN_PART_SIZE floor (100 MB) for > threshold files", () => {
    expect(getChunkSize(THRESHOLD + 1)).toBeGreaterThanOrEqual(100 * MB);
  });
});
