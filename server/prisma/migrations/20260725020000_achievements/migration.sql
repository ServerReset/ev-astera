-- CreateTable
CREATE TABLE "user_achievements" (
    "id" TEXT NOT NULL,
    "location_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "achievement_key" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_achievements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_achievements_user_id_created_at_idx" ON "user_achievements"("user_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "user_achievements_user_id_achievement_key_key" ON "user_achievements"("user_id", "achievement_key");

-- AddForeignKey
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
