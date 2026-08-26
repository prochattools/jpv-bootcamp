import { readFileSync } from 'node:fs'

import assert from 'node:assert/strict'

const reactionClient = readFileSync('src/components/community/ReactionBarClient.tsx', 'utf8')
const reactionRoute = readFileSync('src/app/api/portal/reactions/route.ts', 'utf8')
const bookmarkClient = readFileSync('src/components/community/ShareBookmarkActions.tsx', 'utf8')
const bookmarkRoute = readFileSync('src/app/api/portal/bookmarks/route.ts', 'utf8')
const postPage = readFileSync('src/app/(frontend)/portal/community/[spaceSlug]/posts/[postId]/page.tsx', 'utf8')

assert.match(reactionClient, /fetch\('\/api\/portal\/reactions'/)
assert.match(reactionClient, /onClick=\{\(\) => void toggle\(option\.type\)\}/)
assert.match(reactionClient, /type='button'/)
assert.doesNotMatch(reactionClient, /router\.refresh|window\.location\.(assign|reload)/)
assert.match(reactionRoute, /await setReaction\(/)
assert.match(reactionRoute, /await getReactionSummary\(/)
assert.match(bookmarkClient, /fetch\('\/api\/portal\/bookmarks'/)
assert.match(bookmarkClient, /navigator\.share/)
assert.match(bookmarkClient, /copyLink\(url\)/)
assert.match(bookmarkClient, /type='button'/)
assert.match(bookmarkRoute, /function relationshipId\(value: string\): number \| string/)
assert.match(bookmarkRoute, /actorMember: relationshipId\(memberId\)/)
assert.match(bookmarkRoute, /targetPost: relationshipId\(postId\)/)
assert.match(postPage, /<ShareBookmarkActions initialBookmarked=\{bookmarked\}/)
assert.doesNotMatch(postPage, /<span[^>]*>\s*Bookmark\s*<\/span>/)
assert.doesNotMatch(postPage, /<span[^>]*>\s*Share\s*<\/span>/)

console.log('portal engagement controls: PASS')
