# Inventory Management System

## User Login Information

For testing purposes, use the following credentials:

- **Email**: yousufkhatri2006@gmail.com
- **Password**: nyp123
- **Role**: Admin
- **Location**: Ocean Mall

## Setup Instructions

1. After cloning the repository, install dependencies:
   ```
   npm install
   ```

2. Start the development server:
   ```
   npm run dev
   ```

3. Note: For development purposes, you may want to disable email confirmation in the Supabase dashboard.

## Features

- User authentication (login/signup) with role-based access
- Inventory management
- Stock request handling
- Recipe management
- Branch and warehouse management
- Activity logging system for monitoring all changes
- Comprehensive activity logs with filtering and search capability

## Important Notes

- Admin users have access to all features
- Branch users can only manage their own inventory and make stock requests
- Warehouse users can fulfill stock requests and manage inventory
- All activities in the system are logged for auditability
- Activity logs track all create, update, delete operations on database records

## Activity Logging

The system automatically records the following activities:
- Inventory item creation, updates, and deletion
- Stock request creation, fulfillment, and rejection
- User management operations
- Stock entry changes with before and after state
- Recipe management operations

This provides a complete audit trail of all changes in the system with user attribution.

