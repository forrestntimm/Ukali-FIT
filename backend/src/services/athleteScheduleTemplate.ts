const NEPAL_UTC_OFFSET_MINUTES = 5 * 60 + 45;

export type AthleteClassTemplateEntry = {
  weekday: number;
  time: string;
  title: string;
  capacity: number;
};

export type GeneratedAthleteClass = AthleteClassTemplateEntry & {
  dateKey: string;
  weekdayLabel: string;
  datetime: Date;
};

export const ATHLETE_WEEKLY_CLASS_TEMPLATE: AthleteClassTemplateEntry[] = [
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
];

const WEEKDAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function buildAthleteClassDateTime(dateKey: string, time: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const utcMillis = Date.UTC(year, month - 1, day, hour, minute) - NEPAL_UTC_OFFSET_MINUTES * 60 * 1000;
  return new Date(utcMillis);
}

function shiftDateKey(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function getUtcWeekday(dateKey: string) {
  return new Date(`${dateKey}T00:00:00.000Z`).getUTCDay();
}

export function getDateKeyFromDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

export function getTenYearEndDateKey(startDateKey: string) {
  const date = new Date(`${startDateKey}T00:00:00.000Z`);
  date.setUTCFullYear(date.getUTCFullYear() + 10);
  return date.toISOString().slice(0, 10);
}

export function generateAthleteSchedule(args: {
  startDateKey: string;
  endDateKey: string;
  template?: AthleteClassTemplateEntry[];
}) {
  const template = args.template ?? ATHLETE_WEEKLY_CLASS_TEMPLATE;
  const byWeekday = template.reduce<Record<number, AthleteClassTemplateEntry[]>>((acc, entry) => {
    if (!acc[entry.weekday]) acc[entry.weekday] = [];
    acc[entry.weekday].push(entry);
    return acc;
  }, {});

  const classes: GeneratedAthleteClass[] = [];
  for (let dateKey = args.startDateKey; dateKey <= args.endDateKey; dateKey = shiftDateKey(dateKey, 1)) {
    const weekday = getUtcWeekday(dateKey);
    const dayEntries = byWeekday[weekday] ?? [];
    for (const entry of dayEntries) {
      classes.push({
        ...entry,
        dateKey,
        weekdayLabel: WEEKDAY_LABELS[weekday],
        datetime: buildAthleteClassDateTime(dateKey, entry.time)
      });
    }
  }

  return classes;
}
