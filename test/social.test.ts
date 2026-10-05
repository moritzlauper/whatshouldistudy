import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readTexts } from '../lib/sources/exports.ts'

test('reads an Instagram download in the old and the new format', async () => {
  const topics = { topics_your_topics: [{ string_map_data: { Name: { value: 'Astronomy' } } }, { string_map_data: { Name: { value: 'Physics' } } }] }
  const following = { relationships_following: [{ title: '', string_list_data: [{ href: 'https://www.instagram.com/nasa', value: 'nasa', timestamp: 1700000000 }] }] }
  const liked = {
    likes_media_likes: [
      { timestamp: 1700000100, label_values: [{ label: 'URL', value: 'https://www.instagram.com/p/x/' }, { title: 'Owner', dict: [{ dict: [{ label: 'Username', value: 'esa' }] }] }] },
    ],
  }
  const searches = { searches_keyword: [{ string_map_data: { Suche: { value: 'black holes' }, Zeit: { timestamp: 1700000200 } } }] }
  const r = await readTexts([
    { name: 'preferences/your_topics/your_topics.json', text: JSON.stringify(topics) },
    { name: 'connections/followers_and_following/following.json', text: JSON.stringify(following) },
    { name: 'your_instagram_activity/likes/liked_posts.json', text: JSON.stringify(liked) },
    { name: 'logged_information/recent_searches/word_or_phrase_searches.json', text: JSON.stringify(searches) },
  ])
  const s = r.summaries.find((x) => x.source === 'instagram')!
  assert.ok(s, 'instagram summary')
  assert.equal(s.stats.topics, 2)
  assert.equal(s.stats.following, 1)
  assert.equal(s.stats.likes, 1)
  assert.equal(s.stats.searches, 1)
  assert.ok(s.fields.astronomy.score > 0)
  assert.equal(r.recognised.length, 4)
})

test('reads a TikTok download and skips direct messages', async () => {
  const data = {
    'Your Activity': {
      Searches: { SearchList: [{ Date: '2024-05-01 18:00:00', SearchTerm: 'how do vaccines work' }] },
      Following: { Following: [{ Date: '2024-05-01 18:00:00', UserName: 'chemistry_with_lisa' }] },
      Follower: { FansList: [{ Date: '2024-05-01 18:00:00', UserName: 'someone_else' }] },
      Hashtag: { HashtagList: [{ HashtagName: 'medschool', HashtagLink: '' }] },
      'Watch History': { VideoList: [{ Date: '2024-05-01 18:00:00', Link: 'https://www.tiktokv.com/share/video/1/' }] },
    },
    'Direct Message': { 'Direct Messages': { ChatHistory: { x: [{ Date: '2024-05-01', From: 'a', Content: 'secret study plans' }] } } },
  }
  const r = await readTexts([{ name: 'user_data_tiktok.json', text: JSON.stringify(data) }])
  const s = r.summaries.find((x) => x.source === 'tiktok')!
  assert.ok(s, 'tiktok summary')
  assert.equal(s.stats.entries, 3)
  assert.equal(s.stats.watchedVideos, 1)
  assert.ok(!JSON.stringify(s).includes('secret'))
  assert.ok(!JSON.stringify(s).includes('someone_else'))
})

test('reads TikTok TXT searches', async () => {
  const text = 'Date: 2024-05-01 18:00:00\nSearch Term: quantum computing explained\n\nDate: 2024-05-02 18:00:00\nSearch Term: neural networks\n'
  const r = await readTexts([{ name: 'Searches.txt', text }])
  const s = r.summaries.find((x) => x.source === 'tiktok')!
  assert.equal(s.stats.entries, 2)
})
