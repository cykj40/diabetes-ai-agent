-- CreateTable
CREATE TABLE "ChatMessage" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BloodSugarReading" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "trend" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "analyzed" BOOLEAN NOT NULL DEFAULT false,
    "analysis" JSONB,

    CONSTRAINT "BloodSugarReading_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChatMessage_sessionId_idx" ON "ChatMessage"("sessionId");

-- CreateIndex
CREATE INDEX "BloodSugarReading_sessionId_idx" ON "BloodSugarReading"("sessionId");

-- CreateIndex
CREATE INDEX "BloodSugarReading_timestamp_idx" ON "BloodSugarReading"("timestamp");
