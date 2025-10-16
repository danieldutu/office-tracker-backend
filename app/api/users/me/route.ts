import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiResponse, apiError } from "@/lib/utils";
import { getUserFromRequest } from "@/lib/auth-helpers";

// GET /api/users/me - Get current user
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return apiError("Authentication required", 401);
    }

    const userDetails = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    if (!userDetails) {
      return apiError("User not found", 404);
    }

    return apiResponse(userDetails);
  } catch (error) {
    console.error("Error fetching current user:", error);
    return apiError("Internal server error", 500);
  }
}
