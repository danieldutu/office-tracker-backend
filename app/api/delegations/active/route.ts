import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiResponse, apiError } from "@/lib/utils";
import { getUserFromRequest } from "@/lib/auth-helpers";

// GET /api/delegations/active - Check if current user has active delegation
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return apiError("Authentication required", 401);
    }

    const now = new Date();

    const activeDelegation = await prisma.delegation.findFirst({
      where: {
        delegateId: user.id,
        isActive: true,
        startDate: {
          lte: now,
        },
        endDate: {
          gte: now,
        },
      },
    });

    return apiResponse({
      hasActiveDelegation: !!activeDelegation,
      delegation: activeDelegation,
    });
  } catch (error) {
    console.error("Error checking active delegation:", error);
    return apiError("Internal server error", 500);
  }
}
