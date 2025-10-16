import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiResponse, apiError } from "@/lib/utils";
import { updateAttendanceSchema } from "@/lib/validations";
import { getUserFromRequest } from "@/lib/auth-helpers";

// GET /api/attendance/[id] - Get specific attendance record
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return apiError("Authentication required", 401);
    }

    const { id } = await params;

    const record = await prisma.attendanceRecord.findUnique({
      where: { id },
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

    if (!record) {
      return apiError("Attendance record not found", 404);
    }

    return apiResponse(record);
  } catch (error) {
    console.error("Error fetching attendance:", error);
    return apiError("Internal server error", 500);
  }
}

// PATCH /api/attendance/[id] - Update attendance record
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return apiError("Authentication required", 401);
    }

    const { id } = await params;

    // Check if record exists and belongs to user
    const existingRecord = await prisma.attendanceRecord.findUnique({
      where: { id },
    });

    if (!existingRecord) {
      return apiError("Attendance record not found", 404);
    }

    // Users can only update their own records unless they're Tribe Lead
    if (
      existingRecord.userId !== user.id &&
      user.role !== "TRIBE_LEAD"
    ) {
      return apiError("Forbidden", 403);
    }

    const body = await request.json();
    const validation = updateAttendanceSchema.safeParse(body);

    if (!validation.success) {
      return apiError(validation.error.issues[0].message, 400);
    }

    const record = await prisma.attendanceRecord.update({
      where: { id },
      data: validation.data,
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

    return apiResponse(record);
  } catch (error) {
    console.error("Error updating attendance:", error);
    return apiError("Internal server error", 500);
  }
}

// DELETE /api/attendance/[id] - Delete attendance record
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return apiError("Authentication required", 401);
    }

    const { id } = await params;

    // Check if record exists and belongs to user
    const existingRecord = await prisma.attendanceRecord.findUnique({
      where: { id },
    });

    if (!existingRecord) {
      return apiError("Attendance record not found", 404);
    }

    // Users can only delete their own records unless they're Tribe Lead
    if (
      existingRecord.userId !== user.id &&
      user.role !== "TRIBE_LEAD"
    ) {
      return apiError("Forbidden", 403);
    }

    await prisma.attendanceRecord.delete({
      where: { id },
    });

    return apiResponse({ message: "Attendance record deleted successfully" });
  } catch (error) {
    console.error("Error deleting attendance:", error);
    return apiError("Internal server error", 500);
  }
}
