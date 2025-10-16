import { NextRequest } from "next/server";
// import { auth } from "@/lib/auth"; // Disabled for testing
import { prisma } from "@/lib/prisma";
import { apiResponse, apiError } from "@/lib/utils";
import bcrypt from "bcryptjs";
import { createUserSchema } from "@/lib/validations";

// GET /api/users - Get all users
export async function GET(request: NextRequest) {
  try {
    // Temporarily disabled auth for testing
    // const session = await auth();
    // if (!session?.user) {
    //   return apiError("Unauthorized", 401);
    // }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
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

// POST /api/users - Create new user (admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user || session.user.role !== "admin") {
      return apiError("Unauthorized", 403);
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
