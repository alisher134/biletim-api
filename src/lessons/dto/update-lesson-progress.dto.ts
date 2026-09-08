import { Type } from "class-transformer";
import { IsBoolean, IsInt, IsOptional, Min } from "class-validator";

export class UpdateLessonProgressDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  watchedSeconds: number;

  @IsOptional()
  @IsBoolean()
  completed?: boolean;
}
