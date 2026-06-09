import type { VercelRequest, VercelResponse } from '@vercel/node'
import { Readable } from 'stream'

// Disable body parser so we can stream the raw binary to Bunny
export const config = {
  api: {
    bodyParser:    false,
    responseLimit: false,
  },
  maxDuration: 300, // 5 minutes — handles large video files
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const videoId   = req.query.videoId as string
  const libraryId = process.env.VITE_BUNNY_LIBRARY_ID
  const apiKey    = process.env.BUNNY_API_KEY

  if (!videoId) {
    return res.status(400).json({ error: 'videoId is required' })
  }
  if (!libraryId || !apiKey) {
    return res.status(500).json({ error: 'Bunny credentials not configured' })
  }

  try {
    // Convert Node.js IncomingMessage to a Web API ReadableStream
    // so we can pipe it directly into fetch without buffering
    const webStream = Readable.toWeb(req as any) as ReadableStream

    const headers: Record<string, string> = {
      'AccessKey': apiKey,
    }

    // Forward Content-Length so Bunny knows total file size
    const contentLength = req.headers['content-length']
    if (contentLength) headers['Content-Length'] = contentLength

    const bunnyRes = await fetch(
      `https://video.bunnycdn.com/library/${libraryId}/videos/${videoId}`,
      {
        method: 'PUT',
        headers,
        body:   webStream,
        // Required in Node 18+ when using a ReadableStream as the request body
        // @ts-ignore
        duplex: 'half',
      }
    )

    if (!bunnyRes.ok) {
      const text = await bunnyRes.text()
      console.error('Bunny upload error:', bunnyRes.status, text)
      return res.status(500).json({ error: 'Upload to Bunny failed', details: text })
    }

    return res.status(200).json({ success: true, videoId })

  } catch (err) {
    console.error('bunny-upload-video error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
