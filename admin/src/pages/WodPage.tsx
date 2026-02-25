import React, { useState } from "react";
import { api } from "../api/client";

export default function WodPage() {
  const [date, setDate] = useState("");
  const [description, setDescription] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post("/workouts", { date: new Date(date).toISOString(), description });
    setDescription("");
  };

  return (
    <div className="page">
      <h1>Workout Programming</h1>
      <div className="card" style={{ maxWidth: 520 }}>
        <h3>Upload WOD</h3>
        <form style={{ display: "grid", gap: 12 }} onSubmit={submit}>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <textarea rows={6} placeholder="Workout description" value={description} onChange={(e) => setDescription(e.target.value)} />
          <button className="primary-btn" type="submit">Save</button>
        </form>
      </div>
    </div>
  );
}
