import type { Metadata } from 'next'
import { StartClient } from './start-client.tsx'

export const metadata: Metadata = {
  title: 'Start',
  description: 'Connect YouTube, Google Takeout, Spotify, Reddit or GitHub, answer a short questionnaire, and see which fields of study fit you.',
  alternates: { canonical: '/start' },
}

export default function Start() {
  return <StartClient />
}
