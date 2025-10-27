# Example: Email Workflow

This example demonstrates how to create a simple email onboarding workflow that:
1. Sends a welcome email immediately when a user signs up
2. Sends a follow-up email 24 hours later

## Setup

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# Run the example
npm run example:email
```

## What This Example Shows

1. **Creating a workflow** with multiple timed actions
2. **Triggering the workflow** when a user signs up
3. **Handling workflow callbacks** in your application
4. **Monitoring execution status**

## Code Walkthrough

### 1. Define the Workflow

```typescript
import { createWorkflowClient } from '../../src/client/WorkflowClient';

const client = createWorkflowClient({
  supabaseUrl: process.env.SUPABASE_URL!,
  supabaseKey: process.env.SUPABASE_SERVICE_KEY!,
  organizationId: 'your-org-id',
});

// Create the workflow
const workflow = await client.createWorkflow({
  name: 'User Onboarding Emails',
  description: 'Send welcome and follow-up emails to new users',
  trigger: 'user_created',
  phase: 'after',
  interval: 0, // Start immediately after user creation
  actions: [
    {
      action_type: 'send_email',
      target_endpoint: '/api/send-email',
      payload: {
        template: 'welcome',
        subject: 'Welcome to Our App!',
      },
      order: 1,
    },
    {
      action_type: 'send_email',
      target_endpoint: '/api/send-email',
      payload: {
        template: 'follow_up',
        subject: 'Getting Started Guide',
        delay_hours: 24,
      },
      order: 2,
    },
  ],
});
```

### 2. Trigger the Workflow

```typescript
// When a user signs up
async function handleUserSignup(userId: string) {
  // Create user in database
  const user = await createUser({ id: userId, ...userData });

  // Execute the workflow
  await client.executeWorkflow({
    workflowId: workflow.id,
    triggerData: {
      related_table: 'users',
      related_table_pkey: user.id,
      meta: {
        user_email: user.email,
        user_name: user.name,
      },
    },
  });

  console.log('Workflow triggered for user:', userId);
}
```

### 3. Handle Workflow Callbacks

```typescript
// In your Next.js API route: /api/workflow-cron
export default async function handler(req: Request) {
  const {
    workflow_id,
    workflow_action_id,
    payload,
    meta,
    id: logId,
  } = req.body;

  try {
    // Extract user data from meta
    const { user_email, user_name } = meta;

    // Send email based on payload
    if (payload.template === 'welcome') {
      await sendEmail({
        to: user_email,
        subject: payload.subject,
        template: 'welcome',
        data: { name: user_name },
      });
    } else if (payload.template === 'follow_up') {
      await sendEmail({
        to: user_email,
        subject: payload.subject,
        template: 'getting-started',
        data: { name: user_name },
      });
    }

    // Mark as completed
    await supabase
      .from('workflow_action_logs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', logId);

    return Response.json({ success: true });
  } catch (error) {
    // Mark as failed for retry
    await supabase
      .from('workflow_action_logs')
      .update({
        status: 'failed',
        error_message: error.message,
      })
      .eq('id', logId);

    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
```

### 4. Monitor Execution

```typescript
// Check workflow status for a specific user
const status = await client.getExecutionStatus('users', userId);

console.log('Workflow execution status:', {
  workflow: status[0]?.workflow.name,
  actions: status.map((s) => ({
    action: s.action.action_type,
    status: s.log.status,
    executed_at: s.log.started_at,
    completed_at: s.log.completed_at,
  })),
});

// Get failed actions across all workflows
const failed = await client.getFailedActions();
console.log(`${failed.length} actions need attention`);

// Retry a failed action
if (failed.length > 0) {
  await client.retryAction(failed[0].id);
  console.log('Retrying failed action');
}
```

## Expected Flow

```
User Signs Up
  ↓
[Immediate] Welcome email sent
  ↓
[Wait 24 hours]
  ↓
Follow-up email sent
```

## Testing

```bash
# Run the example
npm run example:email

# You should see:
# ✓ Workflow created: user-onboarding-emails
# ✓ User created: user-123
# ✓ Workflow triggered
# ✓ Welcome email queued (executes immediately)
# ✓ Follow-up email queued (executes in 24h)
```

## Next Steps

- Add more email templates
- Implement email tracking (opens, clicks)
- Add conditional logic (send different emails based on user segment)
- Integrate with SendGrid, Resend, or your email provider

## Real-World Enhancements

```typescript
// Add conditions to actions
{
  action_type: 'send_email',
  payload: {
    template: 'premium_welcome'
  },
  condition: {
    field: 'meta.subscription_tier',
    operator: 'equals',
    value: 'premium'
  }
}

// Create different workflows per user segment
if (user.is_enterprise) {
  await client.executeWorkflow({ workflowId: enterpriseOnboardingWorkflow.id, ... });
} else {
  await client.executeWorkflow({ workflowId: standardOnboardingWorkflow.id, ... });
}
```

## Troubleshooting

**Emails not sending?**
1. Check that pg_cron is running: `SELECT * FROM cron.job;`
2. Verify webhook endpoint is accessible
3. Check workflow_action_logs for errors

**Workflow not triggering?**
1. Ensure workflow is active: `is_active = true`
2. Ensure workflow is not paused: `is_paused = false`
3. Check `execute_at` timestamp is in the past

**Retries not working?**
1. Check `tries` count in workflow_action_logs
2. Default max retries is 5
3. Backoff formula: `2^tries` minutes

## Production Checklist

- [ ] Set up monitoring/alerting for failed workflows
- [ ] Configure rate limiting on email sending
- [ ] Implement idempotency keys to prevent duplicate emails
- [ ] Add email unsubscribe handling
- [ ] Set up log retention policy
- [ ] Test retry logic with temporary failures
- [ ] Document custom error codes
- [ ] Add observability (DataDog, Sentry, etc.)

---

This example is a starting point. See [WORKFLOW_PATTERNS.md](../../docs/WORKFLOW_PATTERNS.md) for more advanced patterns.
