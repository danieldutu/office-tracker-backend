import { User, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * RBAC Permission Utilities
 *
 * This module provides permission checking functions for the three-tier role system:
 * - REPORTER: Basic users with limited access
 * - CHAPTER_LEAD: Team managers with access to their direct reports
 * - TRIBE_LEAD: Admin with full access to all users and features
 */

// ====================
// Role Checking
// ====================

export function isReporter(user: User): boolean {
  return user.role === UserRole.REPORTER;
}

export function isChapterLead(user: User): boolean {
  return user.role === UserRole.CHAPTER_LEAD;
}

export function isTribeLead(user: User): boolean {
  return user.role === UserRole.TRIBE_LEAD;
}

export function hasMinimumRole(user: User, minimumRole: UserRole): boolean {
  const roleHierarchy = {
    [UserRole.REPORTER]: 1,
    [UserRole.CHAPTER_LEAD]: 2,
    [UserRole.TRIBE_LEAD]: 3,
  };

  return roleHierarchy[user.role] >= roleHierarchy[minimumRole];
}

// ====================
// User Access Control
// ====================

/**
 * Check if current user can access another user's data
 * Rules:
 * - Tribe Lead: Can access anyone
 * - Chapter Lead: Can access their direct reports
 * - Reporter: Can only access self
 */
export async function canAccessUser(
  currentUser: User,
  targetUserId: string
): Promise<boolean> {
  // Can always access self
  if (currentUser.id === targetUserId) {
    return true;
  }

  // Tribe Lead can access anyone
  if (isTribeLead(currentUser)) {
    return true;
  }

  // Chapter Lead can access direct reports
  if (isChapterLead(currentUser)) {
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { chapterLeadId: true },
    });

    return targetUser?.chapterLeadId === currentUser.id;
  }

  // Reporters can only access self
  return false;
}

/**
 * Get all user IDs that the current user can access
 * Returns: Array of user IDs
 */
export async function getAccessibleUserIds(currentUser: User): Promise<string[]> {
  // Tribe Lead can access everyone
  if (isTribeLead(currentUser)) {
    const allUsers = await prisma.user.findMany({
      select: { id: true },
    });
    return allUsers.map(u => u.id);
  }

  // Chapter Lead can access their direct reports + self
  if (isChapterLead(currentUser)) {
    const directReports = await prisma.user.findMany({
      where: { chapterLeadId: currentUser.id },
      select: { id: true },
    });
    return [currentUser.id, ...directReports.map(u => u.id)];
  }

  // Reporters can only access self
  return [currentUser.id];
}

// ====================
// Attendance Permissions
// ====================

/**
 * Check if user can allocate/modify attendance for target user
 * Rules:
 * - Anyone can allocate for self
 * - Tribe Lead can allocate for anyone
 * - Chapter Lead can allocate for direct reports
 * - Reporters cannot allocate for others
 */
export async function canAllocateAttendance(
  allocator: User,
  targetUserId: string
): Promise<boolean> {
  // Can always allocate for self
  if (allocator.id === targetUserId) {
    return true;
  }

  // Tribe Lead can allocate for anyone
  if (isTribeLead(allocator)) {
    return true;
  }

  // Chapter Lead can allocate for direct reports
  if (isChapterLead(allocator)) {
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { chapterLeadId: true },
    });

    return targetUser?.chapterLeadId === allocator.id;
  }

  // Reporters cannot allocate for others
  return false;
}

/**
 * Check if user can delete/override an attendance record
 */
export async function canModifyAttendance(
  user: User,
  attendanceUserId: string
): Promise<boolean> {
  return canAllocateAttendance(user, attendanceUserId);
}

// ====================
// Analytics Permissions
// ====================

export type AnalyticsScope = "self" | "team" | "organization";

/**
 * Check if user can view analytics at the specified scope
 * Rules:
 * - Everyone can view self analytics
 * - Chapter Lead and Tribe Lead can view team analytics
 * - Only Tribe Lead can view organization analytics
 */
export function canViewAnalytics(user: User, scope: AnalyticsScope): boolean {
  switch (scope) {
    case "self":
      return true;
    case "team":
      return isChapterLead(user) || isTribeLead(user);
    case "organization":
      return isTribeLead(user);
    default:
      return false;
  }
}

/**
 * Get the appropriate analytics scope for a user
 * Returns the maximum scope the user can access
 */
export function getMaxAnalyticsScope(user: User): AnalyticsScope {
  if (isTribeLead(user)) return "organization";
  if (isChapterLead(user)) return "team";
  return "self";
}

