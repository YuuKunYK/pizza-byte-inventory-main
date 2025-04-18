-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL, -- 'info', 'success', 'warning', 'error'
  related_to TEXT NOT NULL, -- The entity type this notification is related to (e.g., 'stock_request')
  related_id UUID NOT NULL, -- The ID of the related entity
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Add indexes for common queries
  CONSTRAINT notifications_type_check CHECK (type IN ('info', 'success', 'warning', 'error'))
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON notifications (user_id);
CREATE INDEX IF NOT EXISTS notifications_is_read_idx ON notifications (is_read);
CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON notifications (created_at DESC);

-- Enable row-level security
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Policies
-- Users can only view their own notifications
CREATE POLICY notifications_select_policy ON notifications
  FOR SELECT USING (user_id = auth.uid());

-- Users can only update their own notifications (e.g., to mark as read)
CREATE POLICY notifications_update_policy ON notifications
  FOR UPDATE USING (user_id = auth.uid());

-- Users can only delete their own notifications
CREATE POLICY notifications_delete_policy ON notifications
  FOR DELETE USING (user_id = auth.uid());

-- Only the system and the user themselves can insert notifications for a user
CREATE POLICY notifications_insert_policy ON notifications
  FOR INSERT WITH CHECK (
    user_id = auth.uid() OR
    -- Allow admin role to insert notifications for any user
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Add realtime publication for notifications
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  
  CREATE PUBLICATION supabase_realtime FOR TABLE 
    notifications, 
    stock_requests;
COMMIT; 