import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { isPageCacheFresh, readPageCache, writePageCache } from "../lib/pageCache";

const APP_TIME_ZONE = "Asia/Kathmandu";
const SCHEDULING_CACHE_TTL_MS = 5 * 60 * 1000;
const DATE_KEY_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});
const WEEKDAY_LABEL_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIME_ZONE,
  weekday: "long"
});
const WEEK_HEADER_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIME_ZONE,
  month: "long",
  day: "numeric"
});
const TIME_KEY_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  timeZone: APP_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false
});
const TIME_LABEL_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  timeZone: APP_TIME_ZONE,
  hour: "numeric",
  minute: "2-digit",
  hour12: false
});

type Coach = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "MEMBER";
};

type CoachSummary = {
  id: string;
  name: string;
  email: string;
};

type ScheduleItem = {
  id: string;
  title: string;
  datetime: string;
  capacity: number;
  status: "OPEN" | "CLOSED" | "CANCELED";
  coachId?: string | null;
  secondaryCoachId?: string | null;
  coach?: CoachSummary | null;
  secondaryCoach?: CoachSummary | null;
};

type CoachAssignmentState = {
  primaryCoachId: string;
  secondaryCoachId: string;
};

type CoachAssignmentRole = "primaryCoachId" | "secondaryCoachId";

type ScheduleClassCell = ScheduleItem & {
  dayKey: string;
  timeKey: string;
  timeLabel: string;
};

type SlotRow = {
  slotKey: string;
  title: string;
  timeKey: string;
  timeLabel: string;
  label: string;
  byDayKey: Record<string, ScheduleClassCell | undefined>;
};

function buildCoachAssignments(items: ScheduleItem[]) {
  return items.reduce<Record<string, CoachAssignmentState>>((acc, item) => {
    acc[item.id] = {
      primaryCoachId: item.coachId || "",
      secondaryCoachId: item.secondaryCoachId || ""
    };
    return acc;
  }, {});
}

function getDateKeyInAppTimeZone(value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  const parts = DATE_KEY_FORMATTER
    .formatToParts(date)
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== "literal") acc[part.type] = part.value;
      return acc;
    }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function shiftDateKey(dateKey: string, days: number) {
  const base = new Date(`${dateKey}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

function getWeekStartKey(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00Z`);
  const dayOfWeek = date.getUTCDay();
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  return shiftDateKey(dateKey, -daysSinceMonday);
}

