import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiResponse, apiError } from "@/lib/utils";

// GET /api/analytics/occupancy - Get office occupancy data by date
export async function GET(request: NextRequest) {
  try {
    // Temporarily disabled auth for testing
    // const session = await auth();
    // if (!session?.user) {
    //   return apiError("Unauthorized", 401);
    // }

    const searchParams = request.nextUrl.searchParams;
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");

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
