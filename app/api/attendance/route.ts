import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiResponse, apiError } from "@/lib/utils";
import { createAttendanceSchema, getAttendanceQuerySchema } from "@/lib/validations";
import { getUserFromRequest } from "@/lib/auth-helpers";
import { getAccessibleUserIds } from "@/lib/permissions";

// GET /api/attendance - Get attendance records (filtered by permissions)
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return apiError("Authentication required", 401);
    }

    const searchParams = request.nextUrl.searchParams;
    const query = {
      userId: searchParams.get("userId") || undefined,
      startDate: searchParams.get("startDate") || undefined,
      endDate: searchParams.get("endDate") || undefined,
      status: searchParams.get("status") || undefined,
    };

    const validation = getAttendanceQuerySchema.safeParse(query);

    if (!validation.success) {
      return apiError(validation.error.issues[0].message, 400);
    }

    const { userId, startDate, endDate, status } = validation.data;

    // Get accessible user IDs based on current user's role
    const accessibleUserIds = await getAccessibleUserIds(user);

    // Build where clause
    const where: any = {
      userId: {
        in: accessibleUserIds, // Only show attendance for accessible users
      },
    };

    // If specific userId requested, ensure it's accessible
    if (userId) {
      if (!accessibleUserIds.includes(userId)) {
        return apiError("You do not have permission to access this user's attendance", 403);
      }
      where.userId = userId;
    }

    if (startDate || endDate) {
      where.date = {};
      if (startDate) {
        where.date.gte = new Date(startDate);
      }
      if (endDate) {
        where.date.lte = new Date(endDate);
      }
    }

    if (status) {
      where.status = status;
    }

    const records = await prisma.attendanceRecord.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            teamName: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: {
        date: "desc",
      },
    });

    return apiResponse(records);
  } catch (error) {
    console.error("Error fetching attendance:", error);
    return apiError("Internal server error", 500);
  }
}

// POST /api/attendance - Create or update attendance record
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return apiError("Authentication required", 401);
    }

    const body = await request.json();
    const validation = createAttendanceSchema.safeParse(body);

    if (!validation.success) {
      return apiError(validation.error.issues[0].message, 400);
    }

    const { userId, date, status, notes } = validation.data;

    // Check if user can allocate attendance for target user
    const { canAllocateAttendance } = await import("@/lib/permissions");
    const canAllocate = await canAllocateAttendance(user, userId);

    if (!canAllocate) {
      return apiError("You do not have permission to allocate attendance for this user", 403);
    }

    // Upsert attendance record (create or update if exists)
    const record = await prisma.attendanceRecord.upsert({
      where: {
        userId_date: {
          userId,
          date: new Date(date),
        },
      },
      update: {
        status,
        notes: notes || null,
      },
      create: {
        userId,
        date: new Date(date),
        status,
        notes: notes || null,
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
    });

    return apiResponse(record, 201);
  } catch (error) {
    console.error("Error creating attendance:", error);
    return apiError("Internal server error", 500);
  }
}
