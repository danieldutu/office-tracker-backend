import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiResponse, apiError } from "@/lib/utils";
import { createAttendanceSchema, getAttendanceQuerySchema } from "@/lib/validations";

// GET /api/attendance - Get attendance records
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return apiError("Unauthorized", 401);
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

    // Build where clause
    const where: any = {};

    if (userId) {
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
    const session = await auth();

    if (!session?.user) {
      return apiError("Unauthorized", 401);
    }

    const body = await request.json();
    const validation = createAttendanceSchema.safeParse(body);

    if (!validation.success) {
      return apiError(validation.error.issues[0].message, 400);
    }

    const { userId, date, status, notes } = validation.data;

    // Users can only create attendance for themselves unless they're admin
    if (userId !== session.user.id && session.user.role !== "admin") {
      return apiError("Forbidden", 403);
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
