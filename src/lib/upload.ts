import { supabaseProjectUrl, type FitPlanSupabase } from './supabase'

/** HTTP-Fehler beim Foto-Upload (status 0 = Netzwerk-/Timeout-Fehler). */
export class UploadHttpError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'UploadHttpError'
    this.status = status
  }
}

/**
 * Lädt ein Foto direkt per XHR in den Storage-Bucket hoch und meldet den
 * echten Fortschritt (0–100 %). supabase-js nutzt fetch und bietet dafür
 * kein Progress-Event, deshalb der direkte XMLHttpRequest.
 */
export async function uploadPhotoWithProgress(
  client: FitPlanSupabase,
  bucket: string,
  path: string,
  blob: Blob,
  onProgress: (percent: number) => void,
): Promise<void> {
  if (!supabaseProjectUrl) throw new Error('Supabase ist nicht konfiguriert.')
  const { data, error } = await client.auth.getSession()
  const token = data.session?.access_token
  if (error || !token) throw new UploadHttpError(401, 'Sitzung abgelaufen. Bitte melde dich erneut an.')

  const base = supabaseProjectUrl.replace(/\/$/, '')
  const encodedPath = path.split('/').map(encodeURIComponent).join('/')

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${base}/storage/v1/object/${bucket}/${encodedPath}`)
    xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.setRequestHeader('Content-Type', 'image/jpeg')
    xhr.setRequestHeader('Cache-Control', '3600')
    xhr.timeout = 120_000

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)))
      }
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100)
        resolve()
        return
      }
      let message = `Upload fehlgeschlagen (HTTP ${xhr.status}).`
      try {
        const parsed = JSON.parse(xhr.responseText) as { message?: string; error?: string }
        message = parsed.message ?? parsed.error ?? message
      } catch {
        // Antwort war kein JSON — Standardmeldung behalten.
      }
      reject(new UploadHttpError(xhr.status, message))
    }
    xhr.onerror = () => reject(new UploadHttpError(0, 'Netzwerkfehler beim Upload.'))
    xhr.ontimeout = () => reject(new UploadHttpError(0, 'Upload hat zu lange gedauert (Timeout).'))
    xhr.send(blob)
  })
}
