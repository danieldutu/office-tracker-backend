import { NextResponse } from "next/server";

export function apiResponse(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

export function apiError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function validateRole(userRole: string, requiredRole: "admin" | "user") {
  if (requiredRole === "admin" && userRole !== "admin") {
    return false;
  }
  return true;
}
