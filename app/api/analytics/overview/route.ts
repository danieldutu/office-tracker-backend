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

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");
    const userIdParam = searchParams.get("userId");
    const chapterLeadIdParam = searchParams.get("chapterLeadId");

    // Get accessible user IDs based on role
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

    // Get total users (scoped to accessible users)
    const totalUsers = accessibleUserIds.length;

    // Default to last 30 days if not specified
    let startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    startDate.setHours(0, 0, 0, 0);

    let endDate = new Date();
    endDate.setHours(23, 59, 59, 999);

    if (startDateParam) {
      startDate = new Date(startDateParam);
    }
    if (endDateParam) {
      endDate = new Date(endDateParam);
    }

    const recentAttendance = await prisma.attendanceRecord.findMany({
      where: {
        userId: {
          in: accessibleUserIds,
        },
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    // Filter to only working days (Monday-Friday)
    const workingDayRecords = recentAttendance.filter((r) => {
      const dayOfWeek = r.date.getDay();
      return dayOfWeek >= 1 && dayOfWeek <= 5; // 1=Monday, 5=Friday
    });

    // Calculate stats
    const officeRecords = workingDayRecords.filter((r) => r.status === "office");
    const remoteRecords = workingDayRecords.filter((r) => r.status === "remote");
    const totalRecords = workingDayRecords.length;

    // Average office occupancy (as percentage) - only for working days
    const uniqueDates = [...new Set(workingDayRecords.map((r) => r.date.toISOString()))];
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

    // Find most popular day, but return "None" if no office records exist
    let mostPopularDay = "None";
    if (officeRecords.length > 0) {
      const maxEntry = Object.entries(dayOfWeekCounts).reduce((a, b) =>
        a[1] > b[1] ? a : b
      );
      // Only set if count is > 0
      if (maxEntry[1] > 0) {
        mostPopularDay = maxEntry[0];
      }
    }

    // Determine scope
    const scope = user.role === UserRole.TRIBE_LEAD ? "organization" : "team";

    // Calculate status distribution percentages (working days only)
    const officePercentage = totalRecords > 0 ? Math.round((officeRecords.length / totalRecords) * 100) : 0;
    const remotePercentage = totalRecords > 0 ? Math.round((remoteRecords.length / totalRecords) * 100) : 0;
    const absentRecords = workingDayRecords.filter((r) => r.status === "absent" || r.status === "vacation");
    const absentPercentage = totalRecords > 0 ? Math.round((absentRecords.length / totalRecords) * 100) : 0;

    return apiResponse({
      totalUsers,
      averageOccupancy,
      mostPopularDay,
      remoteWorkRate,
      scope, // Indicates if this is team or org data
      teamName: user.role === UserRole.CHAPTER_LEAD ? user.teamName : undefined,
      statusDistribution: {
        office: officePercentage,
        remote: remotePercentage,
        absent: absentPercentage,
      },
    });
  } catch (error) {
    console.error("Error fetching analytics overview:", error);
    return apiError("Internal server error", 500);
  }
}
