const QR_PREFIX = "ukali-checkin:v1:";

export function buildCheckInQrPayload(checkInQrCode?: string | null) {
  const normalized = checkInQrCode?.trim() || "";
  if (!normalized) return "";
  return `${QR_PREFIX}${normalized}`;
}

