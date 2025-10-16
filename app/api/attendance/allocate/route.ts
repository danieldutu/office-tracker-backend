import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiResponse, apiError } from "@/lib/utils";
import { getUserFromRequest } from "@/lib/auth-helpers";
import { canAllocateAttendance } from "@/lib/permissions";
import { UserRole } from "@prisma/client";
import { z } from "zod";

const allocateSchema = z.object({
  userId: z.string().uuid("Invalid user ID"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format"),
  status: z.enum(["office", "remote", "off"], {
    errorMap: () => ({ message: "Status must be office, remote, or off" }),
  }),
  notes: z.string().optional(),
});

// POST /api/attendance/allocate - Allocate attendance for team members (Chapter Lead/Tribe Lead only)
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return apiError("Authentication required", 401);
    }

    // Only Chapter Leads and Tribe Lead can use this endpoint
    if (user.role === UserRole.REPORTER) {
      return apiError("Reporters cannot allocate attendance. Use POST /api/attendance for self-allocation.", 403);
    }

    const body = await request.json();
    const validation = allocateSchema.safeParse(body);

    if (!validation.success) {
      return apiError(validation.error.issues[0].message, 400);
    }

    const { userId, date, status, notes } = validation.data;

    // Prevent self-allocation through this endpoint
    if (userId === user.id) {
      return apiError("Use POST /api/attendance for self-allocation", 400);
    }

    // Check if user can allocate for this target user
    const canAllocate = await canAllocateAttendance(user, userId);

    if (!canAllocate) {
      return apiError("You do not have permission to allocate attendance for this user", 403);
    }

    // Verify target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true, teamName: true },
    });

    if (!targetUser) {
      return apiError("User not found", 404);
    }

    // Chapter Leads can only allocate for their direct reports
    if (user.role === UserRole.CHAPTER_LEAD) {
      const isDirectReport = await prisma.user.findFirst({
        where: {
          id: userId,
          chapterLeadId: user.id,
        },
      });

      if (!isDirectReport) {
        return apiError("You can only allocate attendance for your direct reports", 403);
      }
    }

    // Upsert attendance record
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
            role: true,
            teamName: true,
            avatarUrl: true,
          },
        },
      },
    });

    return apiResponse({
      record,
      allocatedBy: {
        id: user.id,
        name: user.name,
        role: user.role,
      },
    }, 201);
  } catch (error) {
    console.error("Error allocating attendance:", error);
    return apiError("Internal server error", 500);
  }
}
