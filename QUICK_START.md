# Auth0 Integration - Quick Start Checklist ✅

## Pre-Launch Checklist

### 1. Auth0 Account & Application Setup ☐

- [ ] Create/verify Auth0 account at https://auth0.com
- [ ] Create new Single Page Application (SPA)
- [ ] Note down:
  - `VITE_AUTH0_DOMAIN` (e.g., `your-tenant.auth0.com`)
  - `VITE_AUTH0_CLIENT_ID` (from Application settings)
  - `VITE_AUTH0_AUDIENCE` (from API settings, e.g., `https://api.yourapp.com`)

### 2. Frontend Environment Setup ☐

Create `frontend/.env.local`:
```env
VITE_AUTH0_DOMAIN=your-tenant.auth0.com
VITE_AUTH0_CLIENT_ID=your_client_id
VITE_AUTH0_AUDIENCE=https://api.yourapp.com
VITE_API_URL=http://localhost:8000
VITE_AZURE_AUTHORITY=https://login.microsoftonline.com/f8300747-02c3-470c-a3d6-5a3355e3d77d
VITE_AZURE_CLIENT_ID=your_azure_client_id
```

### 3. Backend Environment Setup ☐

Create/update `backend/.env`:
```env
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_AUDIENCE=https://api.yourapp.com
JWT_SECRET_KEY=your-jwt-secret-key-change-this
VITE_AZURE_AUTHORITY=https://login.microsoftonline.com/f8300747-02c3-470c-a3d6-5a3355e3d77d
```

### 4. Auth0 Dashboard Configuration ☐

In Auth0 Console → Applications → Your App Settings:

- [ ] **Allowed Callback URLs:**
  ```
  http://localhost:5173/callback
  ```
  (Production: `https://yourdomain.com/callback`)

- [ ] **Allowed Logout URLs:**
  ```
  http://localhost:5173/login
  ```
  (Production: `https://yourdomain.com/login`)

- [ ] **Allowed Web Origins:**
  ```
  http://localhost:5173
  ```
  (Production: `https://yourdomain.com`)

- [ ] **Allowed Cross-Origin Authentication URLs:**
  ```
  http://localhost:5173
  ```
  (Production: `https://yourdomain.com`)

### 5. Auth0 API Configuration ☐

In Auth0 Console → Applications → APIs:

- [ ] Create API with identifier: `https://api.yourapp.com` (or your choice)
- [ ] Note the identifier - use as `VITE_AUTH0_AUDIENCE`
- [ ] Machine-to-Machine (M2M) auth should be disabled for SPA

### 6. Install Dependencies ☐

```bash
# Frontend
cd frontend
npm install @auth0/auth0-react

# Backend
cd backend
pip install -r requirements.txt
# Ensure PyJWT is installed: pip install PyJWT
```

### 7. Start Services ☐

```bash
# Terminal 1: Backend
cd backend
python -m uvicorn main:app --reload --port 8000

# Terminal 2: Frontend
cd frontend
npm run dev
# Opens at http://localhost:5173
```

### 8. Test Login Flow ☐

1. [ ] Navigate to http://localhost:5173
2. [ ] Click "Sign In" button
3. [ ] Redirected to Auth0 Universal Login page
4. [ ] Enter test credentials or create test user
5. [ ] After login, redirected back to app
6. [ ] Check user role based on email domain:
   - [ ] @accellor.com → Admin Dashboard
   - [ ] Other → Welcome Screen

### 9. Test Logout Flow ☐

1. [ ] Click user profile menu (top right)
2. [ ] Click "Logout"
3. [ ] Redirected to login page
4. [ ] Browser storage cleared
5. [ ] Session cleared from Auth0

### 10. Test API Calls ☐

1. [ ] Navigate to a protected feature (Interview, Results, etc.)
2. [ ] Verify API calls include `Authorization: Bearer <token>`
3. [ ] Backend correctly validates token and returns data
4. [ ] Check browser DevTools → Network tab for bearer token

## Files Created

```
frontend/
├── src/
│   ├── utils/
│   │   └── auth0Config.js (NEW)
│   ├── hooks/
│   │   ├── useAuth.js (NEW)
│   │   ├── useAuthToken.js (NEW)
│   │   └── useAuthFetch.js (NEW)
│   ├── components/
│   │   ├── ProtectedRoute.jsx (NEW)
│   │   └── screens/
│   │       └── CallbackPage.jsx (NEW)
│   ├── App.jsx (UPDATED)
│   ├── main.jsx (UPDATED)
│   └── components/
│       └── ScreenManager.jsx (UPDATED)

backend/
├── auth/
│   └── routes.py (UPDATED)
└── requirements.txt (UPDATED)
```

## Files Updated

- `frontend/src/App.jsx` - Added Auth0 hooks, ProtectedRoute
- `frontend/src/main.jsx` - Wrapped with Auth0ProviderComponent
- `frontend/src/components/ScreenManager.jsx` - Added callback route
- `frontend/src/components/screens/LoginScreen.jsx` - Auth0 only
- `frontend/src/components/ProfileMenu.jsx` - Auth0 logout
- `frontend/src/components/screens/AdminDashboardScreen.jsx` - Auth0 logout
- `backend/auth/routes.py` - Added JWT imports
- `backend/requirements.txt` - Added PyJWT

## Key Features

✅ Authorization Code Flow with PKCE
✅ Memory-only token storage (secure)
✅ Auth0 Universal Login
✅ Admin routing for @accellor.com users
✅ Protected API endpoints with token validation
✅ Automatic token refresh (if enabled)
✅ Session management and logout

## Common Issues & Solutions

### Issue: "Auth0 environment variables not configured"
**Solution:** 
- Ensure `frontend/.env.local` exists
- Restart frontend dev server: `npm run dev`
- Check variables are correctly copied

### Issue: Redirect loop on callback
**Solution:**
- Verify callback URL in Auth0 dashboard matches exactly
- Clear browser cookies: DevTools → Application → Cookies → Delete
- Restart both frontend and backend

### Issue: API returns 401 Unauthorized
**Solution:**
- Ensure backend `.env` has `AUTH0_DOMAIN` and `AUTH0_AUDIENCE`
- Verify endpoint uses `Depends(get_current_user)`
- Check token is being sent: DevTools → Network → Request Headers

### Issue: Profile picture not loading
**Solution:**
- Auth0 may not have profile picture - it's optional
- Check user profile in Auth0 dashboard
- Set default avatar in app UI

## Production Deployment

Before deploying to production:

1. [ ] Update Auth0 callback URLs to production domain
2. [ ] Update `VITE_API_URL` to production backend URL
3. [ ] Use environment-specific .env files
4. [ ] Enable HTTPS everywhere
5. [ ] Set `secure=true` on cookies (backend)
6. [ ] Configure CORS properly for production domain
7. [ ] Test complete flow in staging environment
8. [ ] Enable Auth0 email verification if required
9. [ ] Configure MFA if needed for @accellor.com users
10. [ ] Set up Auth0 rules/actions for custom logic

## Support & Documentation

- Auth0 Docs: https://auth0.com/docs
- Auth0 React SDK: https://github.com/auth0/auth0-react
- This implementation guide: See `AUTH0_MIGRATION_COMPLETE.md`

## Status

🎉 **Auth0 integration is COMPLETE and ready for testing!**

All frontend and backend changes have been applied. Follow the checklist above to get the app running with Auth0 authentication.

Questions? Check:
1. Browser DevTools → Console for error messages
2. Auth0 Dashboard → Logs for authentication events
3. Backend logs for API validation errors
4. AUTH0_MIGRATION_COMPLETE.md for detailed docs
