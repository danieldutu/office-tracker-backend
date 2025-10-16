import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  // Allow all origins for CORS - simplified approach
  const allowOrigin = "*";
  
  // Handle CORS preflight requests
  if (request.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": allowOrigin,
        "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  // Clone the request to modify headers
  const response = NextResponse.next();
  
  // Add CORS headers to all responses
  response.headers.set("Access-Control-Allow-Origin", allowOrigin);
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "*");

  return response;
}

export const config = {
  matcher: "/api/:path*",
};
