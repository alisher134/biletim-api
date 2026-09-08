import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { CourseStatus, Prisma } from "../generated/prisma/client";
import { clampPagination } from "../common/constants/pagination";
import { PrismaService } from "../prisma/prisma.service";
import type { PublicUser } from "../users/users.service";
import type { ListCoursesQueryDto } from "./dto/list-courses-query.dto";

const PUBLIC_LESSON_SUMMARY_SELECT = {
  id: true,
  title: true,
  description: true,
  videoDuration: true,
  order: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      materials: true,
    },
  },
  test: {
    select: { id: true },
  },
};

@Injectable()
export class CoursesService {
  constructor(private readonly prisma: PrismaService) {}

  async findPublished(query: ListCoursesQueryDto) {
    const { page, limit } = clampPagination(query.page, query.limit);

    const where: Prisma.CourseWhereInput = {
      status: CourseStatus.PUBLISHED,
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
        select: {
          id: true,
          title: true,
          description: true,
          slug: true,
          status: true,
          order: true,
          createdAt: true,
          updatedAt: true,
        },
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

  async findBySlug(slug: string, user?: PublicUser) {
    const course = await this.prisma.course.findUnique({
      where: { slug },
      include: {
        lessons: {
          orderBy: { order: "asc" },
          select: PUBLIC_LESSON_SUMMARY_SELECT,
        },
      },
    });

    if (!course) {
      throw new NotFoundException(`Course ${slug} not found`);
    }

    if (!user?.isAdmin && course.status !== CourseStatus.PUBLISHED) {
      throw new NotFoundException(`Course ${slug} not found`);
    }

    return {
      ...course,
      lessons: course.lessons.map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        description: lesson.description,
        videoDuration: lesson.videoDuration,
        order: lesson.order,
        createdAt: lesson.createdAt,
        updatedAt: lesson.updatedAt,
        hasMaterials: lesson._count.materials > 0,
        hasTest: lesson.test != null,
      })),
    };
  }

  async enroll(userId: string, courseId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course || course.status !== CourseStatus.PUBLISHED) {
      throw new NotFoundException(`Course ${courseId} not found`);
    }

    try {
      return await this.prisma.courseEnrollment.create({
        data: {
          userId,
          courseId,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException("Already enrolled in this course");
      }
      throw error;
    }
  }

  async findMyCourses(userId: string) {
    return this.prisma.courseEnrollment.findMany({
      where: { userId },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            slug: true,
            status: true,
            order: true,
          },
        },
      },
      orderBy: { enrolledAt: "desc" },
    });
  }

  async addFavorite(userId: string, courseId: string) {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course || course.status !== CourseStatus.PUBLISHED) {
      throw new NotFoundException(`Course ${courseId} not found`);
    }

    try {
      return await this.prisma.courseFavorite.create({
        data: { userId, courseId },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException("Course already in favorites");
      }
      throw error;
    }
  }

  async removeFavorite(userId: string, courseId: string) {
    try {
      await this.prisma.courseFavorite.delete({
        where: {
          userId_courseId: { userId, courseId },
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        throw new NotFoundException("Favorite not found");
      }
      throw error;
    }
  }

  async findFavorites(userId: string) {
    return this.prisma.courseFavorite.findMany({
      where: { userId },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            slug: true,
            status: true,
            order: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }
}