// ====================
// Team Management Permissions
// ====================

/**
 * Check if user can view a specific team
 * Rules:
 * - Tribe Lead: Can view all teams
 * - Chapter Lead: Can view their own team
 * - Reporter: Can view their Chapter Lead's team (read-only)
 */
export async function canViewTeam(
  user: User,
  chapterLeadId: string
): Promise<boolean> {
  // Tribe Lead can view all teams
  if (isTribeLead(user)) {
    return true;
  }

  // Chapter Lead can view their own team
  if (isChapterLead(user) && user.id === chapterLeadId) {
    return true;
  }

  // Reporter can view their CL's team
  if (isReporter(user) && user.chapterLeadId === chapterLeadId) {
    return true;
  }

  return false;
}

/**
 * Check if user can manage team members (allocate, edit)
 */
export function canManageTeam(user: User): boolean {
  return isChapterLead(user) || isTribeLead(user);
}

// ====================
// Admin Permissions
// ====================

/**
 * Check if user can access admin panel
 * Only Tribe Lead has admin access
 */
export function canAccessAdmin(user: User): boolean {
  return isTribeLead(user);
}

/**
 * Check if user can modify roles
 */
export function canModifyRoles(user: User): boolean {
  return isTribeLead(user);
}

/**
 * Check if user can create/delete users
 */
export function canManageUsers(user: User): boolean {
  return isTribeLead(user);
}

/**
 * Check if user can assign Chapter Leads
 */
export function canAssignChapterLeads(user: User): boolean {
  return isTribeLead(user);
}

// ====================
// Export Permissions
// ====================

export type ExportScope = "own" | "team" | "organization";

/**
 * Check if user can export data at specified scope
 * Rules:
 * - Everyone can export own data
 * - Chapter Lead can export team data
 * - Tribe Lead can export all data
 */
export function canExportData(user: User, scope: ExportScope): boolean {
  switch (scope) {
    case "own":
      return true;
    case "team":
      return isChapterLead(user) || isTribeLead(user);
    case "organization":
      return isTribeLead(user);
    default:
      return false;
  }
}

// ====================
// Helper Functions
// ====================

/**
 * Get direct reports for a Chapter Lead or Tribe Lead
 */
export async function getDirectReports(user: User): Promise<User[]> {
  if (!isChapterLead(user) && !isTribeLead(user)) {
    return [];
  }

  return await prisma.user.findMany({
    where: { chapterLeadId: user.id },
    include: {
      attendance: {
        orderBy: { date: "desc" },
        take: 7, // Last 7 days
      },
    },
  });
}

/**
 * Get user's Chapter Lead
 */
export async function getChapterLead(user: User): Promise<User | null> {
  if (!user.chapterLeadId) {
    return null;
  }

  return await prisma.user.findUnique({
    where: { id: user.chapterLeadId },
  });
}

/**
 * Get all Chapter Leads (for Tribe Lead)
 */
export async function getAllChapterLeads(): Promise<User[]> {
  return await prisma.user.findMany({
    where: { role: UserRole.CHAPTER_LEAD },
    include: {
      _count: {
        select: { directReports: true },
      },
    },
    orderBy: { name: "asc" },
  });
}

/**
 * Check if user is managed by a specific Chapter Lead
 */
export function isManagedBy(user: User, chapterLeadId: string): boolean {
  return user.chapterLeadId === chapterLeadId;
}

/**
 * Validate that target user exists and return it
 */
export async function validateTargetUser(targetUserId: string): Promise<User | null> {
  return await prisma.user.findUnique({
    where: { id: targetUserId },
  });
}

// ====================
// Permission Error Messages
// ====================

export const PERMISSION_ERRORS = {
  INSUFFICIENT_ROLE: "Insufficient permissions for this action",
  NOT_YOUR_TEAM: "You can only manage your direct reports",
  NOT_CHAPTER_LEAD: "This action requires Chapter Lead or higher privileges",
  NOT_TRIBE_LEAD: "This action requires Tribe Lead privileges",
  CANNOT_ACCESS_USER: "You do not have permission to access this user's data",
  CANNOT_ALLOCATE: "You cannot allocate attendance for this user",
  CANNOT_VIEW_ANALYTICS: "You do not have permission to view these analytics",
  CANNOT_ACCESS_ADMIN: "Admin panel access is restricted to Tribe Lead",
  CANNOT_EXPORT: "You do not have permission to export this data",
  USER_NOT_FOUND: "Target user not found",
};
