import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth-helpers";
import { UserRole } from "@prisma/client";

/**
 * GET /api/teams/my-team
 * Get the current user's team members
 *
 * Rules:
 * - Reporter: Gets their Chapter Lead's team (read-only)
 * - Chapter Lead: Gets their direct reports
 * - Tribe Lead: Gets all users (or can select specific team)
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

    // Tribe Lead gets all users grouped by team
    if (user.role === UserRole.TRIBE_LEAD) {
      const allUsers = await prisma.user.findMany({
        where: {
          role: {
            not: UserRole.TRIBE_LEAD,
          },
        },
        include: {
          chapterLead: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          attendance: {
            orderBy: { date: "desc" },
            take: 7,
          },
        },
        orderBy: [{ chapterLeadId: "asc" }, { name: "asc" }],
      });

      // Group by chapter lead
      const groupedTeams = allUsers.reduce((acc, member) => {
        const clId = member.chapterLeadId || "no-lead";
        if (!acc[clId]) {
          acc[clId] = {
            chapterLead: member.chapterLead,
            members: [],
          };
        }
        acc[clId].members.push({
          id: member.id,
          name: member.name,
          email: member.email,
          role: member.role,
          teamName: member.teamName,
          avatarUrl: member.avatarUrl,
          attendance: member.attendance,
        });
        return acc;
      }, {} as any);

      return NextResponse.json({
        teamsByChapterLead: Object.values(groupedTeams),
        totalMembers: allUsers.length,
      });
    }

    // Chapter Lead gets their direct reports
    if (user.role === UserRole.CHAPTER_LEAD) {
      const directReports = await prisma.user.findMany({
        where: { chapterLeadId: user.id },
        include: {
          attendance: {
            orderBy: { date: "desc" },
            take: 7,
          },
        },
        orderBy: { name: "asc" },
      });

      return NextResponse.json({
        chapterLead: {
          id: user.id,
          name: user.name,
          email: user.email,
        },
        teamMembers: directReports.map((member) => ({
          id: member.id,
          name: member.name,
          email: member.email,
          role: member.role,
          teamName: member.teamName,
          attendance: member.attendance,
        })),
        totalMembers: directReports.length,
      });
    }

    // Reporter gets their Chapter Lead's team (including themselves)
    if (user.role === UserRole.REPORTER && user.chapterLeadId) {
      const teamMembers = await prisma.user.findMany({
        where: {
          OR: [
            { chapterLeadId: user.chapterLeadId },
            { id: user.chapterLeadId },
          ],
        },
        include: {
          attendance: {
            orderBy: { date: "desc" },
            take: 7,
          },
        },
        orderBy: { name: "asc" },
      });

      const chapterLead = await prisma.user.findUnique({
        where: { id: user.chapterLeadId },
        select: {
          id: true,
          name: true,
          email: true,
        },
      });

      return NextResponse.json({
        chapterLead,
        teamMembers: teamMembers.map((member) => ({
          id: member.id,
          name: member.name,
          email: member.email,
          role: member.role,
          teamName: member.teamName,
          avatarUrl: member.avatarUrl,
          attendance: member.attendance,
        })),
        totalMembers: teamMembers.length,
        isReadOnly: true, // Reporters have read-only access
      });
    }

    // Reporter without a Chapter Lead
    return NextResponse.json({
      chapterLead: null,
      teamMembers: [
        {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          teamName: user.teamName,
          avatarUrl: user.avatarUrl,
          attendance: [],
        },
      ],
      totalMembers: 1,
      isReadOnly: true,
    });
  } catch (error) {
    console.error("Error fetching team:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
