# Auth0 Integration Setup

## Overview
Users who accept an invite will now be registered in Auth0. This allows you to manage user authentication and store interview data securely.

## Setup Steps

### 1. Create Auth0 Machine-to-Machine Application

1. Go to [Auth0 Dashboard](https://manage.auth0.com)
2. Navigate to **Applications** → **Create Application**
3. Select **Machine-to-Machine Applications**
4. Give it a name like "Accellor Backend"
5. Select **Auth0 Management API** as the API
6. Grant these scopes:
   - `create:users`
   - `read:users`
   - `update:users`

### 2. Get Your Credentials

After creating the M2M app, you'll find:
- **Domain**: Your Auth0 domain (e.g., `your-tenant.auth0.com`)
- **Client ID**: Your M2M application Client ID
- **Client Secret**: Your M2M application Client Secret

### 3. Add to Backend `.env` File

Add these variables to your backend `.env` file:

```env
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_MGMT_CLIENT_ID=your-client-id-here
AUTH0_MGMT_CLIENT_SECRET=your-client-secret-here
```

### 4. Configure Your Auth0 Application

In Auth0 Dashboard, configure your regular web application (the one used by your frontend):

**Settings:**
- Allowed Callback URLs: `http://localhost:5173, http://localhost:5173/callback`
- Allowed Logout URLs: `http://localhost:5173`
- Allowed Web Origins: `http://localhost:5173`

## User Flow

### Current Flow (Before)
1. Admin invites user → Creates record in Cosmos DB
2. User clicks link → Validates invite
3. User starts interview → Uses temporary session

### New Flow (After)
1. Admin invites user → Creates record in Cosmos DB
2. User clicks link → Validates invite + sees password input
3. User enters password → **User is created in Auth0** and Cosmos DB is updated with Auth0 user_id
4. User starts interview → Uses Auth0-managed account

## What Happens After Interview

When the interview completes, you can optionally update the Auth0 profile with:
- Interview score
- Completed date
- Interview results

Example:
```python
auth0.update_user(
    user_id=auth0_user_id,
    updates={
        "user_metadata": {
            "interview_score": 85,
            "interview_completed": "2026-02-05T12:00:00Z",
            "feedback": "Excellent technical knowledge"
        }
    }
)
```

## Database Changes

User records in Cosmos DB now include:
- `auth0_user_id`: The Auth0 user ID (e.g., `auth0|abc123xyz`)
- `auth0_email`: The email registered in Auth0
- `registered_at`: When the user was registered

## Environment Variables Required

Add these to your `.env` file before running the backend:

```env
AUTH0_DOMAIN=
AUTH0_MGMT_CLIENT_ID=
AUTH0_MGMT_CLIENT_SECRET=
```

If these are not configured, the system will:
- Log a warning but continue to work
- Skip Auth0 user creation
- Still create the user in Cosmos DB

## API Endpoints

### Register Invited User in Auth0

**POST** `/admin/register-invited-user`

Request:
```json
{
  "invite_code": "xyz123",
  "password": "secure-password-min-8-chars"
}
```

Response:
```json
{
  "success": true,
  "message": "User registered successfully",
  "user_id": "cosmos-user-id",
  "auth0_user_id": "auth0|abc123xyz"
}
```

## Troubleshooting

**Error: "Auth0 credentials not fully configured"**
- Make sure all three environment variables are set: `AUTH0_DOMAIN`, `AUTH0_MGMT_CLIENT_ID`, `AUTH0_MGMT_CLIENT_SECRET`

**Error: "User already exists"**
- If the user email already exists in Auth0, the system will find and use the existing user

**Error: "Invalid password"**
- Password must be at least 8 characters and meet Auth0's security requirements

## Security Notes

- Passwords are sent over HTTPS only
- Credentials are never logged
- Auth0 handles all password hashing and storage
- Access tokens are cached with automatic refresh
