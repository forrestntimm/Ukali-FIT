"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    const email = (process.env.SEED_ADMIN_EMAIL || "admin@ukali.app").toLowerCase();
    const password = process.env.SEED_ADMIN_PASSWORD || "ChangeMe123!";
    const name = process.env.SEED_ADMIN_NAME || "Ukali Admin";
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing)
        return;
    const passwordHash = await bcryptjs_1.default.hash(password, 12);
    await prisma.user.create({
        data: {
            email,
            name,
            role: client_1.Role.ADMIN,
            passwordHash,
            paymentStatus: "UNPAID",
            membershipStart: new Date()
        }
    });
}
main()
    .catch((err) => {
    console.error(err);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
