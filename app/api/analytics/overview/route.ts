import { NextRequest } from "next/server";
// import { auth } from "@/lib/auth"; // Disabled for testing
import { prisma } from "@/lib/prisma";
import { apiResponse, apiError } from "@/lib/utils";

// GET /api/analytics/overview - Get general stats
export async function GET(request: NextRequest) {
  try {
    // Temporarily disabled auth for testing
    // const session = await auth();
    // if (!session?.user) {
    //   return apiError("Unauthorized", 401);
    // }

    // Get total active users
    const totalUsers = await prisma.user.count();

    // Get last 30 days of attendance
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentAttendance = await prisma.attendanceRecord.findMany({
      where: {
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

    return apiResponse({
      totalUsers,
      averageOccupancy,
      mostPopularDay,
      remoteWorkRate,
    });
  } catch (error) {
    console.error("Error fetching analytics overview:", error);
    return apiError("Internal server error", 500);
  }
}
