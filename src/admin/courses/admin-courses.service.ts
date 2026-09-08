import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "../../generated/prisma/client";
import { clampPagination } from "../../common/constants/pagination";
import { PrismaService } from "../../prisma/prisma.service";
import { StorageCleanupService } from "../../storage/storage-cleanup.service";
import type {
  CreateCourseDto,
  ListAdminCoursesQueryDto,
  UpdateCourseDto,
} from "./dto/course.dto";

const COURSE_INCLUDE = {
  lessons: {
    orderBy: { order: "asc" as const },
    include: {
      materials: { orderBy: { order: "asc" as const } },
      test: {
        include: {
          questions: {
            orderBy: { order: "asc" as const },
            include: {
              options: { orderBy: { order: "asc" as const } },
            },
          },
        },
      },
    },
  },
};

@Injectable()
export class AdminCoursesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageCleanup: StorageCleanupService,
  ) {}

  async findAll(query: ListAdminCoursesQueryDto) {
    const { page, limit } = clampPagination(query.page, query.limit);

    const where: Prisma.CourseWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: "insensitive" } },
              { slug: { contains: query.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.course.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ order: "asc" }, { createdAt: "desc" }],
      }),
      this.prisma.course.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 0,
      },
    };
  }

  async findById(id: string) {
    const course = await this.prisma.course.findUnique({
      where: { id },
      include: COURSE_INCLUDE,
    });

    if (!course) {
      throw new NotFoundException(`Course ${id} not found`);
    }

    return course;
  }

  async create(dto: CreateCourseDto) {
    try {
      return await this.prisma.course.create({
        data: {
          title: dto.title,
          description: dto.description ?? "",
          slug: dto.slug,
          status: dto.status,
          order: dto.order ?? 0,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException("Course slug already exists");
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateCourseDto) {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException("At least one field must be provided");
    }

    await this.findById(id);

    try {
      return await this.prisma.course.update({
        where: { id },
        data: {
          ...(dto.title !== undefined ? { title: dto.title } : {}),
          ...(dto.description !== undefined
            ? { description: dto.description }
            : {}),
          ...(dto.slug !== undefined ? { slug: dto.slug } : {}),
          ...(dto.status !== undefined ? { status: dto.status } : {}),
          ...(dto.order !== undefined ? { order: dto.order } : {}),
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException("Course slug already exists");
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        throw new NotFoundException(`Course ${id} not found`);
      }
      throw error;
    }
  }

  async remove(id: string) {
    const course = await this.findById(id);
    const objectKeys = this.collectObjectKeys(course);

    await this.prisma.course.delete({ where: { id } });
    this.storageCleanup.scheduleDelete(objectKeys);
  }

  private collectObjectKeys(
    course: Awaited<ReturnType<AdminCoursesService["findById"]>>,
  ): string[] {
    const keys: string[] = [];

    for (const lesson of course.lessons) {
      keys.push(lesson.videoObjectKey);
      for (const material of lesson.materials) {
        keys.push(material.fileObjectKey);
      }
    }

    return keys;
  }
}
