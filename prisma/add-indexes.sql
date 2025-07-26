-- SQL script to add performance indexes without resetting the database
-- Run this script directly on your database to add the indexes

-- Product indexes
CREATE INDEX IF NOT EXISTS "Product_categoryId_idx" ON "Product"("categoryId");
CREATE INDEX IF NOT EXISTS "Product_isActive_idx" ON "Product"("isActive");

-- Transaction indexes
CREATE INDEX IF NOT EXISTS "Transaction_userId_idx" ON "Transaction"("userId");
CREATE INDEX IF NOT EXISTS "Transaction_memberId_idx" ON "Transaction"("memberId");
CREATE INDEX IF NOT EXISTS "Transaction_createdAt_idx" ON "Transaction"("createdAt");
CREATE INDEX IF NOT EXISTS "Transaction_paymentMethod_idx" ON "Transaction"("paymentMethod");
CREATE INDEX IF NOT EXISTS "Transaction_status_idx" ON "Transaction"("status");
CREATE INDEX IF NOT EXISTS "Transaction_paymentStatus_idx" ON "Transaction"("paymentStatus");
CREATE INDEX IF NOT EXISTS "Transaction_userId_createdAt_idx" ON "Transaction"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "Transaction_memberId_createdAt_idx" ON "Transaction"("memberId", "createdAt");

-- TransactionItem indexes
CREATE INDEX IF NOT EXISTS "TransactionItem_transactionId_idx" ON "TransactionItem"("transactionId");
CREATE INDEX IF NOT EXISTS "TransactionItem_productId_idx" ON "TransactionItem"("productId");
CREATE INDEX IF NOT EXISTS "TransactionItem_createdAt_idx" ON "TransactionItem"("createdAt");
CREATE INDEX IF NOT EXISTS "TransactionItem_productId_createdAt_idx" ON "TransactionItem"("productId", "createdAt");

-- Member indexes
CREATE INDEX IF NOT EXISTS "Member_name_idx" ON "Member"("name");
CREATE INDEX IF NOT EXISTS "Member_points_idx" ON "Member"("points");

-- PointHistory indexes
CREATE INDEX IF NOT EXISTS "PointHistory_memberId_idx" ON "PointHistory"("memberId");
CREATE INDEX IF NOT EXISTS "PointHistory_transactionId_idx" ON "PointHistory"("transactionId");
CREATE INDEX IF NOT EXISTS "PointHistory_createdAt_idx" ON "PointHistory"("createdAt");
CREATE INDEX IF NOT EXISTS "PointHistory_type_idx" ON "PointHistory"("type");
CREATE INDEX IF NOT EXISTS "PointHistory_memberId_createdAt_idx" ON "PointHistory"("memberId", "createdAt");
CREATE INDEX IF NOT EXISTS "PointHistory_memberId_type_idx" ON "PointHistory"("memberId", "type");