import { z } from "zod";

// User validation schemas
export const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(6),
  role: z.enum(["user", "admin"]).optional().default("user"),
});

export const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  avatarUrl: z.string().url().optional().nullable(),
  role: z.enum(["user", "admin"]).optional(),
});

// Attendance validation schemas
export const createAttendanceSchema = z.object({
  userId: z.string().uuid(),
  date: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: "Invalid date format",
  }),
  status: z.enum(["office", "remote", "absent", "vacation"]),
  notes: z.string().optional(),
});

export const updateAttendanceSchema = z.object({
  status: z.enum(["office", "remote", "absent", "vacation"]).optional(),
  notes: z.string().optional().nullable(),
});

export const getAttendanceQuerySchema = z.object({
  userId: z.string().uuid().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.enum(["office", "remote", "absent", "vacation"]).optional(),
});

// Auth validation schemas
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const registerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(6),
});
