import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiResponse, apiError } from "@/lib/utils";
import bcrypt from "bcryptjs";
import { createUserSchema } from "@/lib/validations";
import { getUserFromRequest } from "@/lib/auth-helpers";
import { getAccessibleUserIds } from "@/lib/permissions";
import { UserRole } from "@prisma/client";

// GET /api/users - Get all users (filtered by permissions)
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return apiError("Authentication required", 401);
    }

    // Get user IDs that current user can access
    const accessibleUserIds = await getAccessibleUserIds(user);

    const users = await prisma.user.findMany({
      where: {
        id: {
          in: accessibleUserIds,
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        teamName: true,
        chapterLeadId: true,
        avatarUrl: true,
        createdAt: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    return apiResponse(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    return apiError("Internal server error", 500);
  }
}

// POST /api/users - Create new user (Tribe Lead only)
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return apiError("Authentication required", 401);
    }

    // Only Tribe Lead can create users
    if (user.role !== UserRole.TRIBE_LEAD) {
      return apiError("Only Tribe Lead can create users", 403);
    }

    const body = await request.json();
    const validation = createUserSchema.safeParse(body);

    if (!validation.success) {
      return apiError(validation.error.issues[0].message, 400);
    }

    const { email, name, password, role } = validation.data;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return apiError("User with this email already exists", 409);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        role,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    return apiResponse(user, 201);
  } catch (error) {
    console.error("Error creating user:", error);
    return apiError("Internal server error", 500);
  }
}
