import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiResponse, apiError } from "@/lib/utils";
import { getUserFromRequest } from "@/lib/auth-helpers";
import bcrypt from "bcryptjs";
import { z } from "zod";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "New password must be at least 6 characters"),
});

// POST /api/users/change-password - Change own password
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return apiError("Authentication required", 401);
    }

    const body = await request.json();
    const validation = changePasswordSchema.safeParse(body);

    if (!validation.success) {
      return apiError(validation.error.issues[0].message, 400);
    }

    const { currentPassword, newPassword } = validation.data;

    // Get user with password hash
    const userWithPassword = await prisma.user.findUnique({
      where: { id: user.id },
      select: { passwordHash: true },
    });

    if (!userWithPassword || !userWithPassword.passwordHash) {
      return apiError("User not found or no password set", 404);
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(
      currentPassword,
      userWithPassword.passwordHash
    );

    if (!isValidPassword) {
      return apiError("Current password is incorrect", 401);
    }

    // Prevent using the same password
    const isSamePassword = await bcrypt.compare(
      newPassword,
      userWithPassword.passwordHash
    );

    if (isSamePassword) {
      return apiError("New password must be different from current password", 400);
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Update password
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newPasswordHash },
    });

    return apiResponse({ message: "Password changed successfully" });
  } catch (error) {
    console.error("Error changing password:", error);
    return apiError("Internal server error", 500);
  }
}
