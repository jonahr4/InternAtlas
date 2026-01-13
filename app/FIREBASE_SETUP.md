# Firebase Setup for Custom Tables

## Firestore Security Rules

Add these rules to your Firebase Console → Firestore Database → Rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Custom Tables - users can only access their own tables
    match /customTables/{tableId} {
      allow read: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
      allow update, delete: if request.auth != null && request.auth.uid == resource.data.userId;
    }
  }
}
```

## Firestore Indexes

These composite indexes may be required. Add them in Firebase Console → Firestore Database → Indexes:

1. **customTables Collection**
   - userId (Ascending)
   - createdAt (Descending)

The Firebase Console will prompt you to create these indexes when you first run queries that need them.

## Custom Tables Data Structure

```typescript
{
  id: string;                    // Auto-generated document ID
  userId: string;                 // Firebase Auth UID
  name: string;                   // User-defined table name
  titleKeywords: string[];        // Job title filter keywords
  locationKeywords: string[];     // Location filter keywords
  companyFilter: string;          // Company name filter
  selectedPlatforms: string[];    // ATS platforms (GREENHOUSE, LEVER, etc.)
  lastSeenAt: Timestamp | null;   // Last time user marked table as "seen"
  newJobCount: number;            // Count of jobs added since lastSeenAt
  createdAt: Timestamp;           // Table creation time
  updatedAt: Timestamp;           // Last modification time
}
```

## Features Implemented

✅ Create custom job tables with filters
✅ Firebase Firestore integration for data persistence
✅ Left sidebar navigation between tables
✅ Locked/unlocked filter editing
✅ "Mark as Seen" functionality with NEW badges
✅ Real-time job fetching with table filters
✅ Editable table names
✅ Job detail panel
✅ Responsive mobile design

## Email Notifications (Coming Soon)

The "Email Alerts" button is currently disabled and ready for future implementation.
