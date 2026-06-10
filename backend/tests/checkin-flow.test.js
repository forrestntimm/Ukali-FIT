const assert = require("node:assert/strict");
const test = require("node:test");

require("ts-node/register/transpile-only");

const { PaymentStatus } = require("@prisma/client");
const { normalizeCheckInQrCode } = require("../src/services/checkInQr");
const { withMembershipStatusAndProfileMetrics } = require("../src/services/userService");

function withMockedNow(isoString, run) {
  const RealDate = Date;
  const fixed = new RealDate(isoString);

  class MockDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) {
        super(fixed);
        return;
      }
      super(...args);
    }

    static now() {
      return fixed.getTime();
    }
  }

  global.Date = MockDate;

  try {
    return run();
  } finally {
    global.Date = RealDate;
  }
}

test("stable QR payload resolves back to the member's persisted QR code", () => {
  const storedCode = "9e2ab230-b816-4e54-bc4d-4dd2c9f8d0b1";

  assert.equal(normalizeCheckInQrCode(storedCode), storedCode);
  assert.equal(normalizeCheckInQrCode(`ukali-checkin:v1:${storedCode}`), storedCode);
  assert.equal(normalizeCheckInQrCode("   ukali-checkin:v1:abc123   "), "abc123");
});

test("checked-in classes drive both the total attended counter and workout streak", () => {
  withMockedNow("2026-03-25T12:00:00.000Z", () => {
    const profile = withMembershipStatusAndProfileMetrics({
      id: "member-1",
      name: "Athlete One",
      nextPaymentDue: new Date("2026-04-01T00:00:00.000Z"),
      paymentStatus: PaymentStatus.PAID,
      classSignups: [
        {
          checkedInAt: null,
          class: {
            datetime: new Date("2026-03-25T06:00:00.000Z"),
            status: "OPEN"
          }
        },
        {
          checkedInAt: new Date("2026-03-24T07:00:00.000Z"),
          class: {
            datetime: new Date("2026-03-24T06:00:00.000Z"),
            status: "OPEN"
          }
        },
        {
          checkedInAt: new Date("2026-03-23T07:00:00.000Z"),
          class: {
            datetime: new Date("2026-03-23T06:00:00.000Z"),
            status: "OPEN"
          }
        },
        {
          checkedInAt: new Date("2026-03-20T07:00:00.000Z"),
          class: {
            datetime: new Date("2026-03-20T06:00:00.000Z"),
            status: "CANCELED"
          }
        }
      ]
    });

    assert.equal(profile.classesTotalAttended, 2);
    assert.equal(profile.workoutStreak, 2);
    assert.equal(profile.membershipStatus, "ACTIVE");
  });
});
