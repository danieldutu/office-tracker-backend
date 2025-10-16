# Office Attendance Tracker - Backend API

Backend API for the Office Attendance Tracker application, built with Next.js 15, Prisma, and PostgreSQL.

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Authentication**: NextAuth.js v5
- **Validation**: Zod
- **TypeScript**: Full type safety

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database (local or cloud)
- npm or yarn

### Installation

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up environment variables**:
   Create a `.env` file in the root directory:
   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/office_tracker"
   NEXTAUTH_SECRET="your-secret-key-here"
   NEXTAUTH_URL="http://localhost:3000"
   ```

   Generate a secret key:
   ```bash
   openssl rand -base64 32
   ```

3. **Set up the database**:
   ```bash
   # Generate Prisma client
   npm run prisma:generate

   # Run migrations
   npm run prisma:migrate

   # (Optional) Open Prisma Studio to view data
   npm run prisma:studio
   ```

4. **Seed initial data** (optional):
   You can create an admin user directly in Prisma Studio or via SQL:
   ```sql
   INSERT INTO users (id, email, name, password_hash, role)
   VALUES (
     gen_random_uuid(),
     'admin@company.com',
     'Admin User',
     '$2a$10$...',  -- Use bcrypt to hash a password
     'admin'
   );
   ```

5. **Start the development server**:
   ```bash
   npm run dev
   ```

   The API will be available at `http://localhost:3000`

## API Documentation

### Base URL
```
http://localhost:3000/api
```

### Authentication
All endpoints (except login) require authentication via NextAuth.js session cookies.

### Endpoints

#### **Authentication**
- `POST /api/auth/signin` - Login with credentials
- `GET /api/auth/session` - Get current session
- `POST /api/auth/signout` - Logout

#### **Users**
- `GET /api/users` - Get all users
- `POST /api/users` - Create new user (admin only)
- `GET /api/users/me` - Get current user
- `GET /api/users/:id` - Get user by ID
- `PATCH /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user (admin only)

#### **Attendance**
- `GET /api/attendance` - Get attendance records
  - Query params: `userId`, `startDate`, `endDate`, `status`
- `POST /api/attendance` - Create/update attendance record
- `GET /api/attendance/:id` - Get specific record
- `PATCH /api/attendance/:id` - Update record
- `DELETE /api/attendance/:id` - Delete record
- `GET /api/attendance/week?week=2025-W03` - Get week's attendance

#### **Analytics**
- `GET /api/analytics/overview` - Get general statistics
- `GET /api/analytics/occupancy?startDate=&endDate=` - Get office occupancy data
- `GET /api/analytics/weekly-pattern` - Get weekly attendance patterns

## Database Schema

### Users
- `id` (UUID, Primary Key)
- `email` (String, Unique)
- `name` (String)
- `passwordHash` (String, nullable)
- `role` (String: "user" | "admin")
- `avatarUrl` (String, nullable)
- `createdAt`, `updatedAt` (DateTime)

### AttendanceRecord
- `id` (UUID, Primary Key)
- `userId` (UUID, Foreign Key → users)
- `date` (Date)
- `status` (String: "office" | "remote" | "absent" | "vacation")
- `notes` (Text, nullable)
- `createdAt`, `updatedAt` (DateTime)
- Unique constraint: `(userId, date)`

### Teams (optional)
- `id` (UUID, Primary Key)
- `name` (String)
- `description` (Text, nullable)
- `createdAt` (DateTime)

### UserTeam (junction table)
- `userId` (UUID, Foreign Key)
- `teamId` (UUID, Foreign Key)
- Composite Primary Key: `(userId, teamId)`

## Scripts

```bash
# Development
npm run dev              # Start dev server on port 3000

# Production
npm run build           # Build for production
npm start               # Start production server

# Database
npm run prisma:generate  # Generate Prisma client
npm run prisma:migrate   # Run database migrations
npm run prisma:studio    # Open Prisma Studio GUI

# Code Quality
npm run lint            # Run ESLint
```

## Project Structure

```
backend/
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/     # NextAuth routes
│   │   ├── users/                  # User endpoints
│   │   ├── attendance/             # Attendance endpoints
│   │   └── analytics/              # Analytics endpoints
│   ├── layout.tsx                  # Root layout
│   ├── page.tsx                    # Home page
│   └── globals.css                 # Global styles
├── lib/
│   ├── auth.ts                     # NextAuth configuration
│   ├── prisma.ts                   # Prisma client
│   ├── utils.ts                    # Utility functions
│   └── validations.ts              # Zod schemas
├── prisma/
│   └── schema.prisma               # Database schema
├── types/
│   └── next-auth.d.ts              # NextAuth type extensions
├── .env                            # Environment variables (not in git)
├── .env.example                    # Example env file
└── package.json
```

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/db` |
| `NEXTAUTH_SECRET` | Secret for NextAuth.js | Generate with `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Base URL of your app | `http://localhost:3000` |

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy!

Vercel automatically handles:
- Build process
- Environment variables
- HTTPS
- Automatic deployments on push

### Database Options

1. **Vercel Postgres** - Free tier available, easy integration
2. **Supabase** - Free tier, includes auth and storage
3. **Railway** - Simple deployment, free tier
4. **Neon** - Serverless Postgres, free tier

## Security Features

- ✅ Password hashing with bcrypt
- ✅ JWT-based sessions
- ✅ CORS configuration
- ✅ Input validation with Zod
- ✅ SQL injection protection (Prisma)
- ✅ Role-based access control
- ✅ Secure HTTP-only cookies

## Development Tips

1. **Database Changes**: After modifying `schema.prisma`, run:
   ```bash
   npm run prisma:generate
   npm run prisma:migrate
   ```

2. **View Data**: Use Prisma Studio for a GUI:
   ```bash
   npm run prisma:studio
   ```

3. **Testing APIs**: Use tools like:
   - Postman
   - Insomnia
   - Thunder Client (VS Code)
   - curl

4. **Debugging**: Check Next.js logs in terminal and browser console

## Troubleshooting

### Database connection issues
- Verify `DATABASE_URL` is correct
- Ensure PostgreSQL is running
- Check firewall settings

### Authentication issues
- Verify `NEXTAUTH_SECRET` is set
- Clear browser cookies
- Check session expiry

### Migration errors
- Reset database: `npx prisma migrate reset`
- Or manually delete `prisma/migrations/` and run fresh migration

## Next Steps

1. Set up production database (Vercel Postgres, Supabase, etc.)
2. Deploy to Vercel
3. Configure custom domain (optional)
4. Set up monitoring and error tracking
5. Add rate limiting for production
6. Implement email notifications (magic links)
7. Add data export functionality

## Support

For issues or questions, refer to:
- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [NextAuth.js Documentation](https://next-auth.js.org/)

## License

MIT
