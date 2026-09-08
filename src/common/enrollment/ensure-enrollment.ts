import { CourseStatus, Prisma } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

export async function ensureCourseEnrollment(
  prisma: PrismaService,
  userId: string,
  courseId: string,
): Promise<{ id: string; isNew: boolean }> {
  const existing = await prisma.courseEnrollment.findUnique({
    where: {
      userId_courseId: { userId, courseId },
    },
    select: { id: true },
  });

  if (existing) {
    return { id: existing.id, isNew: false };
  }

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: { status: true },
  });

  if (!course || course.status !== CourseStatus.PUBLISHED) {
    throw new Error(`Course ${courseId} is not available for enrollment`);
  }

  try {
    const enrollment = await prisma.courseEnrollment.create({
      data: {
        userId,
        courseId,
        lastActivityAt: new Date(),
      },
    });

    return { id: enrollment.id, isNew: true };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const retry = await prisma.courseEnrollment.findUniqueOrThrow({
        where: { userId_courseId: { userId, courseId } },
        select: { id: true },
      });
      return { id: retry.id, isNew: false };
    }

    throw error;
  }
}

export async function touchEnrollmentActivity(
  prisma: PrismaService,
  userId: string,
  courseId: string,
): Promise<void> {
  await prisma.courseEnrollment.updateMany({
    where: { userId, courseId },
    data: { lastActivityAt: new Date() },
  });
}
