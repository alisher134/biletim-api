import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "../../generated/prisma/client";
import { validateQuestionOptions } from "../../common/validation/question-validation";
import { PrismaService } from "../../prisma/prisma.service";
import type {
  CreateLessonTestDto,
  CreateQuestionDto,
  UpdateLessonTestDto,
  UpdateQuestionDto,
} from "./dto/test.dto";

@Injectable()
export class AdminTestsService {
  constructor(private readonly prisma: PrismaService) {}

  async createTest(lessonId: string, dto: CreateLessonTestDto) {
    await this.ensureLessonExists(lessonId);

    try {
      return await this.prisma.lessonTest.create({
        data: {
          lessonId,
          title: dto.title,
          description: dto.description ?? "",
          passingScore: dto.passingScore,
          timeLimit: dto.timeLimit,
          attemptsLimit: dto.attemptsLimit,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException("Lesson already has a test");
      }
      throw error;
    }
  }

  async updateTest(testId: string, dto: UpdateLessonTestDto) {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException("At least one field must be provided");
    }

    await this.findTest(testId);

    return this.prisma.lessonTest.update({
      where: { id: testId },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
        ...(dto.passingScore !== undefined
          ? { passingScore: dto.passingScore }
          : {}),
        ...(dto.timeLimit !== undefined ? { timeLimit: dto.timeLimit } : {}),
        ...(dto.attemptsLimit !== undefined
          ? { attemptsLimit: dto.attemptsLimit }
          : {}),
      },
    });
  }

  async removeTest(testId: string) {
    await this.findTest(testId);
    await this.prisma.lessonTest.delete({ where: { id: testId } });
  }

  async createQuestion(testId: string, dto: CreateQuestionDto) {
    await this.findTest(testId);
    validateQuestionOptions(dto.type, dto.options);

    return this.prisma.question.create({
      data: {
        testId,
        text: dto.text,
        type: dto.type,
        points: dto.points ?? 1,
        order: dto.order ?? 0,
        options: {
          create: dto.options.map((option, index) => ({
            text: option.text,
            isCorrect: option.isCorrect,
            order: option.order ?? index,
          })),
        },
      },
      include: {
        options: { orderBy: { order: "asc" } },
      },
    });
  }

  async updateQuestion(questionId: string, dto: UpdateQuestionDto) {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException("At least one field must be provided");
    }

    const question = await this.findQuestion(questionId);
    const nextType = dto.type ?? question.type;
    const nextOptions = dto.options ?? question.options;

    validateQuestionOptions(nextType, nextOptions);

    return this.prisma.$transaction(async (tx) => {
      if (dto.options) {
        await tx.questionOption.deleteMany({ where: { questionId } });
      }

      return tx.question.update({
        where: { id: questionId },
        data: {
          ...(dto.text !== undefined ? { text: dto.text } : {}),
          ...(dto.type !== undefined ? { type: dto.type } : {}),
          ...(dto.points !== undefined ? { points: dto.points } : {}),
          ...(dto.order !== undefined ? { order: dto.order } : {}),
          ...(dto.options
            ? {
                options: {
                  create: dto.options.map((option, index) => ({
                    text: option.text,
                    isCorrect: option.isCorrect,
                    order: option.order ?? index,
                  })),
                },
              }
            : {}),
        },
        include: {
          options: { orderBy: { order: "asc" } },
        },
      });
    });
  }

  async removeQuestion(questionId: string) {
    await this.findQuestion(questionId);
    await this.prisma.question.delete({ where: { id: questionId } });
  }

  private async ensureLessonExists(lessonId: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
    });

    if (!lesson) {
      throw new NotFoundException(`Lesson ${lessonId} not found`);
    }
  }

  private async findTest(testId: string) {
    const test = await this.prisma.lessonTest.findUnique({
      where: { id: testId },
    });

    if (!test) {
      throw new NotFoundException(`Test ${testId} not found`);
    }

    return test;
  }

  private async findQuestion(questionId: string) {
    const question = await this.prisma.question.findUnique({
      where: { id: questionId },
      include: {
        options: { orderBy: { order: "asc" } },
      },
    });

    if (!question) {
      throw new NotFoundException(`Question ${questionId} not found`);
    }

    return question;
  }
}
