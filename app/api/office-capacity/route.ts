import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiResponse, apiError } from "@/lib/utils";
import { getUserFromRequest } from "@/lib/auth-helpers";
import { UserRole } from "@prisma/client";

// GET /api/office-capacity - Get office capacity and current bookings
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return apiError("Authentication required", 401);
    }

    // Only Chapter Leads and Tribe Lead can view capacity
    if (user.role !== UserRole.CHAPTER_LEAD && user.role !== UserRole.TRIBE_LEAD) {
      return apiError("Access denied", 403);
    }

    // Get week offset from query params (default to 0 for current week)
    const { searchParams } = new URL(request.url);
    const weekOffset = parseInt(searchParams.get("weekOffset") || "0", 10);

    // Get the start of the current week (Monday) using date strings to avoid timezone issues
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const date = today.getDate();
    const todayLocal = new Date(year, month, date); // Create date at midnight local time
    const dayOfWeek = todayLocal.getDay(); // 0=Sunday, 1=Monday, etc.
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(todayLocal);
    monday.setDate(todayLocal.getDate() + mondayOffset + (weekOffset * 7));

    // Get capacity settings
    let capacitySettings = await prisma.officeCapacity.findMany({
      orderBy: {
        dayOfWeek: "asc",
      },
    });

    // If no capacity settings exist, create default ones
    if (capacitySettings.length === 0) {
      const defaultCapacities = [
        { dayOfWeek: "Monday", capacity: 20 },
        { dayOfWeek: "Tuesday", capacity: 10 },
        { dayOfWeek: "Wednesday", capacity: 50 },
        { dayOfWeek: "Thursday", capacity: 20 },
        { dayOfWeek: "Friday", capacity: 50 },
      ];

      await prisma.officeCapacity.createMany({
        data: defaultCapacities,
      });

      capacitySettings = await prisma.officeCapacity.findMany({
        orderBy: {
          dayOfWeek: "asc",
        },
      });
    }

    // Calculate bookings for this week
    const weekData = [];
    const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

    for (let i = 0; i < 5; i++) {
      const currentDate = new Date(monday);
      currentDate.setDate(monday.getDate() + i);
      // Format date as YYYY-MM-DD using local date parts to avoid timezone issues
      const year = currentDate.getFullYear();
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      const day = String(currentDate.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      // Get office bookings for this date using date range to handle timezone issues
      const dayStart = new Date(currentDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(currentDate);
      dayEnd.setHours(23, 59, 59, 999);

      const bookings = await prisma.attendanceRecord.count({
        where: {
          date: {
            gte: dayStart,
            lte: dayEnd,
          },
          status: "office",
        },
      });

      const capacitySetting = capacitySettings.find(
        (c) => c.dayOfWeek === dayNames[i]
      );

      const capacity = capacitySetting?.capacity || 0;
      const available = capacity - bookings;

      weekData.push({
        day: dayNames[i],
        date: dateStr,
        capacity,
        booked: bookings,
        available: available > 0 ? available : 0,
        isOverbooked: bookings > capacity,
        utilizationPercent: capacity > 0 ? Math.round((bookings / capacity) * 100) : 0,
      });
    }

    return apiResponse({
      weekData,
      capacitySettings,
    });
  } catch (error) {
    console.error("Error fetching office capacity:", error);
    return apiError("Internal server error", 500);
  }
}

// PUT /api/office-capacity - Update capacity settings (Tribe Lead only)
export async function PUT(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return apiError("Authentication required", 401);
    }

    // Only Tribe Lead can update capacity
    if (user.role !== UserRole.TRIBE_LEAD) {
      return apiError("Only Tribe Lead can update capacity", 403);
    }

    const body = await request.json();
    const { dayOfWeek, capacity } = body;

    if (!dayOfWeek || capacity === undefined) {
      return apiError("Missing required fields", 400);
    }

    const validDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
    if (!validDays.includes(dayOfWeek)) {
      return apiError("Invalid day of week", 400);
    }

    if (capacity < 0) {
      return apiError("Capacity must be positive", 400);
    }

    // Update or create capacity setting
    const updatedCapacity = await prisma.officeCapacity.upsert({
      where: { dayOfWeek },
      update: { capacity },
      create: { dayOfWeek, capacity },
    });

    return apiResponse(updatedCapacity);
  } catch (error) {
    console.error("Error updating office capacity:", error);
    return apiError("Internal server error", 500);
  }
}