function formatWeekdayLabel(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00Z`);
  return WEEKDAY_LABEL_FORMATTER.format(date);
}

function formatWeekHeader(startKey: string) {
  const startDate = new Date(`${startKey}T00:00:00Z`);
  return WEEK_HEADER_FORMATTER.format(startDate);
}

function getTimeKeyInAppTimeZone(value: string) {
  const parts = TIME_KEY_FORMATTER
    .formatToParts(new Date(value))
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== "literal") acc[part.type] = part.value;
      return acc;
    }, {});
  return `${parts.hour}:${parts.minute}`;
}

function formatTimeLabel(value: string) {
  return TIME_LABEL_FORMATTER.format(new Date(value));
}

function decorateScheduleItems(items: ScheduleItem[]): ScheduleClassCell[] {
  return items.map((item) => ({
    ...item,
    dayKey: getDateKeyInAppTimeZone(item.datetime),
    timeKey: getTimeKeyInAppTimeZone(item.datetime),
    timeLabel: formatTimeLabel(item.datetime)
  }));
}

function getCoachName(coachesById: Map<string, Coach>, coachId?: string | null) {
  if (!coachId) return "Unassigned";
  return coachesById.get(coachId)?.name || "Unknown coach";
}

function getAssignmentKey(classId: string, role: CoachAssignmentRole) {
  return `${classId}:${role}`;
}

function getApiErrorMessage(err: any, fallback: string) {
  const apiMessage = err?.response?.data?.message;
  if (typeof apiMessage === "string" && apiMessage.trim().length > 0) return apiMessage;
  const firstValidationMessage = err?.response?.data?.errors?.[0]?.message;
  if (typeof firstValidationMessage === "string" && firstValidationMessage.trim().length > 0) return firstValidationMessage;
  if (typeof err?.message === "string" && err.message.trim().length > 0) return err.message;
  return fallback;
}

export default function SchedulingPage() {
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [scheduleItems, setScheduleItems] = useState<ScheduleClassCell[]>([]);
  const [coachAssignmentsByClassId, setCoachAssignmentsByClassId] = useState<Record<string, CoachAssignmentState>>({});
  const [savingClassIds, setSavingClassIds] = useState<Record<string, boolean>>({});
  const [editingAssignmentKey, setEditingAssignmentKey] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadingScheduleData, setLoadingScheduleData] = useState(false);
  const [weekStartKey, setWeekStartKey] = useState(() => {
    const todayKey = getDateKeyInAppTimeZone(new Date());
    return getWeekStartKey(todayKey);
  });

  const weekDayKeys = useMemo(() => {
    return Array.from({ length: 5 }, (_, index) => shiftDateKey(weekStartKey, index));
  }, [weekStartKey]);

  const weekEndKey = weekDayKeys[weekDayKeys.length - 1];
  const weekHeaderLabel = useMemo(() => formatWeekHeader(weekStartKey), [weekStartKey]);

  const coachesById = useMemo(() => {
    return new Map(coaches.map((coach) => [coach.id, coach]));
  }, [coaches]);

  useEffect(() => {
    let cancelled = false;
    const from = `${weekStartKey}T00:00:00.000Z`;
    const to = `${weekEndKey}T23:59:59.999Z`;
    const scheduleCacheKey = `scheduling:${weekStartKey}:${weekEndKey}`;

    const cachedUsers = readPageCache<Coach[]>("admin-coaches");
    const cachedSchedule = readPageCache<ScheduleItem[]>(scheduleCacheKey);

    if (cachedUsers) {
      setCoaches(cachedUsers.data);
    }

    if (cachedSchedule) {
      const decoratedCachedSchedule = decorateScheduleItems(cachedSchedule.data);
      setScheduleItems(decoratedCachedSchedule);
      setCoachAssignmentsByClassId(buildCoachAssignments(decoratedCachedSchedule));
      setLoadingScheduleData(false);
    }

    const usersFresh = cachedUsers && isPageCacheFresh(cachedUsers.savedAt, SCHEDULING_CACHE_TTL_MS);
    const scheduleFresh = cachedSchedule && isPageCacheFresh(cachedSchedule.savedAt, SCHEDULING_CACHE_TTL_MS);
    if (usersFresh && scheduleFresh) {
      return () => {
        cancelled = true;
      };
    }

    const load = async () => {
      try {
        if (!cachedSchedule && !cancelled) setLoadingScheduleData(true);
        const [usersRes, classesRes] = await Promise.all([
          usersFresh ? Promise.resolve({ data: cachedUsers!.data }) : api.get("/users/coaches"),
          scheduleFresh ? Promise.resolve({ data: cachedSchedule!.data }) : api.get("/scheduling/classes", { params: { from, to } })
        ]);

        if (cancelled) return;

        const adminCoaches = usersRes.data as Coach[];
        const classes = decorateScheduleItems(classesRes.data as ScheduleItem[]);

        setCoaches(adminCoaches);
        setScheduleItems(classes);
        setCoachAssignmentsByClassId(buildCoachAssignments(classes));
        if (!usersFresh) writePageCache("admin-coaches", adminCoaches);
        if (!scheduleFresh) writePageCache(scheduleCacheKey, classesRes.data as ScheduleItem[]);
        setErrorMessage(null);
      } catch (err: any) {
        if (cancelled) return;
        setErrorMessage(getApiErrorMessage(err, "Could not load coaching schedule."));
      } finally {
        if (!cancelled) setLoadingScheduleData(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [weekEndKey, weekStartKey]);

  const slotRows = useMemo<SlotRow[]>(() => {
    const dayKeySet = new Set(weekDayKeys);
    const slots = new Map<string, SlotRow>();

    for (const item of scheduleItems) {
      const dayKey = item.dayKey;
      if (!dayKeySet.has(dayKey)) continue;

      const timeKey = item.timeKey;
      const slotKey = `${timeKey}__${item.title}`;
      const existing = slots.get(slotKey);

      if (existing) {
        existing.byDayKey[dayKey] = item;
        continue;
      }

      slots.set(slotKey, {
        slotKey,
        title: item.title,
        timeKey,
        timeLabel: item.timeLabel,
        label: `${item.timeLabel} ${item.title}`,
        byDayKey: { [dayKey]: item }
      });
    }

    return [...slots.values()].sort((a, b) => {
      if (a.timeKey === b.timeKey) return a.title.localeCompare(b.title);
      return a.timeKey.localeCompare(b.timeKey);
    });
  }, [scheduleItems, weekDayKeys]);

  const saveCoachAssignments = async (
    item: ScheduleClassCell,
    nextAssignments: CoachAssignmentState,
    roleLabel: "primary" | "secondary"
  ) => {
    setSuccessMessage(null);
    setErrorMessage(null);

    if (
      nextAssignments.primaryCoachId &&
      nextAssignments.secondaryCoachId &&
      nextAssignments.primaryCoachId === nextAssignments.secondaryCoachId
    ) {
      setErrorMessage("Primary and secondary coach must be different people.");
      return;
    }

    setSavingClassIds((prev) => ({ ...prev, [item.id]: true }));
    try {
      const response = await api.patch<ScheduleItem>(`/scheduling/classes/${item.id}/coaches`, {
        primaryCoachId: nextAssignments.primaryCoachId || null,
        secondaryCoachId: nextAssignments.secondaryCoachId || null
      });

      const updated = decorateScheduleItems([response.data])[0];

      setCoachAssignmentsByClassId((prev) => ({
        ...prev,
        [item.id]: {
          primaryCoachId: updated.coachId || "",
          secondaryCoachId: updated.secondaryCoachId || ""
        }
      }));

      setScheduleItems((prev) => prev.map((entry) => (entry.id === item.id ? updated : entry)));
      setEditingAssignmentKey(null);
      setSuccessMessage(
        `${item.title} on ${formatWeekdayLabel(getDateKeyInAppTimeZone(item.datetime))} ${roleLabel} coach saved.`
      );
    } catch (err: any) {
      setErrorMessage(getApiErrorMessage(err, "Could not save coach assignment."));
    } finally {
      setSavingClassIds((prev) => ({ ...prev, [item.id]: false }));
    }
  };

  const updateCoachAssignment = (
    item: ScheduleClassCell,
    role: CoachAssignmentRole,
    value: string
  ) => {
    const current = coachAssignmentsByClassId[item.id] || {
      primaryCoachId: item.coachId || "",
      secondaryCoachId: item.secondaryCoachId || ""
    };
    const nextAssignments = {
      ...current,
      [role]: value
    };

    setCoachAssignmentsByClassId((prev) => ({
      ...prev,
      [item.id]: nextAssignments
    }));

    void saveCoachAssignments(item, nextAssignments, role === "primaryCoachId" ? "primary" : "secondary");
  };

  const renderCoachCell = (item: ScheduleClassCell, role: CoachAssignmentRole) => {
    const isPrimary = role === "primaryCoachId";
    const assignmentKey = getAssignmentKey(item.id, role);
    const isEditing = editingAssignmentKey === assignmentKey;
    const saving = savingClassIds[item.id];
    const assignments = coachAssignmentsByClassId[item.id] || {
      primaryCoachId: item.coachId || "",
      secondaryCoachId: item.secondaryCoachId || ""
    };
    const value = assignments[role] || "";
    const secondaryValue = assignments.secondaryCoachId || "";
    const primaryValue = assignments.primaryCoachId || "";

    if (!isEditing) {
      const coachName = getCoachName(coachesById, isPrimary ? primaryValue : secondaryValue);
      return (
        <div className="schedule-coach-cell">
          <div className="schedule-coach-name">{coachName}</div>
          <button
            className="schedule-inline-btn"
            type="button"
            onClick={() => setEditingAssignmentKey(assignmentKey)}
          >
            Edit
          </button>
        </div>
      );
    }

    return (
      <div className="schedule-coach-cell">
        <select
          value={value}
          disabled={saving}
          onChange={(e) => updateCoachAssignment(item, role, e.target.value)}
          style={{ width: "100%" }}
        >
          <option value="">Unassigned</option>
          {coaches.map((coachOption) => (
            <option key={coachOption.id} value={coachOption.id}>
              {coachOption.name}
            </option>
          ))}
        </select>
        <div className="schedule-coach-actions">
          <button
            className="schedule-inline-btn"
            type="button"
            disabled={saving}
            onClick={() => setEditingAssignmentKey(null)}
          >
            Cancel
          </button>
          {saving ? <div style={{ fontSize: 12, color: "var(--muted)" }}>Saving…</div> : null}
        </div>
        {!isPrimary && primaryValue && primaryValue === value ? (
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>Same as primary is not allowed.</div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="page">
      <h1>Scheduling</h1>
      <div className="grid">
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div>
              <h3 style={{ margin: 0 }}>Coaching Schedule</h3>
              <p style={{ color: "var(--muted)", margin: "8px 0 0" }}>
                Every admin user appears in the primary and secondary coach dropdowns.
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <button
                className="secondary-btn"
                type="button"
                onClick={() => setWeekStartKey((prev) => shiftDateKey(prev, -7))}
              >
                Prev Week
              </button>
              <span style={{ color: "var(--muted)", minWidth: 170, textAlign: "center" }}>Week of {weekHeaderLabel}</span>
              <button
                className="secondary-btn"
                type="button"
                onClick={() => setWeekStartKey((prev) => shiftDateKey(prev, 7))}
              >
                Next Week
              </button>
            </div>
          </div>

          {loadingScheduleData ? <p style={{ color: "var(--muted)", marginTop: 16 }}>Loading schedule...</p> : null}
          {successMessage ? <p style={{ color: "var(--success)", marginTop: 12 }}>{successMessage}</p> : null}
          {errorMessage ? <p style={{ color: "var(--danger)", marginTop: 12 }}>{errorMessage}</p> : null}

          {loadingScheduleData ? null : slotRows.length === 0 ? (
            <p style={{ color: "var(--muted)", marginTop: 16 }}>No classes found for this week.</p>
          ) : (
            <div style={{ overflowX: "auto", marginTop: 16 }}>
              <table className="table schedule-grid-table">
                <thead>
                  <tr>
                    <th style={{ minWidth: 220 }}>Week of the {weekHeaderLabel}</th>
                    <th style={{ minWidth: 170 }}>Primary / Secondary</th>
                    {weekDayKeys.map((dayKey) => (
                      <th key={dayKey} style={{ minWidth: 190 }}>
                        {formatWeekdayLabel(dayKey)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {slotRows.map((slot) => (
                    <React.Fragment key={slot.slotKey}>
                      <tr>
                        <td rowSpan={2} style={{ fontWeight: 700, color: "var(--text)", verticalAlign: "middle" }}>
                          {slot.label}
                        </td>
                        <td style={{ fontWeight: 700, color: "var(--primary-soft)" }}>Primary</td>
                        {weekDayKeys.map((dayKey) => {
                          const item = slot.byDayKey[dayKey];
                          if (!item) {
                            return <td key={`${slot.slotKey}-${dayKey}-primary`} className="schedule-empty-cell" />;
                          }

                          const value = coachAssignmentsByClassId[item.id]?.primaryCoachId ?? item.coachId ?? "";
                          const saving = savingClassIds[item.id];

                          return (
                            <td key={`${slot.slotKey}-${dayKey}-primary`}>
                              {renderCoachCell(item, "primaryCoachId")}
                            </td>
                          );
                        })}
                      </tr>
                      <tr>
                        <td style={{ fontWeight: 700, color: "#f5b5b5" }}>Secondary</td>
                        {weekDayKeys.map((dayKey) => {
                          const item = slot.byDayKey[dayKey];
                          if (!item) {
                            return <td key={`${slot.slotKey}-${dayKey}-secondary`} className="schedule-empty-cell" />;
                          }

                          const primaryValue =
                            coachAssignmentsByClassId[item.id]?.primaryCoachId ?? item.coachId ?? "";
                          const value =
                            coachAssignmentsByClassId[item.id]?.secondaryCoachId ?? item.secondaryCoachId ?? "";
                          const saving = savingClassIds[item.id];

                          return (
                            <td key={`${slot.slotKey}-${dayKey}-secondary`}>
                              {renderCoachCell(item, "secondaryCoachId")}
                            </td>
                          );
                        })}
                      </tr>
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
