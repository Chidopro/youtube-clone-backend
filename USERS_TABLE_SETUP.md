# Users Table Setup Guide

This guide will help you set up the `users` table in your Supabase database and integrate it with your ScreenMerch application.

## 🗄️ Database Setup

### 1. Create the Users Table

1. Go to your Supabase dashboard
2. Navigate to the SQL Editor
3. Copy and paste the contents of `database_setup.sql` into the editor
4. Run the script

This will create:
- A `users` table with all necessary fields
- Indexes for better performance
- Row Level Security (RLS) policies
- Automatic timestamp updates

### 2. Create Storage Bucket (Optional)

If you want to use profile image uploads:

1. Go to Storage in your Supabase dashboard
2. Create a new bucket called `avatars`
3. Set the bucket to public
4. Configure RLS policies for the bucket

## 📁 Files Created

### `database_setup.sql`
Contains the complete SQL script to create the users table with:
- UUID primary key
- Email (unique)
- Display name
- Profile and cover image URLs
- Bio field
- Timestamps
- RLS policies

### `src/utils/userService.js`
A service class with methods for:
- Getting current user profile
- Creating/updating user profiles
- Uploading profile images
- Deleting profile images
- Getting public user profiles

### `src/hooks/useUser.js`
A React hook that provides:
- User authentication state
- Profile data
- Loading states
- Error handling
- Profile update functions
- Image upload/delete functions

## 🚀 Usage Examples

### Basic Usage in React Components

```jsx
import { useUser } from '../hooks/useUser';

function ProfileComponent() {
  const { user, profile, loading, updateProfile, uploadProfileImage } = useUser();

  if (loading) return <div>Loading...</div>;
  if (!user) return <div>Please sign in</div>;

  const handleUpdateProfile = async () => {
    const result = await updateProfile({
      display_name: 'New Display Name',
      bio: 'My new bio'
    });
    
    if (result.success) {
      console.log('Profile updated!');
    }
  };

  const handleImageUpload = async (file) => {
    const result = await uploadProfileImage(file);
    if (result.success) {
      console.log('Image uploaded!');
    }
  };

  return (
    <div>
      <h1>Welcome, {profile?.display_name || user.email}</h1>
      <p>{profile?.bio || 'No bio yet'}</p>
      {profile?.profile_image_url && (
        <img src={profile.profile_image_url} alt="Profile" />
      )}
      <button onClick={handleUpdateProfile}>Update Profile</button>
    </div>
  );
}
```

### Direct Service Usage

```jsx
import { UserService } from '../utils/userService';

// Get current user profile
const profile = await UserService.getCurrentUserProfile();

// Update profile
const updatedProfile = await UserService.updateUserProfile({
  display_name: 'New Name',
  bio: 'New bio'
});

// Upload profile image
const fileInput = document.getElementById('profile-image');
const imageUrl = await UserService.uploadProfileImage(fileInput.files[0]);

// Get public user profile
const publicProfile = await UserService.getUserProfileById('user-uuid');
```

## 🔐 Row Level Security (RLS)

The table includes RLS policies that ensure:
- Users can only read their own profile
- Users can only update their own profile
- Users can only insert their own profile
- Public read access can be enabled if needed

## 📊 Table Schema

```sql
CREATE TABLE users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(100),
    profile_image_url TEXT,
    cover_image_url TEXT,
    bio TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## 🔧 Environment Variables

Make sure your `.env` file includes:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 🎯 Next Steps

1. Run the database setup script
2. Test the user service functions
3. Integrate the `useUser` hook into your components
4. Add profile management UI to your app
5. Set up image upload functionality (optional)

## 🐛 Troubleshooting

### Common Issues

1. **RLS Policy Errors**: Make sure you're authenticated when accessing the users table
2. **Image Upload Failures**: Verify the `avatars` bucket exists and is public
3. **Profile Not Found**: Check that the user ID matches between auth and the users table

### Debug Tips

- Check the browser console for detailed error messages
- Use Supabase dashboard to inspect table data
- Verify RLS policies are working correctly
- Test with a simple profile update first

## 📝 Notes

- The `users` table is separate from Supabase's built-in `auth.users` table
- This design allows for custom profile fields while maintaining auth integration
- All timestamps are automatically managed
- The service includes comprehensive error handling
- The hook provides real-time auth state updates 