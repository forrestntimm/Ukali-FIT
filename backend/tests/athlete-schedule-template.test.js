const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

require("ts-node/register/transpile-only");

const {
  ATHLETE_WEEKLY_CLASS_TEMPLATE,
  buildAthleteClassDateTime,
  generateAthleteSchedule
} = require("../src/services/athleteScheduleTemplate");

const packageRoot = path.resolve(__dirname, "..");
const populateScriptPath = path.join(packageRoot, "scripts/populateAthleteSchedule.ts");

test("athlete weekly schedule matches the current client class template", () => {
  assert.deepEqual(ATHLETE_WEEKLY_CLASS_TEMPLATE, [
    { weekday: 1, time: "06:00", title: "Regular Class", capacity: 20 },
    { weekday: 1, time: "10:30", title: "Open Gym", capacity: 20 },
    { weekday: 1, time: "16:00", title: "Regular Class", capacity: 20 },
    { weekday: 2, time: "06:00", title: "Regular Class", capacity: 20 },
    { weekday: 2, time: "09:30", title: "Women's Class", capacity: 20 },
    { weekday: 2, time: "10:30", title: "Open Gym", capacity: 20 },
    { weekday: 2, time: "16:00", title: "Kids Fit", capacity: 20 },
    { weekday: 3, time: "06:00", title: "Regular Class", capacity: 20 },
    { weekday: 3, time: "10:30", title: "Open Gym", capacity: 20 },
    { weekday: 3, time: "16:00", title: "Regular Class", capacity: 20 },
    { weekday: 4, time: "06:00", title: "Regular Class", capacity: 20 },
    { weekday: 4, time: "10:30", title: "Open Gym", capacity: 20 },
    { weekday: 4, time: "16:00", title: "Regular Class", capacity: 20 },
    { weekday: 5, time: "06:00", title: "Regular Class", capacity: 20 },
    { weekday: 5, time: "10:30", title: "Open Gym", capacity: 20 },
    { weekday: 5, time: "16:00", title: "Regular Class", capacity: 20 }
  ]);
});

test("buildAthleteClassDateTime stores Nepal local class times as UTC instants", () => {
  assert.equal(buildAthleteClassDateTime("2026-07-20", "06:00").toISOString(), "2026-07-20T00:15:00.000Z");
  assert.equal(buildAthleteClassDateTime("2026-07-21", "16:00").toISOString(), "2026-07-21T10:15:00.000Z");
});

test("generateAthleteSchedule includes weekdays with date labels and no weekend classes", () => {
  const schedule = generateAthleteSchedule({
    startDateKey: "2026-07-18",
    endDateKey: "2026-07-24"
  });

  assert.equal(schedule.length, 16);
  assert.deepEqual(
    schedule.map((klass) => `${klass.weekdayLabel} ${klass.dateKey} ${klass.time} ${klass.title}`),
    [
      "Monday 2026-07-20 06:00 Regular Class",
      "Monday 2026-07-20 10:30 Open Gym",
      "Monday 2026-07-20 16:00 Regular Class",
      "Tuesday 2026-07-21 06:00 Regular Class",
      "Tuesday 2026-07-21 09:30 Women's Class",
      "Tuesday 2026-07-21 10:30 Open Gym",
      "Tuesday 2026-07-21 16:00 Kids Fit",
      "Wednesday 2026-07-22 06:00 Regular Class",
      "Wednesday 2026-07-22 10:30 Open Gym",
      "Wednesday 2026-07-22 16:00 Regular Class",
      "Thursday 2026-07-23 06:00 Regular Class",
      "Thursday 2026-07-23 10:30 Open Gym",
      "Thursday 2026-07-23 16:00 Regular Class",
      "Friday 2026-07-24 06:00 Regular Class",
      "Friday 2026-07-24 10:30 Open Gym",
      "Friday 2026-07-24 16:00 Regular Class"
    ]
  );
});

test("athlete schedule population script bulk-creates missing future classes", () => {
  const source = fs.readFileSync(populateScriptPath, "utf8");

  assert.match(source, /createMany/, "schedule population should not insert 10 years of classes one row at a time");
  assert.match(source, /missingClasses/, "schedule population should separate missing classes from existing rows");
});
