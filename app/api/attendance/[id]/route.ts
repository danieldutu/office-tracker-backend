import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiResponse, apiError } from "@/lib/utils";
import { updateAttendanceSchema } from "@/lib/validations";

// GET /api/attendance/[id] - Get specific attendance record
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();

    if (!session?.user) {
      return apiError("Unauthorized", 401);
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
    const session = await auth();

    if (!session?.user) {
      return apiError("Unauthorized", 401);
    }

    const { id } = await params;

    // Check if record exists and belongs to user
    const existingRecord = await prisma.attendanceRecord.findUnique({
      where: { id },
    });

    if (!existingRecord) {
      return apiError("Attendance record not found", 404);
    }

    // Users can only update their own records unless they're admin
    if (
      existingRecord.userId !== session.user.id &&
      session.user.role !== "admin"
    ) {
      return apiError("Forbidden", 403);
    }

    const body = await request.json();
    const validation = updateAttendanceSchema.safeParse(body);

    if (!validation.success) {
      return apiError(validation.error.errors[0].message, 400);
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
    const session = await auth();

    if (!session?.user) {
      return apiError("Unauthorized", 401);
    }

    const { id } = await params;

    // Check if record exists and belongs to user
    const existingRecord = await prisma.attendanceRecord.findUnique({
      where: { id },
    });

    if (!existingRecord) {
      return apiError("Attendance record not found", 404);
    }

    // Users can only delete their own records unless they're admin
    if (
      existingRecord.userId !== session.user.id &&
      session.user.role !== "admin"
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
