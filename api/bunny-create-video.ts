import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { title, type } = req.body as { title: string; type: string }

  if (!title?.trim()) {
    return res.status(400).json({ error: 'Title is required' })
  }

  const libraryId = process.env.VITE_BUNNY_LIBRARY_ID
  const apiKey    = process.env.BUNNY_API_KEY

  if (!libraryId || !apiKey) {
    return res.status(500).json({ error: 'Bunny credentials not configured' })
  }

  try {
    const response = await fetch(
      `https://video.bunnycdn.com/library/${libraryId}/videos`,
      {
        method:  'POST',
        headers: {
          'AccessKey':    apiKey,
          'Content-Type': 'application/json',
          'Accept':       'application/json',
        },
        body: JSON.stringify({
          title: title.trim(),
          // Optionally tag the video type in Bunny's meta
          metaTags: [{ property: 'type', value: type || 'general' }],
        }),
      }
    )

    if (!response.ok) {
      const text = await response.text()
      console.error('Bunny create video error:', response.status, text)
      return res.status(500).json({ error: 'Failed to create video in Bunny', details: text })
    }

    const data = await response.json()
    return res.status(200).json({ videoId: data.guid })

  } catch (err) {
    console.error('bunny-create-video error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
