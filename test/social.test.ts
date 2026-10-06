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

test('reads the HTML version of an Instagram download', async () => {
  const box = (inner: string) => `<div class="pam _3-95 _2ph- _a6-g uiBoxWhite noborder">${inner}</div>`
  const post = (caption: string, user: string, tags: string[], date: string) =>
    box(
      `<div class="_3-95 _a6-p">${box(`<div class="_a6-p"><table style="table-layout: fixed;"><tr><td colspan="2" class="_a6_q">URL<div><a target="_blank" href="https://www.instagram.com/reel/x/">https://www.instagram.com/reel/x/</a></div></td></tr><tr><td class="_a6_q">Caption</td><td class="_2piu _a6_r">${caption}</td></tr><tr><td colspan="2" class="_a6_q"><div>${box(`<h2 class="_3-95 _2pim _a6-h _a6-i">Hashtags</h2><div class="_a6-p"><div><div class="_2ph_ _a6_q">Name</div>${tags.map((t) => box(`<div class="_a6-p">${t}</div>`)).join('')}</div></div>`)}${box(`<h2 class="_3-95 _2pim _a6-h _a6-i">Owner</h2><div class="_a6-p"><table><tr><td class="_a6_q">Username</td><td class="_2piu _a6_r">${user}</td></tr></table></div>`)}</div></td></tr></table></div>`)}</div><div class="_3-94 _a6-o">${date}</div>`,
    )
  const watched = `<html><body><main class="_a706" role="main">${post('How black holes bend light', 'astro.daily', ['astronomy', 'physics'], 'Oct 04, 2026 12:49 pm')}${post('Orbital mechanics in 60 seconds', 'space.facts', ['space'], 'Oct 03, 2026 9:10 am')}</main></body></html>`
  const following = `<html><body><main class="_a706" role="main">${box('<h2 class="_3-95 _2pim _a6-h _a6-i">nasa</h2><div class="_a6-p"><div><div><a target="_blank" href="https://www.instagram.com/_u/nasa">https://www.instagram.com/_u/nasa</a></div><div>Oct 05, 2026 7:19 am</div></div></div>')}</main></body></html>`
  const searches = `<html><body><main class="_a706" role="main">${box('<div class="_a6-p"><table style="table-layout: fixed;"><tr><td colspan="2" class="_2pin _a6_q">Search<div><div>telescope for beginners</div></div></td></tr><tr><td class="_2pin _a6_q">Time</td><td class="_2pin _2piu _a6_r">Sep 29, 2026 1:39 am</td></tr></table></div>')}</main></body></html>`
  const chat = `<html><body><main class="_a706" role="main"><div>secret</div></main></body></html>`
  const r = await readTexts([
    { name: 'ig/ads_information/ads_and_topics/videos_watched.html', text: watched },
    { name: 'ig/connections/followers_and_following/following.html', text: following },
    { name: 'ig/logged_information/recent_searches/word_or_phrase_searches.html', text: searches },
    { name: 'ig/your_instagram_activity/messages/chats.html', text: chat },
  ])
  const s = r.summaries.find((x) => x.source === 'instagram')!
  assert.equal(s.stats.seen, 2)
  assert.equal(s.stats.following, 1)
  assert.equal(s.stats.searches, 1)
  assert.ok(s.fields.astronomy.score > 0)
  assert.ok(!JSON.stringify(s).includes('secret'))
})

test('old YouTube subscriptions count less than fresh ones', async () => {
  const { subscriptionWeight } = await import('../lib/sources/youtube.ts')
  const now = Date.parse('2026-10-01')
  assert.equal(subscriptionWeight(Date.parse('2026-06-01'), now), 3)
  assert.equal(subscriptionWeight(Date.parse('2023-06-01'), now), 1.8)
  assert.equal(subscriptionWeight(Date.parse('2019-06-01'), now), 1)
})

test('reads a Reddit data export and never its messages', async () => {
  const { readTexts } = await import('../lib/sources/exports.ts')
  const year = new Date().getFullYear()
  const r = await readTexts([
    { name: 'export_user/subscribed_subreddits.csv', text: 'subreddit\nsociology\nAskHistorians\ngonewild\n' },
    {
      name: 'export_user/post_votes.csv',
      text: 'id,permalink,direction\na1,https://www.reddit.com/r/sociology/comments/a1/why_does_class_still_shape_who_goes_to_university/,up\na2,https://www.reddit.com/r/AskHistorians/comments/a2/how_did_medieval_cities_feed_themselves/,up\na3,https://www.reddit.com/r/memes/comments/a3/funny_cat/,down\n',
    },
    { name: 'export_user/saved_posts.csv', text: 'id,permalink\nb1,https://www.reddit.com/r/sociology/comments/b1/bourdieu_and_cultural_capital_explained/\n' },
    {
      name: 'export_user/comments.csv',
      text: `id,permalink,date,ip,subreddit,gildings,link,parent,body,media\nc1,https://www.reddit.com/r/sociology/comments/x/precarity/c1/,${year}-03-01 10:00:00 UTC,1.2.3.4,sociology,0,https://www.reddit.com/r/sociology/comments/x/,,"Precarity and social inequality go together, see Bourdieu",\n`,
    },
    { name: 'export_user/messages.csv', text: 'id,permalink,thread_id,date,ip,from,to,subject,body\nm1,,t1,2025-01-01 00:00:00 UTC,,someone,me,hi,private sociology talk\n' },
    { name: 'export_user/chat_history.csv', text: 'message_id,created_at,updated_at,username,message,thread_parent_message_id,channel_url,subreddit,channel_name,conversation_type\n1,,,a,secret,,,sociology,,direct\n' },
  ])
  const s = r.summaries.find((x) => x.source === 'reddit')!
  assert.ok(s, 'reddit summary')
  assert.equal(s.stats.communities, 2)
  assert.equal(s.stats.upvoted, 2)
  assert.equal(s.stats.saved, 1)
  assert.equal(s.stats.comments, 1)
  assert.equal(r.summaries[0].source === 'reddit' || r.summaries.some((x) => x.source === 'reddit'), true)
  assert.ok(s.fields.sociology.score > 0)
  // Nothing from messages or chats, nothing from NSFW communities.
  const all = JSON.stringify(s)
  assert.ok(!/private sociology talk|secret|gonewild/.test(all))
})
