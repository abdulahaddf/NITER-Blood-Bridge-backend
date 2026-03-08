# NITER Blood Bridge API

Backend API for NITER Blood Bridge - a blood donor search and management platform.

## Tech Stack

- **Framework:** NestJS
- **Language:** TypeScript
- **ORM:** Prisma
- **Database:** PostgreSQL
- **Authentication:** JWT + Google OAuth
- **Email:** Resend

## Project Structure

```
src/
├── auth/           # Authentication module
├── users/          # User management
├── profiles/       # Donor profiles
├── donors/         # Donor search
├── donations/      # Donation logging
├── requests/       # Blood requests
├── admin/          # Admin operations
├── notifications/  # Email & notifications
├── seed/           # Seed data import
├── prisma/         # Database service
├── common/         # Decorators, guards, interceptors
└── main.ts         # Application entry point
```

## Setup

1. Install dependencies:

```bash
npm install
```

2. Set up environment variables:

```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Run database migrations:

```bash
npx prisma migrate dev
```

4. Generate Prisma client:

```bash
npx prisma generate
```

5. Start the development server:

```bash
npm run start:dev
```

## API Documentation

Once the server is running, visit:

- Swagger UI: http://localhost:3001/api/docs

## Environment Variables

| Variable               | Description                  |
| ---------------------- | ---------------------------- |
| `DATABASE_URL`         | PostgreSQL connection string |
| `JWT_SECRET`           | JWT signing secret           |
| `JWT_REFRESH_SECRET`   | JWT refresh token secret     |
| `GOOGLE_CLIENT_ID`     | Google OAuth client ID       |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret   |
| `FRONTEND_URL`         | Frontend application URL     |
| `RESEND_API_KEY`       | Resend email API key         |
| `PORT`                 | Server port (default: 3001)  |

## Scripts

- `npm run start:dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run start:prod` - Start production server
- `npm run prisma:migrate` - Run database migrations
- `npm run prisma:studio` - Open Prisma Studio
- `npm run prisma:seed` - Seed database

## License

MIT
