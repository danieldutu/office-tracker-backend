import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiResponse, apiError } from "@/lib/utils";
import { getUserFromRequest } from "@/lib/auth-helpers";
import { canViewAnalytics, getAccessibleUserIds } from "@/lib/permissions";
import { UserRole } from "@prisma/client";

// GET /api/analytics/overview - Get general stats (role-based scope)
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

    // Get accessible user IDs based on role
    const accessibleUserIds = await getAccessibleUserIds(user);

    // Get total users (scoped to accessible users)
    const totalUsers = accessibleUserIds.length;

    // Get last 30 days of attendance (filtered by accessible users)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentAttendance = await prisma.attendanceRecord.findMany({
      where: {
        userId: {
          in: accessibleUserIds,
        },
        date: {
          gte: thirtyDaysAgo,
        },
      },
    });

    // Calculate stats
    const officeRecords = recentAttendance.filter((r) => r.status === "office");
    const remoteRecords = recentAttendance.filter((r) => r.status === "remote");
    const totalRecords = recentAttendance.length;

    // Average office occupancy (as percentage)
    const uniqueDates = [...new Set(recentAttendance.map((r) => r.date.toISOString()))];
    const averageOccupancy =
      uniqueDates.length > 0
        ? Math.round((officeRecords.length / uniqueDates.length / totalUsers) * 100)
        : 0;

    // Remote work rate
    const remoteWorkRate =
      totalRecords > 0 ? Math.round((remoteRecords.length / totalRecords) * 100) : 0;

    // Most popular office day
    const dayOfWeekCounts: { [key: string]: number } = {
      Monday: 0,
      Tuesday: 0,
      Wednesday: 0,
      Thursday: 0,
      Friday: 0,
      Saturday: 0,
      Sunday: 0,
    };

    const dayNames = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];

    officeRecords.forEach((record) => {
      const dayName = dayNames[record.date.getDay()];
      dayOfWeekCounts[dayName]++;
    });

    const mostPopularDay = Object.entries(dayOfWeekCounts).reduce((a, b) =>
      a[1] > b[1] ? a : b
    )[0];

    // Determine scope
    const scope = user.role === UserRole.TRIBE_LEAD ? "organization" : "team";

    return apiResponse({
      totalUsers,
      averageOccupancy,
      mostPopularDay,
      remoteWorkRate,
      scope, // Indicates if this is team or org data
      teamName: user.role === UserRole.CHAPTER_LEAD ? user.teamName : undefined,
    });
  } catch (error) {
    console.error("Error fetching analytics overview:", error);
    return apiError("Internal server error", 500);
  }
}
