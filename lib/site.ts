export const SITE_NAME = 'whatshouldistudy'
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://whatshouldistudy.com').replace(/\/$/, '')
export const TAGLINE = 'Find your field from what you actually watch, read and build'
export const DESCRIPTION =
  'whatshouldistudy reads thousands of signals from your YouTube, Spotify, Reddit and GitHub, adds a 5-minute validated questionnaire, and matches you to fields of study and real programmes in the US, UK, Europe and worldwide. Your data never leaves your browser.'
export const CONTACT = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? 'hello@whatshouldistudy.com'
