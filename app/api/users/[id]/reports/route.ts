import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiResponse, apiError } from "@/lib/utils";
import { getUserFromRequest } from "@/lib/auth-helpers";
import { canAccessUser } from "@/lib/permissions";
import { UserRole } from "@prisma/client";

// GET /api/users/:id/reports - Get direct reports for a Chapter Lead
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = await getUserFromRequest(request);

    if (!currentUser) {
      return apiError("Authentication required", 401);
    }

    const { id } = params;

    // Check if current user can access the target user
    const canAccess = await canAccessUser(currentUser, id);

    if (!canAccess) {
      return apiError("You do not have permission to access this user", 403);
    }

    // Get the target user to verify they're a Chapter Lead
    const targetUser = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        teamName: true,
      },
    });

    if (!targetUser) {
      return apiError("User not found", 404);
    }

    // Only Chapter Leads and Tribe Lead have direct reports
    if (targetUser.role === UserRole.REPORTER) {
      return apiResponse({
        chapterLead: targetUser,
        directReports: [],
        totalReports: 0,
      });
    }

    // Get direct reports with recent attendance (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const directReports = await prisma.user.findMany({
      where: {
        chapterLeadId: id,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        teamName: true,
        avatarUrl: true,
        createdAt: true,
        attendance: {
          where: {
            date: {
              gte: sevenDaysAgo,
            },
          },
          orderBy: {
            date: "desc",
          },
          take: 7,
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    // If target is Tribe Lead, also get all Chapter Leads
    let chapterLeads: any[] = [];
    if (targetUser.role === UserRole.TRIBE_LEAD) {
      chapterLeads = await prisma.user.findMany({
        where: {
          role: UserRole.CHAPTER_LEAD,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          teamName: true,
          avatarUrl: true,
          _count: {
            select: {
              directReports: true,
            },
          },
        },
        orderBy: {
          name: "asc",
        },
      });
    }

    return apiResponse({
      chapterLead: targetUser,
      directReports,
      totalReports: directReports.length,
      ...(targetUser.role === UserRole.TRIBE_LEAD && {
        chapterLeads,
        totalChapterLeads: chapterLeads.length,
      }),
    });
  } catch (error) {
    console.error("Error fetching direct reports:", error);
    return apiError("Internal server error", 500);
  }
}
