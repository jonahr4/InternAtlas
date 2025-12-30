import { PrismaClient } from "@prisma/client";

const globalForPrisma = global as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: [
      {
        emit: 'event',
        level: 'error',
      },
      { emit: 'stdout', level: 'warn' }
    ],
  });

// Filter out P2002 (unique constraint) errors from logs since we handle them gracefully
prisma.$on('error' as never, (e: any) => {
  if (!e?.message?.includes('P2002') && !e?.message?.includes('Unique constraint failed')) {
    console.error('Prisma error:', e);
  }
});

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
