# DEPLOYMENT.md

## Firebase App Hosting Deployment Guide

This guide describes how to deploy the RCLPortal Next.js app to Firebase App Hosting with secure environment variables using Google Secret Manager.

---

### 1. Prerequisites
- Access to your Firebase project and Google Cloud Console.
- Firebase CLI installed and authenticated (`firebase login`).

---

### 2. Create Secrets in Google Secret Manager
Go to [Google Cloud Secret Manager](https://console.cloud.google.com/security/secret-manager) and create these secrets:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `DBMID_API_KEY`
- `NEXTAUTH_SECRET`

For each secret, use the correct value from your Supabase dashboard or local `.env.local` file. **Do not share secret values in documentation.**

---

### 3. Grant Secret Access to App Hosting Backend
Run these commands in your project directory:

```powershell
firebase apphosting:secrets:grantaccess SUPABASE_URL --backend rcl-portal
firebase apphosting:secrets:grantaccess SUPABASE_ANON_KEY --backend rcl-portal
firebase apphosting:secrets:grantaccess DBMID_API_KEY --backend rcl-portal
firebase apphosting:secrets:grantaccess NEXTAUTH_SECRET --backend rcl-portal
```

---

### 4. Configure `apphosting.yaml`
Your `apphosting.yaml` should look like:

```yaml
env:
  - variable: NEXT_PUBLIC_SUPABASE_URL
    secret: SUPABASE_URL
  - variable: NEXT_PUBLIC_SUPABASE_ANON_KEY
    secret: SUPABASE_ANON_KEY
  - variable: NEXT_PUBLIC_DBMID_API_KEY
    secret: DBMID_API_KEY
  - variable: NEXT_PUBLIC_MEMBERSHIP_CUTOFF_DATE
    value: 2025-11-09T20:25:53.000Z
  - variable: NEXT_PUBLIC_REGISTRATION_FEE
    value: 800
  - variable: NEXTAUTH_SECRET
    secret: NEXTAUTH_SECRET
  - variable: NEXTAUTH_URL
    value: https://your-production-url.org
```

---

### 5. Build Locally (Optional)
```powershell
npm install
npm run build
```

---

### 6. Deploy to Firebase
```powershell
firebase deploy
```

---

### 7. Post-Deployment
- Visit your deployed site (Firebase will show the URL).
- Check logs in Firebase Console for errors.
- Test authentication and Supabase API calls.

---

**Note:**
Never share secret values in documentation or code. Only reference the secret names.

---

You can share this file with your team for future deployments.
