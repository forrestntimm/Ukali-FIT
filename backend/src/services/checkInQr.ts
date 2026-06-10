const QR_PREFIX = "ukali-checkin:v1:";

export function normalizeCheckInQrCode(rawValue: string) {
  const normalized = rawValue.trim();
  if (!normalized) {
    return "";
  }

  return normalized.startsWith(QR_PREFIX) ? normalized.slice(QR_PREFIX.length).trim() : normalized;
}

