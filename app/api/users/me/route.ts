import { NextRequest } from "next/server";
// import { auth } from "@/lib/auth"; // Disabled for testing
import { prisma } from "@/lib/prisma";
import { apiResponse, apiError } from "@/lib/utils";

// GET /api/users/me - Get current user
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return apiError("Unauthorized", 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    if (!user) {
      return apiError("User not found", 404);
    }

    return apiResponse(user);
  } catch (error) {
    console.error("Error fetching current user:", error);
    return apiError("Internal server error", 500);
  }
}
