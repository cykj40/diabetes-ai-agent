-- CreateTable
CREATE TABLE "UploadedFile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "uniqueName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT,
    "content" TEXT,
    "analysis" TEXT,
    "tags" TEXT[],
    "description" TEXT,
    "isProcessed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UploadedFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UploadedFile_userId_idx" ON "UploadedFile"("userId");

-- CreateIndex
CREATE INDEX "UploadedFile_sessionId_idx" ON "UploadedFile"("sessionId");

-- CreateIndex
CREATE INDEX "UploadedFile_fileType_idx" ON "UploadedFile"("fileType");

-- CreateIndex
CREATE INDEX "UploadedFile_createdAt_idx" ON "UploadedFile"("createdAt");

-- CreateIndex
CREATE INDEX "UploadedFile_isProcessed_idx" ON "UploadedFile"("isProcessed");
