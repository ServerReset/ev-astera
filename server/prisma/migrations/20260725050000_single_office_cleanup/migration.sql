-- Collapse to a single real office (Astera Labs — Santa Clara) and clear test churn.
--
-- WHY: the DB was seeded with two fabricated extra offices (Austin, Bengaluru) plus a lot of
-- throwaway accounts/sessions/rides created during testing. This makes the deployed app show
-- real data only. Every location-scoped table has ON DELETE CASCADE on location_id, so removing
-- the two office rows removes all their chargers/sessions/queue/messages/carpool/etc. in one go.

-- 1. Delete the two seeded non-HQ offices (cascades to all their data).
DELETE FROM "locations"
WHERE id IN (
  '11111111-1111-1111-1111-111111111112',  -- Austin
  '11111111-1111-1111-1111-111111111113'   -- Bengaluru
);

-- 2. Clear test churn at the surviving Santa Clara office. Target ONLY the throwaway accounts
-- generated during testing — every one used a "<prefix>_<timestamp>@asteralabs.com" shape (the
-- prefixes below, each followed by an underscore + digits). This pattern can't match a real
-- human's chosen email, so no genuine account is at risk. Deleting a user cascades to their
-- sessions, queue entries, messages, bookings, credits, achievements, etc. (Seeded admins are
-- excluded by UUID as a belt-and-suspenders guard even though their emails don't match anyway.)
DELETE FROM "users" u
WHERE u.id NOT IN (
        '22222222-2222-2222-2222-222222222220',  -- super-admin
        '22222222-2222-2222-2222-222222222222'   -- Santa Clara site-admin
      )
  AND u.email ~ '^(probe|e2e|ehome|home|final|final2|flow|geo|dbg|ach|w|w2|fe|life|sh|diag)_[0-9]+@asteralabs\.com$';

-- 3. Sweep any now-orphaned charging sessions/queue rows on chargers whose office was removed is
-- handled by the cascade above; nothing else to do. Chargers/settings for Santa Clara are left
-- intact (re-running the seed is idempotent for them).
