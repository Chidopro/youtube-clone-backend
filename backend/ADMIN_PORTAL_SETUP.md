# Admin Portal Setup Guide

This guide will help you set up and configure the admin portal for your ScreenMerch application.

## 🚀 Quick Start

### 1. Database Setup

First, run the admin database setup script in your Supabase SQL Editor:

1. Go to your Supabase dashboard
2. Navigate to the SQL Editor
3. Copy and paste the contents of `database_admin_setup.sql`
4. Run the script

This will create:
- Admin role columns in the users table
- Admin logs table for tracking actions
- Admin settings table for configuration
- Database functions for admin operations
- Updated RLS policies for admin access

### 2. Set Up Admin Users

After running the database script, you need to designate admin users. You can do this in two ways:

#### Option A: Update via SQL (Recommended)
```sql
-- Replace 'your-email@example.com' with the actual admin email
UPDATE users SET is_admin = true WHERE email = 'your-email@example.com';
```

#### Option B: Update via Supabase Dashboard
1. Go to your Supabase dashboard
2. Navigate to Table Editor > users
3. Find your user record
4. Set `is_admin` to `true`

### 3. Access the Admin Portal

Once set up, you can access the admin portal at:
```
http://localhost:5174/admin
```

## 🔧 Features

### Dashboard
- **Statistics Overview**: View total users, videos, subscriptions, and pending approvals
- **Recent Activity**: Monitor recent admin actions and user activities
- **Quick Actions**: Access common admin functions

### User Management
- **View All Users**: See all registered users with their details
- **Search & Filter**: Find users by name, email, or status
- **User Actions**:
  - Suspend/Activate users
  - Delete user accounts
  - View user profiles

### Content Moderation
- **Video Management**: Review and moderate uploaded videos
- **Status Updates**: Approve, reject, or delete videos
- **Bulk Operations**: Perform actions on multiple videos

### Subscription Management
- **View Subscriptions**: Monitor all user subscriptions
- **Tier Analysis**: Track subscription tier distribution
- **Status Monitoring**: Monitor active, canceled, and past due subscriptions

### System Settings
- **Admin Configuration**: Manage admin email addresses
- **System Parameters**: Configure video size limits, auto-approval settings
- **Maintenance Mode**: Enable/disable maintenance mode

## 🔐 Security Features

### Role-Based Access Control
- Only users with `is_admin = true` can access the admin portal
- All admin actions are logged for audit purposes
- RLS policies ensure data security

### Action Logging
- All admin actions are automatically logged
- Logs include:
  - Admin user who performed the action
  - Action type and target
  - Timestamp and details
  - IP address and user agent

### Secure Operations
- Confirmation dialogs for destructive actions
- Error handling and user feedback
- Input validation and sanitization

## 📊 Admin Service API

The admin portal uses the `AdminService` class for all operations:

```javascript
import { AdminService } from '../utils/adminService';

// Check if user is admin
const isAdmin = await AdminService.isAdmin();

// Get dashboard statistics
const stats = await AdminService.getDashboardStats();

// Manage users
const users = await AdminService.getUsers(page, limit, search, status);
const result = await AdminService.updateUserStatus(userId, 'suspended');

// Manage videos
const videos = await AdminService.getVideos(page, limit, search, status);
const result = await AdminService.updateVideoStatus(videoId, 'approved');

// System settings
const settings = await AdminService.getAdminSettings();
const result = await AdminService.updateAdminSetting('setting_key', 'value');
```

## 🎨 Customization

### Styling
The admin portal uses a modern, responsive design. You can customize the appearance by modifying:
- `src/Pages/Admin/Admin.css` - Main styles
- Color scheme and branding
- Layout and spacing

### Adding New Features
To add new admin features:

1. **Database**: Add new tables/columns as needed
2. **Service**: Extend `AdminService` with new methods
3. **UI**: Add new tabs and components to `Admin.jsx`
4. **Logging**: Ensure new actions are logged

### Admin Settings
Configure system-wide settings in the admin_settings table:

```sql
-- Example: Update admin emails
UPDATE admin_settings 
SET setting_value = 'admin1@example.com,admin2@example.com' 
WHERE setting_key = 'admin_emails';

-- Example: Enable auto-approval
UPDATE admin_settings 
SET setting_value = 'true' 
WHERE setting_key = 'auto_approve_videos';
```

## 🚨 Troubleshooting

### Common Issues

#### "Access denied" error
- Ensure the user has `is_admin = true` in the database
- Check that the user is properly authenticated
- Verify RLS policies are correctly set

#### Database functions not working
- Ensure all SQL functions from `database_admin_setup.sql` are created
- Check that the user has proper permissions
- Verify function parameters match the expected types

#### Admin actions not logging
- Check that the `admin_logs` table exists
- Verify the `log_admin_action` function is working
- Ensure RLS policies allow admin users to insert logs

### Debug Mode
Enable debug logging by adding to your browser console:
```javascript
localStorage.setItem('admin_debug', 'true');
```

## 📈 Monitoring and Analytics

### Admin Logs
Monitor admin activity through the logs table:
```sql
-- View recent admin actions
SELECT * FROM admin_logs 
ORDER BY created_at DESC 
LIMIT 50;

-- View actions by admin user
SELECT admin_user_id, action_type, COUNT(*) 
FROM admin_logs 
GROUP BY admin_user_id, action_type;
```

### Performance Monitoring
- Monitor database query performance
- Track admin portal usage
- Monitor error rates and response times

## 🔄 Maintenance

### Regular Tasks
- Review admin logs for suspicious activity
- Update admin email addresses as needed
- Monitor system settings and performance
- Backup admin configuration

### Updates
- Keep the admin portal code updated
- Monitor for security patches
- Test new features in development first

## 📞 Support

For issues or questions about the admin portal:
1. Check the troubleshooting section above
2. Review the admin logs for error details
3. Verify database setup and permissions
4. Test with a fresh admin user account

## 🔒 Security Best Practices

1. **Limit Admin Access**: Only grant admin privileges to trusted users
2. **Regular Audits**: Review admin logs regularly
3. **Strong Authentication**: Ensure admin users have strong passwords
4. **Session Management**: Implement proper session timeouts
5. **Backup Logs**: Regularly backup admin logs for audit purposes
6. **Monitor Access**: Set up alerts for unusual admin activity

---

**Note**: This admin portal is designed for internal use. Ensure proper security measures are in place before deploying to production. 