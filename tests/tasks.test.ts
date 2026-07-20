import request from "supertest";
import app from "../src/app";
import { prisma } from "../src/config/db";
import { disconnectDb, resetDb } from "./helpers/db";

async function registerAndLogin(email: string) {
  const res = await request(app)
    .post("/api/auth/register")
    .send({ email, password: "password123" });
  return { accessToken: res.body.accessToken, userId: res.body.user.id };
}

async function promoteToAdmin(userId: string) {
  await prisma.user.update({ where: { id: userId }, data: { role: "ADMIN" } });
}

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await disconnectDb();
});

describe("CRUD /api/tasks - acces de base", () => {
  it("refuse l'acces sans authentification", async () => {
    const res = await request(app).get("/api/tasks");
    expect(res.status).toBe(401);
  });

  it("cree puis liste une task pour son proprietaire", async () => {
    const { accessToken } = await registerAndLogin("owner@test.com");

    const createRes = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ title: "Ma tache" });
    expect(createRes.status).toBe(201);

    const listRes = await request(app)
      .get("/api/tasks")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.items).toHaveLength(1);
    expect(listRes.body.items[0].title).toBe("Ma tache");
  });

  it("met a jour et supprime sa propre task", async () => {
    const { accessToken } = await registerAndLogin("owner2@test.com");

    const createRes = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ title: "A modifier" });
    const taskId = createRes.body.id;

    const updateRes = await request(app)
      .patch(`/api/tasks/${taskId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ done: true });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.done).toBe(true);

    const deleteRes = await request(app)
      .delete(`/api/tasks/${taskId}`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(deleteRes.status).toBe(204);

    const getRes = await request(app)
      .get(`/api/tasks/${taskId}`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(getRes.status).toBe(404);
  });
});

describe("CRUD /api/tasks - permissions entre utilisateurs", () => {
  it("un user ne voit pas les tasks d'un autre user dans la liste", async () => {
    const userA = await registerAndLogin("userA@test.com");
    const userB = await registerAndLogin("userB@test.com");

    await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${userA.accessToken}`)
      .send({ title: "Tache de A" });

    const listB = await request(app)
      .get("/api/tasks")
      .set("Authorization", `Bearer ${userB.accessToken}`);

    expect(listB.body.items).toHaveLength(0);
  });

  it("un user ne peut pas acceder a la task d'un autre user (403)", async () => {
    const userA = await registerAndLogin("userC@test.com");
    const userB = await registerAndLogin("userD@test.com");

    const createRes = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${userA.accessToken}`)
      .send({ title: "Tache privee de C" });
    const taskId = createRes.body.id;

    const getRes = await request(app)
      .get(`/api/tasks/${taskId}`)
      .set("Authorization", `Bearer ${userB.accessToken}`);
    expect(getRes.status).toBe(403);

    const updateRes = await request(app)
      .patch(`/api/tasks/${taskId}`)
      .set("Authorization", `Bearer ${userB.accessToken}`)
      .send({ done: true });
    expect(updateRes.status).toBe(403);

    const deleteRes = await request(app)
      .delete(`/api/tasks/${taskId}`)
      .set("Authorization", `Bearer ${userB.accessToken}`);
    expect(deleteRes.status).toBe(403);
  });

  it("un admin voit et modifie les tasks de tous les users", async () => {
    const user = await registerAndLogin("regularUser@test.com");
    const admin = await registerAndLogin("adminUser@test.com");
    await promoteToAdmin(admin.userId);

    // L'admin doit se reconnecter pour obtenir un token avec le role a jour
    const adminLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: "adminUser@test.com", password: "password123" });
    const adminToken = adminLogin.body.accessToken;

    const createRes = await request(app)
      .post("/api/tasks")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ title: "Tache du user normal" });
    const taskId = createRes.body.id;

    const listRes = await request(app)
      .get("/api/tasks")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(listRes.body.items.length).toBeGreaterThanOrEqual(1);

    const updateRes = await request(app)
      .patch(`/api/tasks/${taskId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ done: true });
    expect(updateRes.status).toBe(200);
  });
});
