# Admin Dashboard Design - Coach Application Review

## Overview
Admin dashboard for reviewing and managing coach applications with list view, filtering, detailed review, and approval/rejection workflows.

## User Flow

### 1. Admin Login
- Admins access `/admin/applications` (requires admin role)
- Redirected to login if not authenticated
- Redirected to 403 if authenticated but not admin

### 2. Applications List View
**Layout:**
- Header with title "Coach Applications" and stats cards
- Filter bar (status dropdown, search input)
- Table with columns:
  - Name
  - Email
  - Chess Title
  - Rating
  - Status badge
  - Submitted date
  - Actions (View Details button)

**Stats Cards:**
- Pending: Count of pending applications
- Under Review: Count of under_review applications
- Approved (Last 30 days): Count of recently approved
- Rejected (Last 30 days): Count of recently rejected

**Filtering:**
- Status dropdown: All, Pending, Under Review, Approved, Rejected
- Search: Filter by name or email (client-side)
- Sort: By submission date (newest first)

### 3. Application Detail View
**Modal/Slide-over with tabs:**

**Tab 1: Overview**
- Personal Info (name, email, phone, location, timezone)
- Chess Credentials (title, rating, org, experience years, total students)
- Status badge and timeline

**Tab 2: Expertise**
- Certifications
- Achievements (full text)
- Specializations (badges)
- Target Levels (badges)
- Teaching Philosophy (full text)

**Tab 3: Availability & Pricing**
- Hourly rate with market comparison
- Weekly availability grid (visual)
- Lesson formats (badges)
- Languages (badges)

**Tab 4: Teaching Approach**
- Professional bio (full text)
- Why BooGMe (full text)
- Sample lesson description (full text)
- Video intro (if provided)

**Tab 5: Review & Decision**
- Current status
- Review notes (textarea for admin)
- Action buttons:
  - Mark as Under Review
  - Approve Application
  - Reject Application
  - Save Notes

### 4. Approval Workflow
**When admin clicks "Approve":**
1. Show confirmation modal with review notes
2. On confirm:
   - Update application status to "approved"
   - Save review notes and reviewer ID
   - Create coach profile in database
   - Send approval email to applicant (TODO)
   - Show success toast
   - Refresh list

### 5. Rejection Workflow
**When admin clicks "Reject":**
1. Show modal requiring rejection reason
2. On confirm:
   - Update application status to "rejected"
   - Save rejection reason and reviewer ID
   - Send rejection email with feedback (TODO)
   - Show success toast
   - Refresh list

## UI Components

### AdminApplicationsList
- Fetches all applications via tRPC
- Displays table with filtering/search
- Opens detail modal on row click

### ApplicationDetailModal
- Receives application ID as prop
- Fetches full application details
- Tabbed interface for organized viewing
- Action buttons for status changes

### StatusBadge
- Color-coded badges:
  - Pending: Yellow
  - Under Review: Blue
  - Approved: Green
  - Rejected: Red
  - Withdrawn: Gray

### ApplicationStats
- Four stat cards showing counts
- Real-time updates after actions

## Backend API Endpoints

### `admin.applications.list`
- Returns all applications with basic info
- Supports optional status filter
- Sorted by createdAt desc

### `admin.applications.getById`
- Returns full application details by ID
- Includes all form data

### `admin.applications.updateStatus`
- Input: applicationId, status, reviewNotes
- Updates status, sets reviewedBy and reviewedAt
- Returns success

### `admin.applications.approve`
- Input: applicationId, reviewNotes
- Updates status to "approved"
- Creates coach profile
- Links application to profile
- Returns success with profileId

### `admin.applications.reject`
- Input: applicationId, reviewNotes (required)
- Updates status to "rejected"
- Returns success

## Authorization

### Admin Middleware (adminProcedure)
```typescript
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
  }
  return next({ ctx });
});
```

### Route Protection
- All admin.* procedures use adminProcedure
- Frontend checks user.role before rendering admin UI
- Redirect non-admins to 403 page

## Data Flow

1. Admin navigates to `/admin/applications`
2. Component checks if user.role === 'admin'
3. If not admin, show 403 error
4. If admin, fetch applications list
5. Display table with filters
6. On row click, open detail modal
7. Admin reviews application in tabs
8. Admin clicks Approve/Reject
9. Confirmation modal appears
10. On confirm, API call updates status
11. Success toast shown
12. List refreshes with updated data

## Design Tokens

**Colors:**
- Pending: bg-yellow-500/10 text-yellow-700
- Under Review: bg-blue-500/10 text-blue-700
- Approved: bg-green-500/10 text-green-700
- Rejected: bg-red-500/10 text-red-700

**Spacing:**
- Table row height: 64px
- Modal width: 900px (max-w-4xl)
- Tab padding: 24px

**Typography:**
- Table headers: text-sm font-semibold
- Table cells: text-sm
- Section headers: text-lg font-semibold
- Body text: text-sm
