import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import request from "supertest";
import { App } from "supertest/types";
import { AppModule } from "./../src/app.module";
import { PrismaService } from "./../src/prisma/prisma.service";

type AuthBody = {
  user: { id: string; email: string };
  accessToken: string;
  refreshToken: string;
};

function readAuthBody(body: unknown): AuthBody {
  if (typeof body !== "object" || body == null) {
    throw new Error("Expected auth response object");
  }

  const record = body as Record<string, unknown>;
  const user = record.user;
  if (typeof user !== "object" || user == null) {
    throw new Error("Expected user in auth response");
  }

  const userRecord = user as Record<string, unknown>;
  if (
    typeof record.accessToken !== "string" ||
    typeof record.refreshToken !== "string" ||
    typeof userRecord.email !== "string" ||
    typeof userRecord.id !== "string"
  ) {
    throw new Error("Invalid auth response shape");
  }

  return {
    user: { id: userRecord.id, email: userRecord.email },
    accessToken: record.accessToken,
    refreshToken: record.refreshToken,
  };
}

function readProfile(body: unknown): { email: string } {
  if (typeof body !== "object" || body == null) {
    throw new Error("Expected profile object");
  }
  const record = body as Record<string, unknown>;
  if (typeof record.email !== "string") {
    throw new Error("Expected email in profile");
  }
  return { email: record.email };
}

describe("Auth (e2e)", () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const email = `auth-${Date.now()}@example.com`;
  const password = "password1";

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  it("returns 400 when sign-up payload is invalid", async () => {
    await request(app.getHttpServer())
      .post("/auth/sign-up")
      .send({ email: "not-an-email", password: "short" })
      .expect(400);
  });

  it("signs up, signs in, reads profile, and refreshes tokens", async () => {
    const signUp = await request(app.getHttpServer())
      .post("/auth/sign-up")
      .send({ email, password })
      .expect(201);

    const signUpBody = readAuthBody(signUp.body);
    expect(signUpBody.user.email).toBe(email);
    expect(signUpBody.accessToken.length).toBeGreaterThan(0);
    expect(signUpBody.refreshToken.length).toBeGreaterThan(0);

    const signIn = await request(app.getHttpServer())
      .post("/auth/sign-in")
      .send({ email, password })
      .expect(200);

    const signInBody = readAuthBody(signIn.body);
    expect(signInBody.accessToken.length).toBeGreaterThan(0);

    const me = await request(app.getHttpServer())
      .get("/auth/me")
      .set("Authorization", `Bearer ${signInBody.accessToken}`)
      .expect(200);

    expect(readProfile(me.body).email).toBe(email);

    const refresh = await request(app.getHttpServer())
      .post("/auth/refresh")
      .send({ refreshToken: signInBody.refreshToken })
      .expect(200);

    const refreshBody = readAuthBody(refresh.body);
    expect(refreshBody.accessToken.length).toBeGreaterThan(0);

    await request(app.getHttpServer())
      .get("/auth/me")
      .set("Authorization", `Bearer ${refreshBody.accessToken}`)
      .expect(200);
  });

  it("rejects sign-in with invalid credentials", async () => {
    await request(app.getHttpServer())
      .post("/auth/sign-in")
      .send({ email, password: "wrong-password" })
      .expect(401);
  });
});
