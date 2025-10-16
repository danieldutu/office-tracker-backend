import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { User, UserRole } from "@prisma/client";

/**
 * Authentication and Authorization Helpers
 *
 * These functions help with:
 * - Getting the current user from requests
 * - Checking permissions
 * - Returning proper error responses
 */

/**
 * Get current user from request
 * For now, we'll use a simple email-based approach
 * In production, this would use JWT tokens or sessions
 */
export async function getCurrentUser(request: NextRequest): Promise<User | null> {
  // Get user ID from header (set by login endpoint)
  const userId = request.headers.get("x-user-id");

  if (!userId) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      chapterLead: true,
      directReports: true,
    },
  });

  return user;
}

/**
 * Require authentication - returns user or error response
 */
export async function requireAuth(
  request: NextRequest
): Promise<{ user: User } | { error: NextResponse }> {
  const user = await getCurrentUser(request);

  if (!user) {
    return {
      error: NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      ),
    };
  }

  return { user };
}

/**
 * Require minimum role - returns user or error response
 */
export async function requireRole(
  request: NextRequest,
  minimumRole: UserRole
): Promise<{ user: User } | { error: NextResponse }> {
  const authResult = await requireAuth(request);

  if ("error" in authResult) {
    return authResult;
  }

  const { user } = authResult;

  const roleHierarchy = {
    [UserRole.REPORTER]: 1,
    [UserRole.CHAPTER_LEAD]: 2,
    [UserRole.TRIBE_LEAD]: 3,
  };

  if (roleHierarchy[user.role] < roleHierarchy[minimumRole]) {
    return {
      error: NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      ),
    };
  }

  return { user };
}

/**
 * Helper to create error responses
 */
export function createErrorResponse(message: string, status: number = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Helper to create success responses
 */
export function createSuccessResponse(data: any, status: number = 200) {
  return NextResponse.json(data, { status });
}

/**
 * Simple auth check for temp development
 * Gets user from email header (will be replaced with proper JWT)
 */
export async function getUserFromRequest(request: NextRequest): Promise<User | null> {
  // For development, get email from header
  const userEmail = request.headers.get("x-user-email");

  if (!userEmail) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { email: userEmail },
    include: {
      chapterLead: true,
      directReports: true,
    },
  });

  return user;
}
