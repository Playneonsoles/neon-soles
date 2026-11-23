import { PrismaClient } from "@prisma/client";

const g = globalThis as unknown as { __prisma?: PrismaClient };
export const prisma = g.__prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") g.__prisma = prisma;

export * from "@prisma/client";
export * from "./config";
export * from "./walk";
export * from "./emission";
export * from "./claims";
export * from "./admin";
export * from "./upgrades";
export * from "./quests";
export * from "./gifts";
