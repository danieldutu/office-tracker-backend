import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiResponse, apiError } from "@/lib/utils";
import { getUserFromRequest } from "@/lib/auth-helpers";

// GET /api/attendance/week - Get current week's attendance
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return apiError("Authentication required", 401);
    }

    const searchParams = request.nextUrl.searchParams;
    const weekParam = searchParams.get("week");

    let startDate: Date;
    let endDate: Date;

    if (weekParam) {
      // Parse ISO week format (e.g., "2025-W03")
      const [year, week] = weekParam.split("-W").map(Number);
      const firstDayOfYear = new Date(year, 0, 1);
      const daysOffset = (week - 1) * 7;
      startDate = new Date(
        firstDayOfYear.setDate(firstDayOfYear.getDate() + daysOffset)
      );
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 6);
    } else {
      // Get current week (Monday to Sunday)
      const now = new Date();
      const dayOfWeek = now.getDay();
      const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Adjust to Monday

      startDate = new Date(now);
      startDate.setDate(now.getDate() + diff);
      startDate.setHours(0, 0, 0, 0);

      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
      endDate.setHours(23, 59, 59, 999);
    }

    const records = await prisma.attendanceRecord.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: [{ date: "asc" }, { user: { name: "asc" } }],
    });

    return apiResponse({
      startDate: startDate.toISOString().split("T")[0],
      endDate: endDate.toISOString().split("T")[0],
      records,
    });
  } catch (error) {
    console.error("Error fetching weekly attendance:", error);
    return apiError("Internal server error", 500);
  }
}
