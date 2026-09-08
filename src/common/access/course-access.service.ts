import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { CourseStatus } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { SubscriptionsService } from "../../subscriptions/subscriptions.service";
import type { PublicUser } from "../../users/users.service";

@Injectable()
export class CourseAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  async assertCourseContentAccess(
    user: PublicUser,
    courseId: string,
  ): Promise<void> {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, status: true },
    });

    if (!course) {
      throw new NotFoundException(`Course ${courseId} not found`);
    }

    if (user.isAdmin) {
      return;
    }

    if (course.status !== CourseStatus.PUBLISHED) {
      throw new NotFoundException(`Course ${courseId} not found`);
    }

    if (await this.subscriptionsService.hasActiveSubscription(user.id)) {
      return;
    }

    const enrollment = await this.prisma.courseEnrollment.findUnique({
      where: {
        userId_courseId: {
          userId: user.id,
          courseId,
        },
      },
    });

    if (!enrollment) {
      throw new ForbiddenException(
        "Active subscription or course enrollment required",
      );
    }
  }

  async assertLessonPlaybackAccess(
    user: PublicUser,
    lessonId: string,
  ): Promise<{ lessonId: string; courseId: string }> {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: {
        id: true,
        courseId: true,
        course: {
          select: { status: true },
        },
      },
    });

    if (!lesson) {
      throw new NotFoundException(`Lesson ${lessonId} not found`);
    }

    if (user.isAdmin) {
      return { lessonId: lesson.id, courseId: lesson.courseId };
    }

    if (lesson.course.status !== CourseStatus.PUBLISHED) {
      throw new NotFoundException(`Lesson ${lessonId} not found`);
    }

    if (await this.subscriptionsService.hasActiveSubscription(user.id)) {
      return { lessonId: lesson.id, courseId: lesson.courseId };
    }

    const enrollment = await this.prisma.courseEnrollment.findUnique({
      where: {
        userId_courseId: {
          userId: user.id,
          courseId: lesson.courseId,
        },
      },
    });

    if (!enrollment) {
      throw new ForbiddenException(
        "Active subscription or course enrollment required",
      );
    }

    return { lessonId: lesson.id, courseId: lesson.courseId };
  }

  async assertMaterialDownloadAccess(
    user: PublicUser,
    materialId: string,
  ): Promise<void> {
    const material = await this.prisma.lessonMaterial.findUnique({
      where: { id: materialId },
      select: { lessonId: true },
    });

    if (!material) {
      throw new NotFoundException(`Material ${materialId} not found`);
    }

    await this.assertLessonPlaybackAccess(user, material.lessonId);
  }
}
