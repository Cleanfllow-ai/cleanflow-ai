/**
 * Trigger a file download in the current tab without opening a new window.
 *
 * Same-origin URLs (blob:): uses an <a download> click — link.download is
 * honored, no new tab.
 *
 * Cross-origin URLs (S3 presigned): browsers ignore link.download for
 * cross-origin targets, so target="_blank" opens a new tab. A hidden iframe
 * with the presigned URL triggers the download via S3's
 * Content-Disposition: attachment header without any visible navigation
 * or new tab.
 */

export function triggerBlobDownload(blobUrl: string, filename: string): void {
    const link = document.createElement('a')
    link.href = blobUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
}

export function triggerPresignedDownload(url: string): void {
    const iframe = document.createElement('iframe')
    iframe.style.display = 'none'
    iframe.src = url
    document.body.appendChild(iframe)
    // Give the iframe a few seconds to issue the GET; once S3 responds with
    // Content-Disposition: attachment, the browser starts the download and
    // the iframe content is irrelevant. Removing it earlier can cancel.
    setTimeout(() => {
        if (iframe.parentNode) {
            document.body.removeChild(iframe)
        }
    }, 5000)
}
