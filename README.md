# ContractHub

ContractHub is a full-stack application for managing contracts and agreements with ease.  
It provides teams with tools for collaboration, reminders, and streamlined workflows around agreements.

---

## 🚀 Features

- **Authentication & Authorization**
  - User sign-up, sign-in, and secure session management.
  - Role-based access for team members (e.g., Owner, Admin, Member).

- **Team Management**
  - Invite and manage team members.
  - Assign roles and track invitation status.
  - Delete and update team members.

- **Agreements**
  - Create, update, and delete agreements.
  - Track renewal frequency (`30/60/90 days reminders`).
  - Daily digest and optional scheduled notifications.

- **Frontend**
  - Modern, responsive UI built with **Next.js + Tailwind CSS**.
  - Navigation bar, landing page, marketing pages, and protected dashboard.

- **Backend**
  - Secure API routes for CRUD operations on agreements and team members.
  - Supabase integration for database management.
  - Validation and error handling for all endpoints.

- **Notifications**
  - Automated email reminders for contract renewals (30/60/90-day intervals).
  - Daily digest option to summarize agreements for yourself or your team.

---

## 🛠 Tech Stack

- **Frontend**
  - [Next.js 14](https://nextjs.org/) (App Router, Server & Client Components)
  - [Tailwind CSS](https://tailwindcss.com/) for styling
  - [shadcn/ui](https://ui.shadcn.com/) for UI components

- **Backend**
  - [Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/router-handlers)
  - [Supabase](https://supabase.com/) (Postgres DB + Admin Client)
  - [Node.js](https://nodejs.org/) runtime

- **Other**
  - Cron jobs for scheduled reminders
  - TypeScript for type safety

---

## Getting Started

### 1. Clone the Repository

### 2. Install Dependancies 
``` npm install ```

### 3. Paste .env.local file at root

### 4. Run dev server
Open http://localhost:3000 in your browser.










