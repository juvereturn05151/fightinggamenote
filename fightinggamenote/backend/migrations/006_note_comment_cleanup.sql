-- Comments use a polymorphic target and cannot have a direct Note FK.
-- Clean them up before a Note (or its owning account) is deleted. Any active
-- comment likes cascade from comments; immutable reputation awards remain.
CREATE FUNCTION delete_note_comments_before_note()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM comments
  WHERE commentable_type = 'video'
    AND commentable_id IN (
      SELECT id FROM videos WHERE note_id = OLD.id
    );

  DELETE FROM comments
  WHERE commentable_type = 'note'
    AND commentable_id = OLD.id;

  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_delete_note_comments
BEFORE DELETE ON notes
FOR EACH ROW
EXECUTE FUNCTION delete_note_comments_before_note();
