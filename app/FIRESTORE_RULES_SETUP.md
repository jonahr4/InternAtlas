# Firestore Security Rules Setup

## Quick Fix for Permission Errors

You're getting "Missing or insufficient permissions" errors because Firestore security rules need to be configured.

### Option 1: Deploy Rules via Firebase CLI (Recommended)

1. **Install Firebase CLI** (if not already installed):
   ```bash
   npm install -g firebase-tools
   ```

2. **Login to Firebase**:
   ```bash
   firebase login
   ```

3. **Initialize Firebase in your project** (if not already done):
   ```bash
   firebase init firestore
   ```
   - Select your Firebase project
   - Accept default files (firestore.rules, firestore.indexes.json)

4. **Deploy the rules**:
   ```bash
   firebase deploy --only firestore:rules
   ```

### Option 2: Manually Update in Firebase Console (Fastest)

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Click **Firestore Database** in the left sidebar
4. Click the **Rules** tab at the top
5. Replace the existing rules with the content from `firestore.rules`
6. Click **Publish**

### What These Rules Do

- **customTables**: Users can only access their own custom tables
- **trackedJobs**: Users can only access their own tracked jobs (to_apply and applied lists)
- All reads/writes require authentication
- Users can only access data where `userId` matches their auth UID

### Firestore Indexes (Optional but Recommended)

For better performance, create these indexes in the Firebase Console:

**Collection: `trackedJobs`**
- Fields indexed: `userId` (Ascending), `createdAt` (Descending)
- Query scope: Collection

**Collection: `customTables`**
- Fields indexed: `userId` (Ascending), `createdAt` (Descending)  
- Query scope: Collection

Or wait for Firebase to prompt you with auto-generated index links when you first query.

### Testing

After deploying the rules, test by:
1. Signing in to your app
2. Going to `/tracking` 
3. The page should load without permission errors
4. Try adding jobs from the main board using "Select Jobs" → "Add to To Apply"

### Troubleshooting

If you still get errors:
- Verify you're signed in (check browser console for auth state)
- Check that `userId` in Firestore documents matches the authenticated user's UID
- Ensure the Firebase project in your `.env` matches the console project
