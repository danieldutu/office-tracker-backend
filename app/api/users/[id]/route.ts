import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiResponse, apiError } from "@/lib/utils";
import { updateUserSchema } from "@/lib/validations";
import { getUserFromRequest } from "@/lib/auth-helpers";
import { canAccessUser } from "@/lib/permissions";
import { UserRole } from "@prisma/client";

// GET /api/users/[id] - Get user by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getUserFromRequest(request);

    if (!currentUser) {
      return apiError("Authentication required", 401);
    }

    const { id } = await params;

    // Check if current user can access target user
    const canAccess = await canAccessUser(currentUser, id);
    if (!canAccess) {
      return apiError("You do not have permission to access this user", 403);
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        teamName: true,
        chapterLeadId: true,
        avatarUrl: true,
        isFirstLogin: true,
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
    const currentUser = await getUserFromRequest(request);

    if (!currentUser) {
      return apiError("Authentication required", 401);
    }

    const { id } = await params;

    // Users can only update their own profile unless they're Tribe Lead
    if (currentUser.id !== id && currentUser.role !== UserRole.TRIBE_LEAD) {
      return apiError("You can only update your own profile", 403);
    }

    const body = await request.json();
    const validation = updateUserSchema.safeParse(body);

    if (!validation.success) {
      return apiError(validation.error.issues[0].message, 400);
    }

    const data = validation.data;

    // Only Tribe Lead can change roles or assign Chapter Leads
    if ((data.role || data.chapterLeadId) && currentUser.role !== UserRole.TRIBE_LEAD) {
      return apiError("Only Tribe Lead can change user roles or team assignments", 403);
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
        teamName: true,
        chapterLeadId: true,
        avatarUrl: true,
        isFirstLogin: true,
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

// DELETE /api/users/[id] - Delete user (Tribe Lead only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getUserFromRequest(request);

    if (!currentUser) {
      return apiError("Authentication required", 401);
    }

    // Only Tribe Lead can delete users
    if (currentUser.role !== UserRole.TRIBE_LEAD) {
      return apiError("Only Tribe Lead can delete users", 403);
    }

    const { id } = await params;

    // Prevent deleting yourself
    if (currentUser.id === id) {
      return apiError("Cannot delete your own account", 400);
    }

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
