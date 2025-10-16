import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth-helpers";
import { UserRole } from "@prisma/client";

/**
 * GET /api/teams/hierarchy
 * Get the organizational hierarchy
 *
 * Rules:
 * - Tribe Lead: Full organization hierarchy
 * - Chapter Lead: Their team hierarchy only
 * - Reporter: 403 Forbidden (or just their CL info)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Reporters cannot access hierarchy
    if (user.role === UserRole.REPORTER) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    // Get Tribe Lead
    const tribeLead = await prisma.user.findFirst({
      where: { role: UserRole.TRIBE_LEAD },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        teamName: true,
      },
    });

    // Get all Chapter Leads
    const chapterLeads = await prisma.user.findMany({
      where: { role: UserRole.CHAPTER_LEAD },
      include: {
        directReports: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            teamName: true,
          },
          orderBy: { name: "asc" },
        },
        _count: {
          select: { directReports: true },
        },
      },
      orderBy: { name: "asc" },
    });

    // If Chapter Lead, filter to only their team
    if (user.role === UserRole.CHAPTER_LEAD) {
      const myTeam = chapterLeads.find((cl) => cl.id === user.id);

      if (!myTeam) {
        return NextResponse.json(
          { error: "Team not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        tribeLead,
        chapterLeads: [
          {
            id: myTeam.id,
            name: myTeam.name,
            email: myTeam.email,
            role: myTeam.role,
            teamName: myTeam.teamName,
            directReportsCount: myTeam._count.directReports,
            directReports: myTeam.directReports,
          },
        ],
        totalChapterLeads: 1,
        totalReporters: myTeam.directReports.length,
      });
    }

    // Tribe Lead gets full hierarchy
    const hierarchy = {
      tribeLead,
      chapterLeads: chapterLeads.map((cl) => ({
        id: cl.id,
        name: cl.name,
        email: cl.email,
        role: cl.role,
        teamName: cl.teamName,
        chapterLeadId: cl.chapterLeadId,
        directReportsCount: cl._count.directReports,
        directReports: cl.directReports,
      })),
      totalChapterLeads: chapterLeads.length,
      totalReporters: chapterLeads.reduce(
        (sum, cl) => sum + cl._count.directReports,
        0
      ),
      totalUsers: 1 + chapterLeads.length + chapterLeads.reduce(
        (sum, cl) => sum + cl._count.directReports,
        0
      ),
    };

    return NextResponse.json(hierarchy);
  } catch (error) {
    console.error("Error fetching hierarchy:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
