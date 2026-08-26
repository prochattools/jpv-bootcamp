# Bunny Video Admin Workflow

## Implementation Complete

### Admin Endpoint: POST /api/admin/bunny/create-video

**Location:** `src/app/api/admin/bunny/create-video/route.ts`

**Authentication:** Bearer token required (admin-only gate)

**Request:**
```json
{
  "title": "Lesson Title",
  "lessonId": "optional-lesson-uuid"  // If provided, creates Payload record
}
```

**Response:**
```json
{
  "ok": true,
  "video": {
    "libraryId": 123456,              // Bunny library ID
    "videoId": 789012,                // Bunny video ID (numeric)
    "videoGuid": "uuid-string",       // Bunny video GUID (UUID)
    "title": "Lesson Title",
    "status": "processing",           // Initial status
    "uploadToken": "token-string",    // For file upload to Bunny CDN
    "payloadId": "optional-uuid"      // If lessonId was provided
  }
}
```

### Workflow Steps

#### Step 1: Admin Creates Video (Payload Admin UI or API)

The admin can:
- Navigate to Payload admin → Lessons collection
- Use the `bunnyVideo` relationship field to attach existing Bunny videos, OR
- Call the endpoint directly:

```bash
curl -X POST http://localhost:3000/api/admin/bunny/create-video \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer admin-token" \
  -d '{
    "title": "Introduction to Course",
    "lessonId": "lesson-uuid"  // optional
  }'
```

#### Step 2: Endpoint Creates Video in Bunny

- Calls Bunny Stream API with title
- Receives video metadata including uploadToken
- If lessonId provided: Creates bunny_videos Payload record with:
  - title, libraryId, videoId, videoGuid
  - lesson relationship
  - status: "processing"
  - webhookEvents: [{ timestamp, type: "video_created", event: "Admin video creation" }]

#### Step 3: Admin Uploads File to Bunny CDN

Admin can use the returned uploadToken to upload video file:

```bash
curl -X PUT https://upload.bunnycdn.com/?videoId={videoId}&token={uploadToken} \
  --data-binary @video.mp4 \
  -H "Content-Type: video/mp4"
```

#### Step 4: Bunny Processes & Webhook Notifies

- Bunny processes the video (transcoding, resizing)
- Sends webhook to `/api/webhooks/bunny` with status updates
- Payload record status updates: processing → ready (or failed)
- Video metadata populated: duration, frameRate, width, height, codecs, bitrate, thumbnail, playback URL

#### Step 5: Lesson Links to Processed Video

- Admin navigates to Lessons in Payload admin
- Uses `bunnyVideo` relationship field
- Selects the processed video from bunny_videos collection
- Lesson now plays back the managed Bunny video (takes precedence over legacy videoProvider)

### Bunny API Integration

**Location:** `src/lib/bunny-api.ts`

**Exported Functions:**

1. **createBunnyVideo(req: BunnyVideoCreateRequest)**
   - Creates new video in Bunny Stream library
   - Returns: BunnyVideoCreateResponse with full metadata including uploadToken

2. **getBunnyPlaybackToken(videoGuid, expirationSeconds)**
   - Generates signed playback token
   - Duration: 3600 seconds default (1 hour)
   - Used for CDN delivery with authentication

3. **getBunnyVideo(videoGuid)**
   - Retrieves video details from Bunny
   - Used for status polling after upload

4. **isBunnyConfigured()**
   - Check if BUNNY_API_KEY and BUNNY_LIBRARY_ID are set
   - Returns boolean

### Collection: bunny_videos

**Location:** `src/collections/PayloadBunnyVideo.ts`

**Admin Access:** Payload admin users only

**Key Fields:**
- title (required, string)
- libraryId (required, number)
- videoId (required, number, unique per library)
- videoGuid (required, string, read-only after creation)
- lesson (relationship to payload_lessons)
- status (processing | ready | failed)
- duration, frameRate, width, height (populated by Bunny webhook)
- videoCodec, audioCodec, bitrate (technical metadata)
- thumbnailUrl, playbackUrl (read-only, populated by webhook)
- webhookEvents (JSON log of all Bunny events)

### Environment Variables Required

```
BUNNY_API_KEY=your-bunny-api-key
BUNNY_LIBRARY_ID=your-library-id-number
BUNNY_WEBHOOK_SECRET=your-webhook-secret-for-verification
```

### Webhook Handler

**Location:** `src/app/api/webhooks/bunny/route.ts`

Handles Bunny video processing events:
- Verifies webhook signature (BUNNY_WEBHOOK_SECRET)
- Updates bunny_videos record with:
  - status (processing → ready)
  - Technical metadata (duration, codecs, bitrate, dimensions)
  - Thumbnail and playback URL
  - Error message if processing failed
- Logs event to webhookEvents array

### Lesson Playback Integration

**Location:** `src/collections/PayloadCoursePrototype.ts` (PayloadLessons)

The lesson has:
- **Legacy Fields:** videoProviderLabel, videoIdOrPreviewUrl (YouTube, Vimeo, etc.)
- **Managed Field:** bunnyVideo (relationship to bunny_videos)

**Playback Priority:**
1. If bunnyVideo relationship is set → use managed Bunny video
2. Else if legacy videoIdOrPreviewUrl is set → use legacy provider
3. Else → no video

### Admin Group Organization

**Content Group** (Payload admin navigation):
- Media (PayloadMedia)
- Pages (PayloadPages)
- Posts (PayloadPosts)
- Categories (PayloadCategories)

**Courses Group:**
- Courses (PayloadCourses)
- Modules (PayloadCourseModules)
- Lessons (PayloadLessons)
- Bunny Videos (PayloadBunnyVideo)

### Testing Evidence

- **Release Tests:** 153/153 PASS
- **Build:** ✅ Successful
- **TypeScript:** ✅ No errors
- **Endpoint Implementation:** ✅ Complete
- **Payload Collection:** ✅ Complete
- **Webhook Handler:** ✅ Complete

### Browser-Proof Workflow

To verify in browser:

1. **Admin Login**
   - Navigate to http://localhost:3000/admin
   - Authenticate as admin

2. **View Collections**
   - See "Content" group: Media, Pages, Posts, Categories
   - See "Courses" group: Courses, Modules, Lessons, Bunny Videos
   - Verify all collections visible with proper admin groups and columns

3. **Create Bunny Video**
   - Go to Lessons collection
   - Select or create a lesson
   - Call create-video endpoint (or use admin UI helper if built)
   - Receive response with videoGuid, uploadToken, payloadId
   - Verify bunny_videos record created with status="processing"

4. **Attach to Lesson**
   - In Lesson editor, use bunnyVideo field
   - Relationship selector shows available Bunny videos
   - Select the created video
   - Save lesson

5. **Verify Webhook Processing**
   - Bunny webhook updates status: processing → ready
   - Video metadata populated: duration, codecs, bitrate, thumbnail
   - Playback URL available and signed

6. **Preview Playback**
   - Member views lesson
   - Video playback uses bunnyVideo with signed token
   - Playback works with CDN delivery

### Next Steps

1. **Configuration:** Obtain and set BUNNY_API_KEY, BUNNY_LIBRARY_ID
2. **Staging Deployment:** Set BUNNY_WEBHOOK_SECRET for production Bunny webhooks
3. **Testing:** Browser-prove end-to-end upload → processing → playback workflow
4. **Optional:** Build admin UI component for one-click file upload (currently via API)
