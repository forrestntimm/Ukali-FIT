import React, { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { isPageCacheFresh, readPageCache, writePageCache } from "../lib/pageCache";
import { WORKOUTS_CACHE_KEY, WORKOUTS_CACHE_TTL_MS } from "../lib/adminWarmups";

const APP_TIME_ZONE = "Asia/Kathmandu";

type WorkoutRecord = {
  id: string;
  date: string;
  description: string;
};

function getTodayDateInputValue() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  })
    .formatToParts(new Date())
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== "literal") acc[part.type] = part.value;
      return acc;
    }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function toUtcMidnightIsoFromDateInput(value: string) {
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!dateOnlyMatch) return null;
  const year = Number(dateOnlyMatch[1]);
  const month = Number(dateOnlyMatch[2]);
  const day = Number(dateOnlyMatch[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function getApiErrorMessage(err: any, fallback: string) {
  const apiMessage = err?.response?.data?.message;
  if (typeof apiMessage === "string" && apiMessage.trim().length > 0) return apiMessage;
  const firstValidationMessage = err?.response?.data?.errors?.[0]?.message;
  if (typeof firstValidationMessage === "string" && firstValidationMessage.trim().length > 0) return firstValidationMessage;
  if (typeof err?.message === "string" && err.message.trim().length > 0) return err.message;
  return fallback;
}

function getDateInputValueFromIso(value: string) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

function formatWorkoutDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIME_ZONE,
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(parsed);
}

export default function WodPage() {
  const [wodDate, setWodDate] = useState(getTodayDateInputValue());
  const [wodDescription, setWodDescription] = useState("");
  const [wodSuccess, setWodSuccess] = useState<string | null>(null);
  const [wodError, setWodError] = useState<string | null>(null);
  const [savingWod, setSavingWod] = useState(false);
  const [loadingWorkouts, setLoadingWorkouts] = useState(true);
  const [workouts, setWorkouts] = useState<WorkoutRecord[]>([]);
  const [editingWorkoutId, setEditingWorkoutId] = useState<string | null>(null);

  const loadWorkouts = useCallback(async ({ force = false, background = false }: { force?: boolean; background?: boolean } = {}) => {
    const cachedWorkouts = readPageCache<WorkoutRecord[]>(WORKOUTS_CACHE_KEY);

    if (!force && cachedWorkouts) {
      setWorkouts(cachedWorkouts.data);
      setWodError(null);
      if (isPageCacheFresh(cachedWorkouts.savedAt, WORKOUTS_CACHE_TTL_MS)) {
        setLoadingWorkouts(false);
        return;
      }
      background = true;
    }

    if (!background) setLoadingWorkouts(true);
    try {
      const response = await api.get<WorkoutRecord[]>("/workouts");
      const sorted = [...response.data].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setWorkouts(sorted);
      writePageCache(WORKOUTS_CACHE_KEY, sorted);
    } catch (err: any) {
      setWodError(getApiErrorMessage(err, "Could not load saved workouts."));
    } finally {
      setLoadingWorkouts(false);
    }
  }, []);

  useEffect(() => {
    void loadWorkouts();
  }, [loadWorkouts]);

  const isEditing = editingWorkoutId !== null;
  const editingWorkout = useMemo(
    () => workouts.find((workout) => workout.id === editingWorkoutId) ?? null,
    [editingWorkoutId, workouts]
  );

  const resetForm = useCallback(() => {
    setEditingWorkoutId(null);
    setWodDate(getTodayDateInputValue());
    setWodDescription("");
  }, []);

  const beginEdit = useCallback((workout: WorkoutRecord) => {
    setWodSuccess(null);
    setWodError(null);
    setEditingWorkoutId(workout.id);
    setWodDate(getDateInputValueFromIso(workout.date));
    setWodDescription(workout.description);
  }, []);

  const submitWod = async (e: React.FormEvent) => {
    e.preventDefault();
    setWodSuccess(null);
    setWodError(null);

    if (!wodDate || !wodDescription.trim()) {
      setWodError("Date and workout description are required.");
      return;
    }

    setSavingWod(true);
    try {
      const normalizedDate = toUtcMidnightIsoFromDateInput(wodDate);
      if (!normalizedDate) {
        setWodError("Workout date is invalid.");
        return;
      }

      await api.post("/workouts", { date: normalizedDate, description: wodDescription.trim() });
      await loadWorkouts({ force: true });
      setWodSuccess(isEditing ? "Workout updated." : "Workout saved.");
      resetForm();
    } catch (err: any) {
      setWodError(getApiErrorMessage(err, "Could not save workout."));
    } finally {
      setSavingWod(false);
    }
  };

  return (
    <div className="page">
      <h1>Workout Programming</h1>
      <div className="grid grid-wod">
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <div>
              <h3 style={{ marginBottom: 6 }}>{isEditing ? "Edit Saved Workout" : "Upload WOD"}</h3>
              <p style={{ margin: 0, color: "var(--muted)" }}>
                {isEditing
                  ? "Update the workout text for the selected day."
                  : "Save a new workout for the selected date."}
              </p>
            </div>
            {isEditing ? (
              <button className="secondary-btn" type="button" onClick={resetForm}>
                Cancel Edit
              </button>
            ) : null}
          </div>
          <form style={{ display: "grid", gap: 12 }} onSubmit={submitWod}>
            <input
              type="date"
              value={wodDate}
              onChange={(e) => setWodDate(e.target.value)}
              disabled={isEditing}
              title={isEditing ? "Date is fixed while editing an existing saved workout." : undefined}
            />
            <textarea
              rows={6}
              placeholder="Workout description"
              value={wodDescription}
              onChange={(e) => setWodDescription(e.target.value)}
            />
            <button className="primary-btn" type="submit" disabled={savingWod}>
              {savingWod ? "Saving..." : isEditing ? "Update Workout" : "Save Workout"}
            </button>
          </form>
          {wodSuccess ? <p style={{ color: "var(--success)" }}>{wodSuccess}</p> : null}
          {wodError ? <p style={{ color: "var(--danger)" }}>{wodError}</p> : null}
        </div>

        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <div>
              <h3 style={{ marginBottom: 6 }}>Saved Workouts</h3>
              <p style={{ margin: 0, color: "var(--muted)" }}>
                Click any saved workout to load it into the editor.
              </p>
            </div>
            <button className="secondary-btn" type="button" onClick={() => void loadWorkouts({ force: true })} disabled={loadingWorkouts}>
              {loadingWorkouts ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {loadingWorkouts ? (
            <p style={{ color: "var(--muted)" }}>Loading saved workouts...</p>
          ) : workouts.length === 0 ? (
            <p style={{ color: "var(--muted)" }}>No workouts saved yet.</p>
          ) : (
            <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
              {workouts.map((workout) => {
                const active = workout.id === editingWorkout?.id;
                return (
                  <button
                    key={workout.id}
                    type="button"
                    className="secondary-btn"
                    onClick={() => beginEdit(workout)}
                    style={{
                      textAlign: "left",
                      display: "grid",
                      gap: 8,
                      padding: 16,
                      background: active ? "rgba(249, 115, 22, 0.12)" : undefined,
                      borderColor: active ? "rgba(249, 115, 22, 0.5)" : undefined
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                      <strong>{formatWorkoutDate(workout.date)}</strong>
                      {active ? <span style={{ color: "var(--primary-soft)", fontSize: 13 }}>Editing</span> : null}
                    </div>
                    <span style={{ color: "var(--muted)", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                      {workout.description}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
