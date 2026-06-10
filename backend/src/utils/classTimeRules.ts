const APP_TIME_ZONE = "Asia/Kathmandu";
const BLOCKED_CLASS_HOUR_IN_APP_TIME = 17;
const BLOCKED_CLASS_MINUTE_IN_APP_TIME = 0;

function getAppHourAndMinute(date: Date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
  const parts = formatter
    .formatToParts(date)
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== "literal") acc[part.type] = part.value;
      return acc;
    }, {});
  return {
    hour: Number(parts.hour),
    minute: Number(parts.minute)
  };
}

export function isBlockedClassTime(date: Date) {
  const { hour, minute } = getAppHourAndMinute(date);
  return hour === BLOCKED_CLASS_HOUR_IN_APP_TIME && minute === BLOCKED_CLASS_MINUTE_IN_APP_TIME;
}

export function removeBlockedClassTimes<T extends { datetime: Date }>(classes: T[]) {
  return classes.filter((klass) => !isBlockedClassTime(klass.datetime));
}
