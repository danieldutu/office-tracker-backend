import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiResponse, apiError } from "@/lib/utils";

// GET /api/analytics/weekly-pattern - Get weekly attendance patterns
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return apiError("Unauthorized", 401);
    }

    // Get last 90 days for better pattern analysis
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const attendance = await prisma.attendanceRecord.findMany({
      where: {
        date: {
          gte: ninetyDaysAgo,
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
