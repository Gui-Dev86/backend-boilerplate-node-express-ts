import { prisma } from "../../src/config/db";

export async function resetDb() {
  // Ordre important : supprimer les tables dependantes avant les tables parentes
  await prisma.refreshToken.deleteMany();
  await prisma.task.deleteMany();
  await prisma.user.deleteMany();
}

export async function disconnectDb() {
  await prisma.$disconnect();
}
