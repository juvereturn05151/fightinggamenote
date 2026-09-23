# Data schema

Status: implemented as PostgreSQL migrations. Keep this document and new
migrations in sync.

## Entities

### User
```
id                uuid PK
username          text unique
email             text unique
password_hash     text        -- or external auth provider id
avatar_url        text
created_at        timestamptz
```

### Game
```
id      uuid PK
name    text          -- e.g. "Street Fighter 6"
slug    text unique   -- e.g. "sf6"
```

### Character
```
id        uuid PK
game_id   uuid FK -> Game
name      text          -- e.g. "Ken"
slug      text          -- unique within (game_id, slug)
```
Each character belongs to exactly one game. This scopes character
lists/pickers per game (Ken only appears under SF6, not under Guilty Gear).
**Needs seeding** per game before users can tag notes — this is real data
entry to do per game, not something to fabricate a roster for.

### Note
```
id              uuid PK
user_id         uuid FK -> User
game_id         uuid FK -> Game
character_id    uuid FK -> Character
title           text
body            text        -- combo/setup notation, free text
tags            text[]      -- e.g. ["punish", "corner"]
visibility      enum(public, private) -- application default: private
created_at      timestamptz
updated_at      timestamptz
```
`game_id` is stored on Note even though `Character` already implies a game.
This is a deliberate denormalization:
- avoids a join when filtering/listing notes by game alone
- guards against desync if a character were ever moved between games or
  mis-entered

A Note does **not** require a video. Video is an optional attachment.

New Notes default to `private`. Private Notes and their video metadata and
comments are readable only by their creator. Public Notes appear in the public
feed and may be read by anyone; signed-in users may comment. The owner may
switch either direction after creation. Existing records retain their current
visibility.

### Video
```
id            uuid PK
note_id       uuid FK -> Note
user_id       uuid FK -> User
s3_key        text
cdn_url       text
duration_sec  integer
thumbnail_url text
status        enum(uploading, processing, ready, failed)
mistake_note  text        -- legacy, nullable; retained but unused by the application
created_at    timestamptz
storage_key   text, nullable Server-generated filename for a locally stored video.
original_filename text, nullable Original filename of the video uploaded by the user.
youtube_video_id text, nullable Canonical 11-character YouTube video ID.
```

New replay attachments use YouTube as the hosting platform. The application
accepts a supported YouTube URL, validates its hostname and shape on the
backend, and stores only `youtube_video_id`. The frontend constructs the embed
URL from that ID; arbitrary embed URLs, iframe markup, and scripts are never
stored. YouTube public and unlisted videos can be embedded when the uploader
allows embedding. YouTube visibility remains independent of Note visibility;
in particular, an unlisted YouTube video is not private.

`storage_key` and `original_filename` remain in place for legacy local uploads.
Their files and streaming route are retained during the transition. The S3/CDN
columns also remain unchanged for schema compatibility, but the YouTube flow
does not download a video, proxy video bytes, or use S3. A Video belongs to the
same user and Note ownership model regardless of storage type, and a Note can
still have multiple Video rows.

`mistake_note` is retained solely to preserve existing records. The application
does not return, display, or update it; replay discussion belongs in the
Note-level comment thread.

### Comment
```
id                  uuid PK
user_id             uuid FK -> User
commentable_type    enum(note, video)
commentable_id      uuid      -- polymorphic ref to Note.id or Video.id
parent_comment_id   uuid FK -> Comment, nullable   -- for one-level threaded replies
body                text
created_at          timestamptz
```
Polymorphic `(commentable_type, commentable_id)` is simple but not
DB-constraint-safe (Postgres can't FK-enforce it). Alternative: separate
`NoteComment` / `VideoComment` tables — more boilerplate, referentially
safe. Currently favoring polymorphic since it's the more common
real-world pattern to practice with.

### NoteLike
```
user_id     uuid FK -> User
note_id     uuid FK -> Note
created_at  timestamptz
PK (user_id, note_id)
```
Represents the current active like. Only public Notes can receive new likes,
and authors cannot like their own Notes. Removing this row does not remove a
previous reputation award.

### CommentLike
```
user_id     uuid FK -> User
comment_id  uuid FK -> Comment
created_at  timestamptz
PK (user_id, comment_id)
```
Represents the current active like on a Note comment or reply. New likes are
allowed only while the parent Note is public, and comment authors cannot like
their own comments.

### ReputationAward
```
id                 uuid PK
recipient_user_id  uuid FK -> User
awarder_user_id    uuid       -- immutable user-id snapshot
award_type         enum(note_like, comment_like)
item_id            uuid       -- immutable Note/Comment id snapshot
points             smallint   -- 10 for Note, 5 for Comment
created_at         timestamptz
unique (awarder_user_id, award_type, item_id)
```
Lifetime reputation is calculated only from this append-only ledger, never
from active-like counts. Like creation and award insertion happen in one
transaction. The unique ledger key prevents repeated or concurrent requests,
including unlike/relike cycles, from awarding twice.

Deletion and moderation policy:

- Deleting a Note or Comment removes its active likes through foreign-key
  cascades; its reputation awards remain as historical achievements.
- Making a Note private or applying a moderation action prevents new likes but
  does not change active-like history or earned awards.
- Deleting an awarder's account leaves their UUID snapshot in awards earned by
  other users. Deleting the recipient account removes that account's ledger,
  because there is no longer a profile on which to display reputation.

### Report (moderation)
```
id                  uuid PK
reporter_id         uuid FK -> User
commentable_type    enum(note, video, comment)
commentable_id      uuid
reason              text
status              enum(open, reviewed, dismissed)
created_at          timestamptz
```
Included from the start given the app is public and social — moderation
shouldn't be an afterthought.

## Open questions (not yet decided)

- One video per note, or many? Current assumption: one-to-many
  (`Video.note_id` FK), i.e. a note *could* have multiple clips.
- Comment nesting depth: schema supports arbitrary depth via
  `parent_comment_id` self-reference; current UI mockups only render one
  level of indentation. Decide intended max depth.
- `Character.name` as free text vs. a further-structured move-list system:
  out of scope for now — character is just an identity/filter dimension,
  not a source of move data.
