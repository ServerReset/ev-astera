-- CreateTable
CREATE TABLE "locations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/Los_Angeles',
    "address" TEXT,
    "site_lat" DOUBLE PRECISION,
    "site_lng" DOUBLE PRECISION,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "display_name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'user',
    "vehicle_description" TEXT,
    "notification_prefs" JSONB NOT NULL DEFAULT '{}',
    "carpool_credits" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "last_active_at" TIMESTAMP(3),
    "onboarded_at" TIMESTAMP(3),
    "reliability_score" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "reliability_locked_until" TIMESTAMP(3),
    "last_reliability_event_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chargers" (
    "id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'available',
    "offline_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chargers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "charger_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "vehicle_description" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eta_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3),
    "overtime_notified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "queue_entries" (
    "id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "charger_id" TEXT,
    "preferred_charger_id" TEXT,
    "user_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'waiting',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "priority_source" TEXT,
    "carpool_priority_delta" INTEGER NOT NULL DEFAULT 0,
    "reliability_priority_delta" INTEGER NOT NULL DEFAULT 0,
    "requeue_count" INTEGER NOT NULL DEFAULT 0,
    "notified_at" TIMESTAMP(3),
    "claimed_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "queue_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "action_url" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "message_id" TEXT,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "recipient_id" TEXT,
    "charger_id" TEXT,
    "session_id" TEXT,
    "body" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "reaction" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emergency_requests" (
    "id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "explanation" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "emergency_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "announcements" (
    "id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "expires_at" TIMESTAMP(3),
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "location_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("location_id","key")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "location_id" TEXT,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "details" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carpool_groups" (
    "id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "carpool_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carpool_group_members" (
    "group_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "carpool_group_members_pkey" PRIMARY KEY ("group_id","user_id")
);

-- CreateTable
CREATE TABLE "carpool_schedules" (
    "id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "days_of_week" INTEGER[],
    "depart_time" TEXT NOT NULL,
    "origin_label" TEXT NOT NULL,
    "seats" INTEGER NOT NULL DEFAULT 1,
    "group_id" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "carpool_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carpool_rides" (
    "id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "driver_id" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "origin_label" TEXT NOT NULL,
    "depart_at" TIMESTAMP(3) NOT NULL,
    "seats_total" INTEGER NOT NULL,
    "seats_available" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "notes" TEXT,
    "schedule_id" TEXT,
    "linked_session_id" TEXT,
    "group_id" TEXT,
    "miles" DOUBLE PRECISION,
    "co2_grams_saved" DOUBLE PRECISION,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "carpool_rides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carpool_bookings" (
    "id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "ride_id" TEXT NOT NULL,
    "rider_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'requested',
    "seats" INTEGER NOT NULL DEFAULT 1,
    "pickup_label" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "carpool_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carpool_requests" (
    "id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "rider_id" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "origin_label" TEXT NOT NULL,
    "window_start" TIMESTAMP(3) NOT NULL,
    "window_end" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "matched_ride_id" TEXT,
    "schedule_id" TEXT,
    "group_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "carpool_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carpool_trip_logs" (
    "id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "ride_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "miles" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "co2_grams_saved" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "credits_awarded" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "carpool_trip_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carpool_credits_ledger" (
    "id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "ride_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "carpool_credits_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reliability_events" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "delta" DOUBLE PRECISION NOT NULL,
    "score_after" DOUBLE PRECISION NOT NULL,
    "session_id" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reliability_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_location_id_idx" ON "users"("location_id");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_token_hash_idx" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "chargers_location_id_idx" ON "chargers"("location_id");

-- CreateIndex
CREATE INDEX "sessions_charger_id_idx" ON "sessions"("charger_id");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_status_idx" ON "sessions"("status");

-- CreateIndex
CREATE INDEX "sessions_started_at_idx" ON "sessions"("started_at");

-- CreateIndex
CREATE INDEX "queue_entries_charger_id_idx" ON "queue_entries"("charger_id");

-- CreateIndex
CREATE INDEX "queue_entries_user_id_idx" ON "queue_entries"("user_id");

-- CreateIndex
CREATE INDEX "queue_entries_status_idx" ON "queue_entries"("status");

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "notifications_user_id_idx" ON "notifications"("user_id");

-- CreateIndex
CREATE INDEX "notifications_message_id_idx" ON "notifications"("message_id");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE INDEX "push_subscriptions_user_id_idx" ON "push_subscriptions"("user_id");

-- CreateIndex
CREATE INDEX "messages_recipient_id_created_at_idx" ON "messages"("recipient_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "messages_sender_id_created_at_idx" ON "messages"("sender_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "emergency_requests_user_id_created_at_idx" ON "emergency_requests"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "announcements_location_id_active_idx" ON "announcements"("location_id", "active");

-- CreateIndex
CREATE INDEX "audit_log_location_id_created_at_idx" ON "audit_log"("location_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_log_action_idx" ON "audit_log"("action");

-- CreateIndex
CREATE INDEX "carpool_groups_location_id_idx" ON "carpool_groups"("location_id");

-- CreateIndex
CREATE INDEX "carpool_schedules_user_id_idx" ON "carpool_schedules"("user_id");

-- CreateIndex
CREATE INDEX "carpool_schedules_location_id_active_idx" ON "carpool_schedules"("location_id", "active");

-- CreateIndex
CREATE INDEX "carpool_rides_location_id_idx" ON "carpool_rides"("location_id");

-- CreateIndex
CREATE INDEX "carpool_rides_driver_id_idx" ON "carpool_rides"("driver_id");

-- CreateIndex
CREATE INDEX "carpool_rides_status_idx" ON "carpool_rides"("status");

-- CreateIndex
CREATE INDEX "carpool_rides_depart_at_idx" ON "carpool_rides"("depart_at");

-- CreateIndex
CREATE INDEX "carpool_bookings_ride_id_idx" ON "carpool_bookings"("ride_id");

-- CreateIndex
CREATE INDEX "carpool_bookings_rider_id_idx" ON "carpool_bookings"("rider_id");

-- CreateIndex
CREATE INDEX "carpool_bookings_status_idx" ON "carpool_bookings"("status");

-- CreateIndex
CREATE UNIQUE INDEX "carpool_bookings_ride_id_rider_id_key" ON "carpool_bookings"("ride_id", "rider_id");

-- CreateIndex
CREATE INDEX "carpool_requests_rider_id_idx" ON "carpool_requests"("rider_id");

-- CreateIndex
CREATE INDEX "carpool_requests_location_id_status_idx" ON "carpool_requests"("location_id", "status");

-- CreateIndex
CREATE INDEX "carpool_trip_logs_user_id_created_at_idx" ON "carpool_trip_logs"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "carpool_trip_logs_location_id_created_at_idx" ON "carpool_trip_logs"("location_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "carpool_trip_logs_ride_id_idx" ON "carpool_trip_logs"("ride_id");

-- CreateIndex
CREATE INDEX "carpool_credits_ledger_user_id_created_at_idx" ON "carpool_credits_ledger"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "reliability_events_user_id_created_at_idx" ON "reliability_events"("user_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chargers" ADD CONSTRAINT "chargers_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_charger_id_fkey" FOREIGN KEY ("charger_id") REFERENCES "chargers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "queue_entries" ADD CONSTRAINT "queue_entries_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "queue_entries" ADD CONSTRAINT "queue_entries_charger_id_fkey" FOREIGN KEY ("charger_id") REFERENCES "chargers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "queue_entries" ADD CONSTRAINT "queue_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_charger_id_fkey" FOREIGN KEY ("charger_id") REFERENCES "chargers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergency_requests" ADD CONSTRAINT "emergency_requests_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergency_requests" ADD CONSTRAINT "emergency_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settings" ADD CONSTRAINT "settings_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carpool_groups" ADD CONSTRAINT "carpool_groups_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carpool_groups" ADD CONSTRAINT "carpool_groups_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carpool_group_members" ADD CONSTRAINT "carpool_group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "carpool_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carpool_group_members" ADD CONSTRAINT "carpool_group_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carpool_schedules" ADD CONSTRAINT "carpool_schedules_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carpool_schedules" ADD CONSTRAINT "carpool_schedules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carpool_schedules" ADD CONSTRAINT "carpool_schedules_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "carpool_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carpool_rides" ADD CONSTRAINT "carpool_rides_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carpool_rides" ADD CONSTRAINT "carpool_rides_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carpool_rides" ADD CONSTRAINT "carpool_rides_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "carpool_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carpool_rides" ADD CONSTRAINT "carpool_rides_linked_session_id_fkey" FOREIGN KEY ("linked_session_id") REFERENCES "sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carpool_rides" ADD CONSTRAINT "carpool_rides_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "carpool_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carpool_bookings" ADD CONSTRAINT "carpool_bookings_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carpool_bookings" ADD CONSTRAINT "carpool_bookings_ride_id_fkey" FOREIGN KEY ("ride_id") REFERENCES "carpool_rides"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carpool_bookings" ADD CONSTRAINT "carpool_bookings_rider_id_fkey" FOREIGN KEY ("rider_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carpool_requests" ADD CONSTRAINT "carpool_requests_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carpool_requests" ADD CONSTRAINT "carpool_requests_rider_id_fkey" FOREIGN KEY ("rider_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carpool_requests" ADD CONSTRAINT "carpool_requests_matched_ride_id_fkey" FOREIGN KEY ("matched_ride_id") REFERENCES "carpool_rides"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carpool_requests" ADD CONSTRAINT "carpool_requests_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "carpool_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carpool_requests" ADD CONSTRAINT "carpool_requests_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "carpool_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carpool_trip_logs" ADD CONSTRAINT "carpool_trip_logs_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carpool_trip_logs" ADD CONSTRAINT "carpool_trip_logs_ride_id_fkey" FOREIGN KEY ("ride_id") REFERENCES "carpool_rides"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carpool_trip_logs" ADD CONSTRAINT "carpool_trip_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carpool_credits_ledger" ADD CONSTRAINT "carpool_credits_ledger_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carpool_credits_ledger" ADD CONSTRAINT "carpool_credits_ledger_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carpool_credits_ledger" ADD CONSTRAINT "carpool_credits_ledger_ride_id_fkey" FOREIGN KEY ("ride_id") REFERENCES "carpool_rides"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reliability_events" ADD CONSTRAINT "reliability_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
