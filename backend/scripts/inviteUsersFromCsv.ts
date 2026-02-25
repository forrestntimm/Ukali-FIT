import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const prisma = new PrismaClient();

type CsvRow = {
  email: string;
  name: string;
  phone?: string;
  role?: "ADMIN" | "MEMBER";
  membership_start?: string;
  next_payment_due?: string;
  payment_status?: "PAID" | "UNPAID";
};

function parseArgs() {
  const args = process.argv.slice(2);
  const result: { file?: string; redirectTo?: string; dryRun: boolean } = {
    dryRun: false
  };

  for (const arg of args) {
    if (arg.startsWith("--file=")) result.file = arg.replace("--file=", "");
    else if (arg.startsWith("--redirectTo=")) result.redirectTo = arg.replace("--redirectTo=", "");
    else if (arg === "--dry-run") result.dryRun = true;
  }

  return result;
}

function parseCsv(content: string): CsvRow[] {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim());
  const required = ["email", "name"];
  for (const field of required) {
    if (!headers.includes(field)) {
      throw new Error(`Missing required CSV column: ${field}`);
    }
  }

  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim());
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || "";
    });
    return row as CsvRow;
  });
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function sendInvite(
  supabaseUrl: string,
  serviceRoleKey: string,
  anonKey: string,
  email: string,
  redirectTo: string
) {
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const publicClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const invite = await adminClient.auth.admin.inviteUserByEmail(email, { redirectTo });
  if (!invite.error) return { sentVia: "invite" as const };

  const otp = await publicClient.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: redirectTo
    }
  });

  if (otp.error) {
    throw new Error(`Invite failed: ${invite.error.message}; OTP fallback failed: ${otp.error.message}`);
  }

  return { sentVia: "otp_fallback" as const };
}

async function run() {
  const { file, redirectTo, dryRun } = parseArgs();
  if (!file) {
    throw new Error("Missing --file argument. Example: npm run migrate:invites -- --file=./members.csv");
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    throw new Error("Missing SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY/SUPABASE_ANON_KEY env vars");
  }

  const csvPath = path.resolve(process.cwd(), file);
  const csvContent = fs.readFileSync(csvPath, "utf8");
  const rows = parseCsv(csvContent);

  const seenEmails = new Set<string>();
  const report = {
    file: csvPath,
    dryRun,
    processedAt: new Date().toISOString(),
    totalRows: rows.length,
    invited: [] as Array<{ email: string; method: string; userId: string }> ,
    skippedAlreadyLinked: [] as Array<{ email: string; userId: string }> ,
    errors: [] as Array<{ row: number; email?: string; reason: string }>
  };

  const targetRedirect = redirectTo || process.env.MOBILE_CALLBACK_URL || "ukali://auth/callback";

  for (let index = 0; index < rows.length; index += 1) {
    const rowNumber = index + 2;
    const row = rows[index];
    const email = row.email?.toLowerCase();

    if (!email || !isValidEmail(email)) {
      report.errors.push({ row: rowNumber, reason: "Invalid email" });
      continue;
    }

    if (seenEmails.has(email)) {
      report.errors.push({ row: rowNumber, email, reason: "Duplicate email in CSV" });
      continue;
    }
    seenEmails.add(email);

    const role = row.role === "ADMIN" ? "ADMIN" : "MEMBER";
    const paymentStatus = row.payment_status === "PAID" ? "PAID" : "UNPAID";
    const membershipStart = row.membership_start ? new Date(row.membership_start) : null;
    const nextPaymentDue = row.next_payment_due ? new Date(row.next_payment_due) : null;

    if (membershipStart && Number.isNaN(membershipStart.getTime())) {
      report.errors.push({ row: rowNumber, email, reason: "Invalid membership_start ISO date" });
      continue;
    }

    if (nextPaymentDue && Number.isNaN(nextPaymentDue.getTime())) {
      report.errors.push({ row: rowNumber, email, reason: "Invalid next_payment_due ISO date" });
      continue;
    }

    try {
      const user = await prisma.user.upsert({
        where: { email },
        update: {
          name: row.name,
          phone: row.phone || undefined,
          role,
          paymentStatus,
          membershipStart: membershipStart || undefined,
          nextPaymentDue: nextPaymentDue || undefined
        },
        create: {
          email,
          name: row.name,
          phone: row.phone || undefined,
          role,
          paymentStatus,
          membershipStart: membershipStart || undefined,
          nextPaymentDue: nextPaymentDue || undefined
        }
      });

      if (user.supabaseUserId) {
        report.skippedAlreadyLinked.push({ email, userId: user.id });
        continue;
      }

      if (dryRun) {
        report.invited.push({ email, method: "dry_run", userId: user.id });
        continue;
      }

      const result = await sendInvite(supabaseUrl, serviceRoleKey, anonKey, email, targetRedirect);
      await prisma.user.update({ where: { id: user.id }, data: { inviteSentAt: new Date() } });
      report.invited.push({ email, method: result.sentVia, userId: user.id });
    } catch (err: any) {
      report.errors.push({ row: rowNumber, email, reason: err?.message || "Unknown error" });
    }
  }

  const reportsDir = path.join(process.cwd(), "reports");
  fs.mkdirSync(reportsDir, { recursive: true });
  const fileName = `invite-migration-${new Date().toISOString().replace(/[.:]/g, "-")}.json`;
  const reportPath = path.join(reportsDir, fileName);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");

  console.log(`Migration complete. Report: ${reportPath}`);
  console.log(
    JSON.stringify(
      {
        totalRows: report.totalRows,
        invited: report.invited.length,
        skippedAlreadyLinked: report.skippedAlreadyLinked.length,
        errors: report.errors.length
      },
      null,
      2
    )
  );
}

run()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
