import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiResponse, apiError } from "@/lib/utils";
import { getUserFromRequest } from "@/lib/auth-helpers";
import { UserRole } from "@prisma/client";

// GET /api/delegations - Get all delegations (Tribe Lead only)
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return apiError("Authentication required", 401);
    }

    if (user.role !== UserRole.TRIBE_LEAD) {
      return apiError("Only Tribe Lead can view delegations", 403);
    }

    const delegations = await prisma.delegation.findMany({
      where: {
        delegatorId: user.id,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return apiResponse(delegations);
  } catch (error) {
    console.error("Error fetching delegations:", error);
    return apiError("Internal server error", 500);
  }
}

// POST /api/delegations - Create a new delegation (Tribe Lead only)
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return apiError("Authentication required", 401);
    }

    if (user.role !== UserRole.TRIBE_LEAD) {
      return apiError("Only Tribe Lead can create delegations", 403);
    }

    const body = await request.json();
    const { delegateId, startDate, endDate } = body;

    if (!delegateId || !startDate || !endDate) {
      return apiError("Missing required fields", 400);
    }

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start >= end) {
      return apiError("End date must be after start date", 400);
    }

    // Check if delegate exists
    const delegate = await prisma.user.findUnique({
      where: { id: delegateId },
    });

    if (!delegate) {
      return apiError("Delegate user not found", 404);
    }

    // Deactivate any existing active delegations for this delegate
    await prisma.delegation.updateMany({
      where: {
        delegateId,
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });

    // Create new delegation
    const delegation = await prisma.delegation.create({
      data: {
        delegatorId: user.id,
        delegateId,
        startDate: start,
        endDate: end,
        isActive: true,
      },
    });

    return apiResponse(delegation, 201);
  } catch (error) {
    console.error("Error creating delegation:", error);
    return apiError("Internal server error", 500);
  }
}

// DELETE /api/delegations/:id - Revoke a delegation
export async function DELETE(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);

    if (!user) {
      return apiError("Authentication required", 401);
    }

    if (user.role !== UserRole.TRIBE_LEAD) {
      return apiError("Only Tribe Lead can revoke delegations", 403);
    }

    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return apiError("Delegation ID required", 400);
    }

    // Update delegation to inactive
    const delegation = await prisma.delegation.update({
      where: { id },
      data: { isActive: false },
    });

    return apiResponse(delegation);
  } catch (error) {
    console.error("Error revoking delegation:", error);
    return apiError("Internal server error", 500);
  }
}
