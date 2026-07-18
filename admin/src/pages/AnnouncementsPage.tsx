import React, { useEffect, useState } from "react";
import { api } from "../api/client";
import { isPageCacheFresh, readPageCache, writePageCache } from "../lib/pageCache";
import { ANNOUNCEMENTS_CACHE_KEY, ANNOUNCEMENTS_CACHE_TTL_MS } from "../lib/adminWarmups";

type Announcement = {
  id: string;
  title: string;
  body: string;
  imageUrl?: string | null;
  createdAt: string;
};

export default function AnnouncementsPage() {
  const [list, setList] = useState<Announcement[]>([]);
  const [form, setForm] = useState({ title: "", body: "", imageUrl: "" });
  const [deletingAnnouncementId, setDeletingAnnouncementId] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = async ({ force = false, background = false }: { force?: boolean; background?: boolean } = {}) => {
    const cachedList = readPageCache<Announcement[]>(ANNOUNCEMENTS_CACHE_KEY);

    if (!force && cachedList) {
      setList(cachedList.data);
      setErrorMessage(null);
      if (isPageCacheFresh(cachedList.savedAt, ANNOUNCEMENTS_CACHE_TTL_MS)) {
        setLoadingList(false);
        return;
      }
      background = true;
    }

    if (!background) setLoadingList(true);
    try {
      const res = await api.get("/announcements");
      const nextList = res.data as Announcement[];
      setList(nextList);
      writePageCache(ANNOUNCEMENTS_CACHE_KEY, nextList);
      setErrorMessage(null);
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.message || "Could not load announcements.");
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);
    setErrorMessage(null);

    const title = form.title.trim();
    const body = form.body.trim();
    const imageUrl = form.imageUrl.trim();
    if (!title || !body) {
      setErrorMessage("Title and body are required.");
      return;
    }

    setPosting(true);
    try {
      const payload: any = { title, body };
      if (imageUrl) payload.imageUrl = imageUrl;
      await api.post("/announcements", payload);
      setForm({ title: "", body: "", imageUrl: "" });
      setStatusMessage("Announcement posted.");
      await load({ force: true });
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.message || "Could not post announcement.");
    } finally {
      setPosting(false);
    }
  };

  const removeAnnouncement = async (announcement: Announcement) => {
    const confirmed = window.confirm(`Delete "${announcement.title}"? This cannot be undone.`);
    if (!confirmed) return;

    setDeletingAnnouncementId(announcement.id);
    try {
      const nextList = list.filter((item) => item.id !== announcement.id);
      await api.delete(`/announcements/${announcement.id}`);
      setList(nextList);
      writePageCache(ANNOUNCEMENTS_CACHE_KEY, nextList);
      setStatusMessage("Announcement deleted.");
      setErrorMessage(null);
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.message || "Could not delete announcement.");
    } finally {
      setDeletingAnnouncementId(null);
    }
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
            <button className="primary-btn" type="submit" disabled={posting}>{posting ? "Posting..." : "Post"}</button>
          </form>
          {statusMessage ? <p style={{ color: "var(--success)" }}>{statusMessage}</p> : null}
          {errorMessage ? <p style={{ color: "var(--danger)" }}>{errorMessage}</p> : null}
        </div>
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <h3 style={{ margin: 0 }}>Recent</h3>
            <button className="secondary-btn" type="button" onClick={() => void load({ force: true })} disabled={loadingList}>
              {loadingList ? "Refreshing..." : "Refresh"}
            </button>
          </div>
          {loadingList ? <p style={{ color: "var(--muted)" }}>Loading announcements...</p> : null}
          {!loadingList && list.length === 0 ? <p style={{ color: "var(--muted)" }}>No announcements posted yet.</p> : null}
          <div style={{ display: "grid", gap: 12 }}>
            {list.map((a) => (
              <div key={a.id} className="card" style={{ background: "#0f1629" }}>
                <h4 style={{ margin: 0 }}>{a.title}</h4>
                <p style={{ color: "var(--muted)" }}>{a.body}</p>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, color: "var(--muted)" }}>{new Date(a.createdAt).toLocaleString()}</span>
                  <button
                    className="secondary-btn"
                    type="button"
                    disabled={deletingAnnouncementId === a.id}
                    onClick={() => void removeAnnouncement(a)}
                    style={{ borderColor: "var(--danger)", color: "var(--danger)", padding: "6px 12px" }}
                  >
                    {deletingAnnouncementId === a.id ? "Deleting..." : "Delete Announcement"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
