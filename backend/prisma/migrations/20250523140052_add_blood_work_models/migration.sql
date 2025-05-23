-- CreateTable
CREATE TABLE "PelotonIntegration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "username" TEXT,
    "password" TEXT,
    "sessionCookie" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PelotonIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BloodWorkRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "fileName" TEXT,
    "fileType" TEXT,
    "interpretation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BloodWorkRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BloodWorkValue" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "numericValue" DOUBLE PRECISION,
    "unit" TEXT NOT NULL,
    "normalRange" TEXT,
    "isAbnormal" BOOLEAN,
    "category" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BloodWorkValue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PelotonIntegration_userId_key" ON "PelotonIntegration"("userId");

-- CreateIndex
CREATE INDEX "PelotonIntegration_userId_idx" ON "PelotonIntegration"("userId");

-- CreateIndex
CREATE INDEX "BloodWorkRecord_userId_idx" ON "BloodWorkRecord"("userId");

-- CreateIndex
CREATE INDEX "BloodWorkRecord_date_idx" ON "BloodWorkRecord"("date");

-- CreateIndex
CREATE INDEX "BloodWorkRecord_createdAt_idx" ON "BloodWorkRecord"("createdAt");

-- CreateIndex
CREATE INDEX "BloodWorkValue_recordId_idx" ON "BloodWorkValue"("recordId");

-- CreateIndex
CREATE INDEX "BloodWorkValue_name_idx" ON "BloodWorkValue"("name");

-- CreateIndex
CREATE INDEX "BloodWorkValue_isAbnormal_idx" ON "BloodWorkValue"("isAbnormal");

-- CreateIndex
CREATE INDEX "BloodWorkValue_category_idx" ON "BloodWorkValue"("category");

-- CreateIndex
CREATE INDEX "BloodWorkValue_numericValue_idx" ON "BloodWorkValue"("numericValue");

-- AddForeignKey
ALTER TABLE "BloodWorkValue" ADD CONSTRAINT "BloodWorkValue_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "BloodWorkRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;
