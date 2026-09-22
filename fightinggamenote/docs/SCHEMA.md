# Data schema

Status: draft, not yet implemented. Field types are indicative (Postgres),
adjust during migration authoring.

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
visibility      enum(public, private)
created_at      timestamptz
updated_at      timestamptz
```
`game_id` is stored on Note even though `Character` already implies a game.
This is a deliberate denormalization:
- avoids a join when filtering/listing notes by game alone
- guards against desync if a character were ever moved between games or
  mis-entered

A Note does **not** require a video. Video is an optional attachment.

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
mistake_note  text        -- author's own "what I got wrong" annotation
created_at    timestamptz
storage_key   text, nullable Server-generated filename for a locally stored video.
original_filename text, nullable Original filename of the video uploaded by the user.
```

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
