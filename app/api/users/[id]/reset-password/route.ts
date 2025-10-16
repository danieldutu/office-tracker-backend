import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiResponse, apiError } from "@/lib/utils";
import { getUserFromRequest } from "@/lib/auth-helpers";
import { UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

// Generate default password from user's name
function generateDefaultPassword(name: string): string {
  const firstName = name.split(/[\s-]/)[0].toLowerCase();
  return `${firstName}123`;
}

// POST /api/users/[id]/reset-password - Reset user password to default (Chapter Lead/Tribe Lead only)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return apiError("Authentication required", 401);
    }

    // Only Chapter Leads and Tribe Lead can reset passwords
    if (user.role === UserRole.REPORTER) {
      return apiError("You do not have permission to reset passwords", 403);
    }

    const { id: targetUserId } = await params;

    // Get target user
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        chapterLeadId: true,
      },
    });

    if (!targetUser) {
      return apiError("User not found", 404);
    }

    // Prevent resetting own password through this endpoint
    if (targetUserId === user.id) {
      return apiError("Use the change password endpoint to update your own password", 400);
    }

    // Chapter Leads can only reset passwords for their direct reports
    if (user.role === UserRole.CHAPTER_LEAD) {
      const isDirectReport = targetUser.chapterLeadId === user.id;

      if (!isDirectReport) {
        return apiError("You can only reset passwords for your direct reports", 403);
      }

      // Chapter Leads cannot reset Tribe Lead password
      if (targetUser.role === UserRole.TRIBE_LEAD) {
        return apiError("You cannot reset the Tribe Lead's password", 403);
      }
    }

    // Tribe Lead can reset anyone's password except other Tribe Leads
    if (user.role === UserRole.TRIBE_LEAD && targetUser.role === UserRole.TRIBE_LEAD && targetUserId !== user.id) {
      return apiError("Cannot reset another Tribe Lead's password", 403);
    }

    // Generate default password
    const defaultPassword = generateDefaultPassword(targetUser.name);
    const passwordHash = await bcrypt.hash(defaultPassword, 10);

    // Reset password
    await prisma.user.update({
      where: { id: targetUserId },
      data: { passwordHash },
    });

    return apiResponse({
      message: "Password reset successfully",
      defaultPassword, // Return the default password so the admin can inform the user
      user: {
        id: targetUser.id,
        name: targetUser.name,
        email: targetUser.email,
      },
    });
  } catch (error) {
    console.error("Error resetting password:", error);
    return apiError("Internal server error", 500);
  }
}
