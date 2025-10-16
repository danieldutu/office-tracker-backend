import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiResponse, apiError } from "@/lib/utils";
import { getUserFromRequest } from "@/lib/auth-helpers";
import { canViewAnalytics, getAccessibleUserIds } from "@/lib/permissions";

// GET /api/analytics/weekly-pattern - Get weekly attendance patterns (filtered by permissions)
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return apiError("Authentication required", 401);
    }

    // Check if user can view analytics
    if (!canViewAnalytics(user, "team")) {
      return apiError("Reporters cannot access analytics", 403);
    }

    const searchParams = request.nextUrl.searchParams;
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");
    const userIdParam = searchParams.get("userId");
    const chapterLeadIdParam = searchParams.get("chapterLeadId");

    // Get accessible user IDs
    let accessibleUserIds = await getAccessibleUserIds(user);

    // Further filter by specific user or chapter lead if requested
    if (userIdParam && accessibleUserIds.includes(userIdParam)) {
      accessibleUserIds = [userIdParam];
    } else if (chapterLeadIdParam) {
      // Filter to only users managed by this chapter lead
      const chapterLeadUsers = await prisma.user.findMany({
        where: {
          chapterLeadId: chapterLeadIdParam,
          id: {
            in: accessibleUserIds,
          },
        },
        select: { id: true },
      });
      accessibleUserIds = chapterLeadUsers.map((u) => u.id);
    }

    // Default to last 90 days for better pattern analysis
    let startDate = new Date();
    startDate.setDate(startDate.getDate() - 90);
    startDate.setHours(0, 0, 0, 0);

    let endDate = new Date();
    endDate.setHours(23, 59, 59, 999);

    if (startDateParam) {
      startDate = new Date(startDateParam);
    }
    if (endDateParam) {
      endDate = new Date(endDateParam);
    }

    const attendance = await prisma.attendanceRecord.findMany({
      where: {
        userId: {
          in: accessibleUserIds, // Only show accessible users' data
        },
        date: {
          gte: startDate,
          lte: endDate,
        },
        status: "office",
      },
    });

    // Count by day of week
    const dayOfWeekCounts: { [key: string]: number } = {
      Mon: 0,
      Tue: 0,
      Wed: 0,
      Thu: 0,
      Fri: 0,
      Sat: 0,
      Sun: 0,
    };

    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    attendance.forEach((record) => {
      const dayName = dayNames[record.date.getDay()];
      dayOfWeekCounts[dayName]++;
    });

    // Convert to array
    const weeklyPattern = [
      { day: "Mon", count: dayOfWeekCounts.Mon },
      { day: "Tue", count: dayOfWeekCounts.Tue },
      { day: "Wed", count: dayOfWeekCounts.Wed },
      { day: "Thu", count: dayOfWeekCounts.Thu },
      { day: "Fri", count: dayOfWeekCounts.Fri },
      { day: "Sat", count: dayOfWeekCounts.Sat },
      { day: "Sun", count: dayOfWeekCounts.Sun },
    ];

    return apiResponse(weeklyPattern);
  } catch (error) {
    console.error("Error fetching weekly pattern:", error);
    return apiError("Internal server error", 500);
  }
}
