import { prisma } from "../utils/prisma";
import { clearResponseCache, readResponseCache, writeResponseCache } from "../utils/responseCache";

export async function createAnnouncement(data: { title: string; body: string; imageUrl?: string }) {
  const announcement = await prisma.announcement.create({ data });
  clearResponseCache("announcements:");
  return announcement;
}

export async function listAnnouncements() {
  const cached = readResponseCache<Awaited<ReturnType<typeof prisma.announcement.findMany>>>("announcements:list");
  if (cached) return cached;

  const announcements = await prisma.announcement.findMany({ orderBy: { createdAt: "desc" } });
  return writeResponseCache("announcements:list", announcements, 60 * 1000);
}

export async function deleteAnnouncement(id: string) {
  const deleted = await prisma.announcement.delete({ where: { id } });
  clearResponseCache("announcements:");
  return deleted;
}
