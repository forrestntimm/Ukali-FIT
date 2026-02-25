import { prisma } from "../utils/prisma";

export async function createAnnouncement(data: { title: string; body: string; imageUrl?: string }) {
  return prisma.announcement.create({ data });
}

export async function listAnnouncements() {
  return prisma.announcement.findMany({ orderBy: { createdAt: "desc" } });
}

export async function deleteAnnouncement(id: string) {
  return prisma.announcement.delete({ where: { id } });
}
