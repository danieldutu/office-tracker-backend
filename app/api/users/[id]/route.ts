import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiResponse, apiError } from "@/lib/utils";
import { updateUserSchema } from "@/lib/validations";

// GET /api/users/[id] - Get user by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return apiError("Unauthorized", 401);
    }

    const { id } = await params;

    const user = await prisma.user.findUnique({
      where: { id },
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
    console.error("Error fetching user:", error);
    return apiError("Internal server error", 500);
  }
}

// PATCH /api/users/[id] - Update user
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return apiError("Unauthorized", 401);
    }

    const { id } = await params;

    // Users can only update their own profile unless they're admin
    if (session.user.id !== id && session.user.role !== "admin") {
      return apiError("Forbidden", 403);
    }

    const body = await request.json();
    const validation = updateUserSchema.safeParse(body);

    if (!validation.success) {
      return apiError(validation.error.issues[0].message, 400);
    }

    const data = validation.data;

    // Only admins can change role
    if (data.role && session.user.role !== "admin") {
      return apiError("Only admins can change user roles", 403);
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...data,
        ...(data.avatarUrl !== undefined && { avatarUrl: data.avatarUrl }),
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

    return apiResponse(user);
  } catch (error: any) {
    if (error.code === "P2025") {
      return apiError("User not found", 404);
    }
    console.error("Error updating user:", error);
    return apiError("Internal server error", 500);
  }
}

// DELETE /api/users/[id] - Delete user (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user || session.user.role !== "admin") {
      return apiError("Unauthorized", 403);
    }

    const { id } = await params;

    await prisma.user.delete({
      where: { id },
    });

    return apiResponse({ message: "User deleted successfully" });
  } catch (error: any) {
    if (error.code === "P2025") {
      return apiError("User not found", 404);
    }
    console.error("Error deleting user:", error);
    return apiError("Internal server error", 500);
  }
}
