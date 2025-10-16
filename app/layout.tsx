import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Office Attendance Tracker API",
  description: "Backend API for Office Attendance Tracker",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
