import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import {
  GeneratedAthleteClass,
  generateAthleteSchedule,
  getDateKeyFromDate,
  getTenYearEndDateKey
} from "../src/services/athleteScheduleTemplate";

const prisma = new PrismaClient();
const CREATE_MANY_CHUNK_SIZE = 500;

function readArg(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function summarizeSample(classes: GeneratedAthleteClass[]) {
  return classes.slice(0, 5).map((klass) => ({
    date: klass.dateKey,
    day: klass.weekdayLabel,
    time: klass.time,
    title: klass.title,
    utc: klass.datetime.toISOString()
  }));
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const startDateKey = readArg("start") || getDateKeyFromDate(new Date());
  const endDateKey = readArg("end") || getTenYearEndDateKey(startDateKey);
  const classes = generateAthleteSchedule({ startDateKey, endDateKey });

  const existingClasses = await prisma.class.findMany({
    where: {
      datetime: {
        gte: classes[0]?.datetime,
        lte: classes[classes.length - 1]?.datetime
      }
    },
    select: {
      id: true,
      title: true,
      datetime: true,
      capacity: true,
      status: true
    }
  });
  const existingByDateTime = new Map(existingClasses.map((klass) => [klass.datetime.toISOString(), klass]));

  let unchanged = 0;
  const missingClasses: GeneratedAthleteClass[] = [];
  const classesToUpdate: { id: string; klass: GeneratedAthleteClass }[] = [];

  for (const klass of classes) {
    const existing = existingByDateTime.get(klass.datetime.toISOString());
    if (!existing) {
      missingClasses.push(klass);
      continue;
    }
    if (existing.title === klass.title && existing.capacity === klass.capacity) {
      unchanged += 1;
    } else {
      classesToUpdate.push({ id: existing.id, klass });
    }
  }

  console.log(JSON.stringify({
    dryRun,
    startDateKey,
    endDateKey,
    generated: classes.length,
    existing: existingClasses.length,
    wouldCreate: missingClasses.length,
    wouldUpdate: classesToUpdate.length,
    unchanged,
    sample: summarizeSample(classes)
  }, null, 2));

  if (dryRun) return;

  let created = 0;
  let updated = 0;

  for (const { id, klass } of classesToUpdate) {
    await prisma.class.update({
      where: { id },
      data: {
        title: klass.title,
        capacity: klass.capacity
      }
    });
    updated += 1;
  }

  for (let index = 0; index < missingClasses.length; index += CREATE_MANY_CHUNK_SIZE) {
    const chunk = missingClasses.slice(index, index + CREATE_MANY_CHUNK_SIZE);
    const result = await prisma.class.createMany({
      data: chunk.map((klass) => ({
        title: klass.title,
        datetime: klass.datetime,
        capacity: klass.capacity
      }))
    });
    created += result.count;
  }

  console.log(JSON.stringify({ created, updated, unchanged }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
