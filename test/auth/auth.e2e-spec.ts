import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { App } from "supertest/types";
import { PrismaService } from "../../src/prisma/prisma.service";
import { createTestApp } from "../helpers/app";
import { readAuthBody, readProfile, signIn, signUp } from "../helpers/auth";

describe("Auth (e2e)", () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const email = `auth-${Date.now()}@example.com`;
  const password = "password1";
  const firstName = "Alisher";
  const lastName = "Test";

  let accessToken = "";
  let refreshToken = "";

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);

    const auth = await signUp(app, { email, password, firstName, lastName });
    accessToken = auth.accessToken;
    refreshToken = auth.refreshToken;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  it("returns 400 when sign-up payload is invalid", async () => {
    await request(app.getHttpServer())
      .post("/auth/sign-up")
      .send({
        email: "not-an-email",
        password: "short",
        firstName,
        lastName,
      })
      .expect(400);
  });

  it("signs up a user", async () => {
    const signUpEmail = `signup-${Date.now()}@example.com`;

    const signUpBody = await signUp(app, {
      email: signUpEmail,
      password,
      firstName,
      lastName,
    });

    expect(signUpBody.user.email).toBe(signUpEmail);
    expect(signUpBody.user.firstName).toBe(firstName);
    expect(signUpBody.user.lastName).toBe(lastName);
    expect(signUpBody.user.isAdmin).toBe(false);
    expect(signUpBody.accessToken.length).toBeGreaterThan(0);
    expect(signUpBody.refreshToken.length).toBeGreaterThan(0);

    await prisma.user.delete({ where: { email: signUpEmail } });
  });

  it("returns 409 when signing up with a duplicate email", async () => {
    const duplicateEmail = `duplicate-${Date.now()}@example.com`;

    await signUp(app, {
      email: duplicateEmail,
      password,
      firstName,
      lastName,
    });

    await request(app.getHttpServer())
      .post("/auth/sign-up")
      .send({
        email: duplicateEmail,
        password,
        firstName,
        lastName,
      })
      .expect(409);

    await prisma.user.delete({ where: { email: duplicateEmail } });
  });

  it("signs in a user", async () => {
    const signInBody = await signIn(app, { email, password });

    expect(signInBody.accessToken.length).toBeGreaterThan(0);
    accessToken = signInBody.accessToken;
    refreshToken = signInBody.refreshToken;
  });

  it("rejects sign-in with invalid credentials", async () => {
    await request(app.getHttpServer())
      .post("/auth/sign-in")
      .send({ email, password: "wrong-password" })
      .expect(401);
  });

  it("returns the authenticated profile", async () => {
    const me = await request(app.getHttpServer())
      .get("/auth/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    expect(readProfile(me.body).email).toBe(email);
  });

  it("rejects profile access without a bearer token", async () => {
    await request(app.getHttpServer()).get("/auth/me").expect(401);
  });

  it("refreshes tokens", async () => {
    const refresh = await request(app.getHttpServer())
      .post("/auth/refresh")
      .send({ refreshToken })
      .expect(200);

    const refreshBody = readAuthBody(refresh.body);
    expect(refreshBody.accessToken.length).toBeGreaterThan(0);
    accessToken = refreshBody.accessToken;
    refreshToken = refreshBody.refreshToken;

    await request(app.getHttpServer())
      .get("/auth/me")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
  });

  it("rejects an invalid refresh token", async () => {
    await request(app.getHttpServer())
      .post("/auth/refresh")
      .send({ refreshToken: "invalid-token" })
      .expect(401);
  });
});
