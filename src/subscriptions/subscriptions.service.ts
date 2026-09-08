import { Injectable } from "@nestjs/common";
import { UserSubscriptionStatus } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  getRemainingDays,
  getRemainingSeconds,
  isSubscriptionActive,
} from "./subscription.utils";

const SUBSCRIPTION_INCLUDE = {
  plan: {
    select: {
      id: true,
      slug: true,
      title: true,
      durationMonths: true,
      priceKzt: true,
      order: true,
    },
  },
} as const;

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  findActivePlans() {
    return this.prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { order: "asc" },
      select: {
        id: true,
        slug: true,
        title: true,
        durationMonths: true,
        priceKzt: true,
        order: true,
      },
    });
  }

  async getCurrentSubscription(userId: string) {
    const now = new Date();
    const subscription = await this.prisma.userSubscription.findFirst({
      where: {
        userId,
        status: UserSubscriptionStatus.ACTIVE,
        expiresAt: { gt: now },
      },
      orderBy: { expiresAt: "desc" },
      include: SUBSCRIPTION_INCLUDE,
    });

    if (!subscription) {
      return {
        isActive: false,
        subscription: null,
      };
    }

    return {
      isActive: isSubscriptionActive(
        subscription.expiresAt,
        subscription.status,
        now,
      ),
      subscription: this.toSubscriptionResponse(subscription, now),
    };
  }

  async hasActiveSubscription(userId: string): Promise<boolean> {
    const now = new Date();
    const subscription = await this.prisma.userSubscription.findFirst({
      where: {
        userId,
        status: UserSubscriptionStatus.ACTIVE,
        expiresAt: { gt: now },
      },
      select: { id: true },
    });

    return subscription != null;
  }

  toSubscriptionResponse(
    subscription: {
      id: string;
      status: UserSubscriptionStatus;
      startsAt: Date;
      expiresAt: Date;
      plan: {
        id: string;
        slug: string;
        title: string;
        durationMonths: number;
        priceKzt: number;
        order: number;
      };
    },
    now = new Date(),
  ) {
    const remainingSeconds = getRemainingSeconds(subscription.expiresAt, now);
    const remainingDays = getRemainingDays(subscription.expiresAt, now);

    return {
      id: subscription.id,
      status: subscription.status,
      startsAt: subscription.startsAt,
      expiresAt: subscription.expiresAt,
      remainingSeconds,
      remainingDays,
      isExpired: remainingSeconds === 0,
      plan: subscription.plan,
      monthlyPriceKzt: Math.round(
        subscription.plan.priceKzt / subscription.plan.durationMonths,
      ),
    };
  }
}
