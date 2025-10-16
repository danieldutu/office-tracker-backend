import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiResponse, apiError } from "@/lib/utils";
import { getUserFromRequest } from "@/lib/auth-helpers";
import { canViewAnalytics, getAccessibleUserIds } from "@/lib/permissions";

// GET /api/analytics/occupancy - Get office occupancy data by date (filtered by permissions)
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

    // Default to last 30 days
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

    // Group by date and count
    const occupancyMap: { [key: string]: number } = {};

    attendance.forEach((record) => {
      const dateKey = record.date.toISOString().split("T")[0];
      occupancyMap[dateKey] = (occupancyMap[dateKey] || 0) + 1;
    });

    // Convert to array and sort by date
    const occupancyData = Object.entries(occupancyMap)
      .map(([date, count]) => ({
        date,
        count,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Fill in missing dates with 0 count
    const filledData = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dateKey = currentDate.toISOString().split("T")[0];
      const existingData = occupancyData.find((d) => d.date === dateKey);

      filledData.push({
        date: dateKey,
        count: existingData ? existingData.count : 0,
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return apiResponse(filledData);
  } catch (error) {
    console.error("Error fetching occupancy data:", error);
    return apiError("Internal server error", 500);
  }
}
