CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE "Role" AS ENUM ('ADMIN', 'MEMBER');
CREATE TYPE "PaymentStatus" AS ENUM ('PAID', 'UNPAID');
CREATE TYPE "PaymentMethod" AS ENUM ('PHONE_PAY', 'CASH');
CREATE TYPE "PaymentState" AS ENUM ('SUCCESS', 'FAILED', 'PENDING');
CREATE TYPE "ClassStatus" AS ENUM ('OPEN', 'CLOSED', 'CANCELED');

CREATE TABLE "User" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "email" text NOT NULL UNIQUE,
  "phone" text,
  "role" "Role" NOT NULL DEFAULT 'MEMBER',
  "passwordHash" text NOT NULL,
  "membershipStart" timestamptz,
  "nextPaymentDue" timestamptz,
  "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
  "paymentMethod" "PaymentMethod",
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "User_role_idx" ON "User"("role");
CREATE INDEX "User_nextPaymentDue_idx" ON "User"("nextPaymentDue");

CREATE TABLE "Payment" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" uuid NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "amount" integer NOT NULL,
  "method" "PaymentMethod" NOT NULL,
  "status" "PaymentState" NOT NULL DEFAULT 'PENDING',
  "date" timestamptz NOT NULL DEFAULT now(),
  "stripePaymentIntentId" text,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "Payment_userId_idx" ON "Payment"("userId");

CREATE TABLE "Workout" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "date" timestamptz NOT NULL UNIQUE,
  "description" text NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "Workout_date_idx" ON "Workout"("date");

CREATE TABLE "Class" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "title" text NOT NULL,
  "datetime" timestamptz NOT NULL,
  "capacity" integer NOT NULL,
  "status" "ClassStatus" NOT NULL DEFAULT 'OPEN',
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "Class_datetime_idx" ON "Class"("datetime");

CREATE TABLE "ClassSignup" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" uuid NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "classId" uuid NOT NULL REFERENCES "Class"("id") ON DELETE CASCADE,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("userId", "classId")
);

CREATE INDEX "ClassSignup_classId_idx" ON "ClassSignup"("classId");

CREATE TABLE "Announcement" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "title" text NOT NULL,
  "body" text NOT NULL,
  "imageUrl" text,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "Announcement_createdAt_idx" ON "Announcement"("createdAt");

CREATE TABLE "DeviceToken" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" uuid NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "token" text NOT NULL UNIQUE,
  "platform" text NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "DeviceToken_userId_idx" ON "DeviceToken"("userId");
