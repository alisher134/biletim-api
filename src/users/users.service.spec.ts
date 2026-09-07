import {
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { UsersService } from "./users.service";

jest.mock("argon2", () => ({
  hash: jest.fn((password: string) => Promise.resolve(`hash:${password}`)),
  verify: jest.fn((hash: string, password: string) =>
    Promise.resolve(hash === `hash:${password}`),
  ),
}));

const publicUser = {
  id: "1",
  email: "a@b.com",
  firstName: "Alisher",
  lastName: "Test",
  isAdmin: false,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

describe("UsersService", () => {
  let service: UsersService;
  const prisma = {
    user: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(UsersService);
    jest.clearAllMocks();
  });

  it("creates a user without returning passwordHash", async () => {
    prisma.user.create.mockResolvedValue(publicUser);

    await expect(
      service.create({
        email: "a@b.com",
        passwordHash: "hash",
        firstName: "Alisher",
        lastName: "Test",
      }),
    ).resolves.toMatchObject({ email: "a@b.com", isAdmin: false });
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: {
        email: "a@b.com",
        passwordHash: "hash",
        firstName: "Alisher",
        lastName: "Test",
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isAdmin: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  });

  it("throws ConflictException when email already exists", async () => {
    prisma.user.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint", {
        code: "P2002",
        clientVersion: "test",
      }),
    );

    await expect(
      service.create({
        email: "a@b.com",
        passwordHash: "hash",
        firstName: "Alisher",
        lastName: "Test",
      }),
    ).rejects.toThrow(ConflictException);
  });

  it("updates firstName and lastName", async () => {
    prisma.user.update.mockResolvedValue({
      ...publicUser,
      firstName: "New",
      lastName: "Name",
    });

    await expect(
      service.updateProfile("1", { firstName: " New ", lastName: " Name " }),
    ).resolves.toMatchObject({ firstName: "New", lastName: "Name" });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "1" },
      data: { firstName: "New", lastName: "Name" },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        isAdmin: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  });

  it("changes password when the current password matches", async () => {
    prisma.user.findUnique.mockResolvedValue({
      ...publicUser,
      passwordHash: "hash:oldpass12",
    });
    prisma.user.update.mockResolvedValue(publicUser);

    await expect(
      service.changePassword("1", {
        currentPassword: "oldpass12",
        newPassword: "newpass12",
      }),
    ).resolves.toBeUndefined();
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "1" },
      data: { passwordHash: "hash:newpass12" },
    });
  });

  it("throws UnauthorizedException when the current password is wrong", async () => {
    prisma.user.findUnique.mockResolvedValue({
      ...publicUser,
      passwordHash: "hash:other",
    });

    await expect(
      service.changePassword("1", {
        currentPassword: "oldpass12",
        newPassword: "newpass12",
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it("throws NotFoundException when changing password for a missing user", async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.changePassword("missing", {
        currentPassword: "oldpass12",
        newPassword: "newpass12",
      }),
    ).rejects.toThrow(NotFoundException);
  });
});
