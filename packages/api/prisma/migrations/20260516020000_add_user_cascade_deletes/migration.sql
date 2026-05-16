-- Add ON DELETE CASCADE to all User child relations that were missing it.
-- This prevents FK constraint errors when deleting a User row.

-- WorkspaceMember
ALTER TABLE "WorkspaceMember" DROP CONSTRAINT IF EXISTS "WorkspaceMember_userId_fkey";
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Agent
ALTER TABLE "Agent" DROP CONSTRAINT IF EXISTS "Agent_userId_fkey";
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- TestRun (cascade from both User and Agent)
ALTER TABLE "TestRun" DROP CONSTRAINT IF EXISTS "TestRun_userId_fkey";
ALTER TABLE "TestRun" ADD CONSTRAINT "TestRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TestRun" DROP CONSTRAINT IF EXISTS "TestRun_agentId_fkey";
ALTER TABLE "TestRun" ADD CONSTRAINT "TestRun_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Evaluation (cascade from TestRun)
ALTER TABLE "Evaluation" DROP CONSTRAINT IF EXISTS "Evaluation_testRunId_fkey";
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_testRunId_fkey" FOREIGN KEY ("testRunId") REFERENCES "TestRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Conversation
ALTER TABLE "Conversation" DROP CONSTRAINT IF EXISTS "Conversation_userId_fkey";
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- UserToken
ALTER TABLE "UserToken" DROP CONSTRAINT IF EXISTS "UserToken_userId_fkey";
ALTER TABLE "UserToken" ADD CONSTRAINT "UserToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Task
ALTER TABLE "Task" DROP CONSTRAINT IF EXISTS "Task_userId_fkey";
ALTER TABLE "Task" ADD CONSTRAINT "Task_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Note
ALTER TABLE "Note" DROP CONSTRAINT IF EXISTS "Note_userId_fkey";
ALTER TABLE "Note" ADD CONSTRAINT "Note_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Reminder
ALTER TABLE "Reminder" DROP CONSTRAINT IF EXISTS "Reminder_userId_fkey";
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Contact
ALTER TABLE "Contact" DROP CONSTRAINT IF EXISTS "Contact_userId_fkey";
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CalendarEvent
ALTER TABLE "CalendarEvent" DROP CONSTRAINT IF EXISTS "CalendarEvent_userId_fkey";
ALTER TABLE "CalendarEvent" ADD CONSTRAINT "CalendarEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AutomationConfig
ALTER TABLE "AutomationConfig" DROP CONSTRAINT IF EXISTS "AutomationConfig_userId_fkey";
ALTER TABLE "AutomationConfig" ADD CONSTRAINT "AutomationConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AgentLog
ALTER TABLE "AgentLog" DROP CONSTRAINT IF EXISTS "AgentLog_userId_fkey";
ALTER TABLE "AgentLog" ADD CONSTRAINT "AgentLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- EmailProcessingLog
ALTER TABLE "EmailProcessingLog" DROP CONSTRAINT IF EXISTS "EmailProcessingLog_userId_fkey";
ALTER TABLE "EmailProcessingLog" ADD CONSTRAINT "EmailProcessingLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Notification
ALTER TABLE "Notification" DROP CONSTRAINT IF EXISTS "Notification_userId_fkey";
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- PushSubscription
ALTER TABLE "PushSubscription" DROP CONSTRAINT IF EXISTS "PushSubscription_userId_fkey";
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Memory
ALTER TABLE "Memory" DROP CONSTRAINT IF EXISTS "Memory_userId_fkey";
ALTER TABLE "Memory" ADD CONSTRAINT "Memory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- TokenUsage
ALTER TABLE "TokenUsage" DROP CONSTRAINT IF EXISTS "TokenUsage_userId_fkey";
ALTER TABLE "TokenUsage" ADD CONSTRAINT "TokenUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- EmailMessage
ALTER TABLE "EmailMessage" DROP CONSTRAINT IF EXISTS "EmailMessage_userId_fkey";
ALTER TABLE "EmailMessage" ADD CONSTRAINT "EmailMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- EmailRule
ALTER TABLE "EmailRule" DROP CONSTRAINT IF EXISTS "EmailRule_userId_fkey";
ALTER TABLE "EmailRule" ADD CONSTRAINT "EmailRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
