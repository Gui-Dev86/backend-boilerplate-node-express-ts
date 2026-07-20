import request from "supertest";
import app from "../src/app";
import { disconnectDb, resetDb } from "./helpers/db";

const testUser = { email: "auth-test@test.com", password: "password123" };

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await disconnectDb();
});

describe("POST /api/auth/register", () => {
  it("cree un compte et retourne les tokens", async () => {
    const res = await request(app).post("/api/auth/register").send(testUser);

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe(testUser.email);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
  });

  it("refuse un email deja utilise", async () => {
    await request(app).post("/api/auth/register").send(testUser);
    const res = await request(app).post("/api/auth/register").send(testUser);

    expect(res.status).toBe(409);
  });

  it("refuse un mot de passe trop court", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "short@test.com", password: "123" });

    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/login", () => {
  beforeEach(async () => {
    await request(app).post("/api/auth/register").send(testUser);
  });

  it("connecte avec les bons identifiants", async () => {
    const res = await request(app).post("/api/auth/login").send(testUser);
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
  });

  it("refuse un mauvais mot de passe", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: testUser.email, password: "wrongpassword" });

    expect(res.status).toBe(401);
  });

  it("refuse un email inconnu", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "inconnu@test.com", password: "password123" });

    expect(res.status).toBe(401);
  });
});

describe("GET /api/auth/me", () => {
  it("retourne l'utilisateur connecte avec un token valide", async () => {
    const { body } = await request(app).post("/api/auth/register").send(testUser);

    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${body.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.email).toBe(testUser.email);
  });

  it("refuse sans token", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("refuse un token invalide", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer token_invalide");

    expect(res.status).toBe(401);
  });
});

describe("POST /api/auth/refresh", () => {
  it("retourne un nouveau couple de tokens et invalide l'ancien refresh token", async () => {
    const { body } = await request(app).post("/api/auth/register").send(testUser);

    const refreshRes = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: body.refreshToken });

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.accessToken).toBeDefined();
    expect(refreshRes.body.refreshToken).toBeDefined();
    expect(refreshRes.body.refreshToken).not.toBe(body.refreshToken);

    // L'ancien refresh token ne doit plus fonctionner (rotation)
    const reuseRes = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: body.refreshToken });

    expect(reuseRes.status).toBe(401);
  });

  it("refuse un refresh token invalide", async () => {
    const res = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: "token_invalide" });

    expect(res.status).toBe(401);
  });
});

describe("POST /api/auth/logout", () => {
  it("revoque le refresh token, qui devient inutilisable", async () => {
    const { body } = await request(app).post("/api/auth/register").send(testUser);

    const logoutRes = await request(app)
      .post("/api/auth/logout")
      .send({ refreshToken: body.refreshToken });
    expect(logoutRes.status).toBe(204);

    const refreshRes = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: body.refreshToken });
    expect(refreshRes.status).toBe(401);
  });
});

describe("POST /api/auth/change-password", () => {
  it("change le mot de passe et revoque les sessions existantes", async () => {
    const { body } = await request(app).post("/api/auth/register").send(testUser);

    const changeRes = await request(app)
      .post("/api/auth/change-password")
      .set("Authorization", `Bearer ${body.accessToken}`)
      .send({ currentPassword: testUser.password, newPassword: "newpassword456" });
    expect(changeRes.status).toBe(204);

    // L'ancien mot de passe ne doit plus fonctionner
    const oldLoginRes = await request(app).post("/api/auth/login").send(testUser);
    expect(oldLoginRes.status).toBe(401);

    // Le nouveau mot de passe doit fonctionner
    const newLoginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: testUser.email, password: "newpassword456" });
    expect(newLoginRes.status).toBe(200);

    // L'ancienne session (refresh token) doit avoir ete revoquee
    const refreshRes = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: body.refreshToken });
    expect(refreshRes.status).toBe(401);
  });

  it("refuse si le mot de passe actuel est incorrect", async () => {
    const { body } = await request(app).post("/api/auth/register").send(testUser);

    const res = await request(app)
      .post("/api/auth/change-password")
      .set("Authorization", `Bearer ${body.accessToken}`)
      .send({ currentPassword: "wrongpassword", newPassword: "newpassword456" });

    expect(res.status).toBe(401);
  });
});
