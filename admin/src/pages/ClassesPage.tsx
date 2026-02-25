import React, { useEffect, useState } from "react";
import { api } from "../api/client";

const APP_TIME_ZONE = "Asia/Kathmandu";

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-NP", {
    timeZone: APP_TIME_ZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  }).format(new Date(value));
}

export default function ClassesPage() {
  const [classes, setClasses] = useState<any[]>([]);
  const [form, setForm] = useState({ title: "", datetime: "", capacity: 12 });
  const [selectedClass, setSelectedClass] = useState<any | null>(null);
  const [signups, setSignups] = useState<any[]>([]);
  const [loadingSignups, setLoadingSignups] = useState(false);
  const [signupsError, setSignupsError] = useState<string | null>(null);

  const load = async () => {
    const res = await api.get("/classes");
    setClasses(res.data);
  };

  useEffect(() => {
    load();
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.post("/classes", { ...form, datetime: new Date(form.datetime).toISOString() });
    setForm({ title: "", datetime: "", capacity: 12 });
    load();
  };

  const updateStatus = async (id: string, status: string) => {
    await api.patch(`/classes/${id}/status`, { status });
    load();
  };

  const openSignups = async (klass: any) => {
    setSelectedClass(klass);
    setSignups([]);
    setSignupsError(null);
    setLoadingSignups(true);
    try {
      const res = await api.get(`/classes/${klass.id}/signups`);
      setSignups(res.data);
    } catch (err: any) {
      setSignupsError(err?.response?.data?.message || "Could not load reservations.");
    } finally {
      setLoadingSignups(false);
    }
  };

  return (
    <div className="page">
      <h1>Classes</h1>
      <div className="grid">
        <div className="card">
          <h3>Create Class</h3>
          <form style={{ display: "grid", gap: 12 }} onSubmit={create}>
            <input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <input type="datetime-local" value={form.datetime} onChange={(e) => setForm({ ...form, datetime: e.target.value })} />
            <input type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} />
            <button className="primary-btn" type="submit">Create</button>
          </form>
        </div>
        <div className="card">
          <h3>Upcoming Classes</h3>
          <table className="table">
            <thead>
              <tr>
                <th>Class</th>
                <th>Date</th>
                <th>Reservations</th>
                <th>Checked In</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {classes.map((c) => (
                <tr key={c.id}>
                  <td>{c.title}</td>
                  <td>{formatDateTime(c.datetime)}</td>
                  <td>{c.signups?.length || 0}/{c.capacity}</td>
                  <td>{c.signups?.filter((signup: any) => signup.checkedInAt).length || 0}</td>
                  <td>
                    <select value={c.status} onChange={(e) => updateStatus(c.id, e.target.value)}>
                      <option value="OPEN">OPEN</option>
                      <option value="CLOSED">CLOSED</option>
                      <option value="CANCELED">CANCELED</option>
                    </select>
                  </td>
                  <td>
                    <button className="secondary-btn" type="button" onClick={() => openSignups(c)}>
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selectedClass ? (
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Reservations</h3>
            <p style={{ marginTop: 0, color: "#94a3b8" }}>
              {selectedClass.title} • {formatDateTime(selectedClass.datetime)}
            </p>

            {loadingSignups ? <p>Loading...</p> : null}
            {signupsError ? <p style={{ color: "#ef4444" }}>{signupsError}</p> : null}

            {!loadingSignups && !signupsError && signups.length === 0 ? (
              <p style={{ color: "#94a3b8" }}>No one has reserved this class yet.</p>
            ) : null}

            {!loadingSignups && !signupsError && signups.length > 0 ? (
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Reserved At</th>
                    <th>Checked In</th>
                  </tr>
                </thead>
                <tbody>
                  {signups.map((signup) => (
                    <tr key={signup.id}>
                      <td>{signup.user?.name || "Unknown"}</td>
                      <td>{signup.user?.email || "—"}</td>
                      <td>{signup.user?.phone || "—"}</td>
                      <td>{formatDateTime(signup.createdAt)}</td>
                      <td>{signup.checkedInAt ? formatDateTime(signup.checkedInAt) : "No"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
