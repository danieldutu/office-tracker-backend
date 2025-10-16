import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiResponse, apiError } from "@/lib/utils";
import { getUserFromRequest } from "@/lib/auth-helpers";
import { UserRole } from "@prisma/client";

// POST /api/admin/reset-statistics - Reset all statistics (Tribe Lead only, no delegation)
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return apiError("Authentication required", 401);
    }

    // ONLY the actual Tribe Lead can reset statistics - delegations do NOT apply
    if (user.role !== UserRole.TRIBE_LEAD) {
      return apiError("Only the Tribe Lead can reset statistics", 403);
    }

    // Delete all statistics data (but preserve users)
    await prisma.$transaction([
      // Delete all attendance records
      prisma.attendanceRecord.deleteMany({}),

      // Delete all delegations
      prisma.delegation.deleteMany({}),

      // Delete all office capacity settings
      prisma.officeCapacity.deleteMany({}),
    ]);

    return apiResponse({
      message: "All statistics have been reset successfully",
      deletedRecords: {
        attendance: "all",
        delegations: "all",
        officeCapacity: "all",
      },
    });
  } catch (error) {
    console.error("Error resetting statistics:", error);
    return apiError("Internal server error", 500);
  }
}
