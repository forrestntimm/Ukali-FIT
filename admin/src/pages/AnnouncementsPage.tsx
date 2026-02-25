import React, { useEffect, useState } from "react";
import { api } from "../api/client";

export default function AnnouncementsPage() {
  const [list, setList] = useState<any[]>([]);
  const [form, setForm] = useState({ title: "", body: "", imageUrl: "" });

  const load = async () => {
    const res = await api.get("/announcements");
    setList(res.data);
  };

  useEffect(() => {
    load();
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = { title: form.title, body: form.body };
    if (form.imageUrl) payload.imageUrl = form.imageUrl;
    await api.post("/announcements", payload);
    setForm({ title: "", body: "", imageUrl: "" });
    load();
  };

  return (
    <div className="page">
      <h1>Announcements</h1>
      <div className="grid grid-2">
        <div className="card">
          <h3>Create Announcement</h3>
          <form style={{ display: "grid", gap: 12 }} onSubmit={create}>
            <input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <textarea rows={5} placeholder="Body" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
            <input placeholder="Image URL (optional)" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} />
            <button className="primary-btn" type="submit">Post</button>
          </form>
        </div>
        <div className="card">
          <h3>Recent</h3>
          <div style={{ display: "grid", gap: 12 }}>
            {list.map((a) => (
              <div key={a.id} className="card" style={{ background: "#0f1629" }}>
                <h4>{a.title}</h4>
                <p style={{ color: "var(--muted)" }}>{a.body}</p>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>{new Date(a.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
