# Workflow Patterns Guide

This document showcases common workflow patterns and real-world use cases for the Supabase Workflow Engine.

## Table of Contents
1. [Basic Patterns](#basic-patterns)
2. [Time-Based Patterns](#time-based-patterns)
3. [Multi-Step Workflows](#multi-step-workflows)
4. [Conditional Workflows](#conditional-workflows)
5. [Integration Patterns](#integration-patterns)
6. [Error Handling Patterns](#error-handling-patterns)

---

## Basic Patterns

### Pattern 1: Immediate Action

Execute an action immediately when an event occurs.

```typescript
const workflow = await client.createWorkflow({
  name: 'Send Welcome Email',
  trigger: 'user_created',
  phase: 'now',  // Execute immediately
  interval: 0,
  actions: [{
    action_type: 'send_email',
    payload: { template: 'welcome' },
  }],
});
```

**Use Cases:**
- Welcome emails
- Slack notifications
- Webhook notifications to external systems

---

### Pattern 2: Delayed Action

Execute an action after a specific delay.

```typescript
const workflow = await client.createWorkflow({
  name: 'Send Reminder Email',
  trigger: 'task_created',
  phase: 'after',
  interval: 1440,  // 24 hours (in minutes)
  actions: [{
    action_type: 'send_email',
    payload: { template: 'task_reminder' },
  }],
});
```

**Use Cases:**
- Reminder emails
- Follow-up notifications
- Trial expiration warnings
- Abandoned cart reminders

---

### Pattern 3: Preventive Action

Execute an action before an event (deadline approaching).

```typescript
const workflow = await client.createWorkflow({
  name: 'Deadline Warning',
  trigger: 'deadline_set',
  phase: 'before',
  interval: 120,  // 2 hours before deadline
  actions: [{
    action_type: 'send_notification',
    payload: { type: 'deadline_approaching' },
  }],
});
```

**Use Cases:**
- Meeting reminders
- Deadline warnings
- Subscription renewal reminders
- Payment due notifications

---

## Time-Based Patterns

### Pattern 4: Drip Campaign

Send a series of emails over time.

```typescript
const workflow = await client.createWorkflow({
  name: 'Onboarding Drip Campaign',
  trigger: 'user_created',
  phase: 'after',
  interval: 0,  // Start immediately
  actions: [
    {
      action_type: 'send_email',
      payload: { template: 'day_0_welcome' },
      order: 1,
    },
    {
      action_type: 'send_email',
      payload: {
        template: 'day_3_tips',
        delay_hours: 72,  // 3 days from trigger
      },
      order: 2,
    },
    {
      action_type: 'send_email',
      payload: {
        template: 'day_7_features',
        delay_hours: 168,  // 7 days
      },
      order: 3,
    },
    {
      action_type: 'send_email',
      payload: {
        template: 'day_14_upgrade',
        delay_hours: 336,  // 14 days
      },
      order: 4,
    },
  ],
});
```

**Implementation Note:**
Each action needs its own `workflow_action_log` entry with appropriate `execute_at` timestamps.

**Use Cases:**
- Customer onboarding
- Educational email series
- Trial conversion campaigns
- Re-engagement campaigns

---

### Pattern 5: Recurring Tasks

Periodic execution (using custom trigger logic).

```typescript
// Create workflow triggered by cron event
const workflow = await client.createWorkflow({
  name: 'Weekly Report Generation',
  trigger: 'scheduled_time',
  phase: 'now',
  interval: 0,
  actions: [{
    action_type: 'generate_report',
    payload: {
      type: 'weekly_summary',
      recipients: ['admin@example.com'],
    },
  }],
});

// Set up a separate cron job to trigger this workflow weekly
// (Using Supabase Edge Function or external cron service)
```

**Use Cases:**
- Weekly/monthly reports
- Data cleanup tasks
- Subscription renewals
- Scheduled backups

---

## Multi-Step Workflows

### Pattern 6: Sequential Processing Pipeline

Execute multiple steps in sequence.

```typescript
const workflow = await client.createWorkflow({
  name: 'Document Processing Pipeline',
  trigger: 'document_uploaded',
  phase: 'now',
  interval: 0,
  actions: [
    {
      action_type: 'validate_document',
      order: 1,
    },
    {
      action_type: 'extract_text',
      order: 2,
    },
    {
      action_type: 'analyze_content',
      order: 3,
    },
    {
      action_type: 'send_notification',
      payload: { type: 'processing_complete' },
      order: 4,
    },
  ],
});
```

**Implementation:**
Each action completes before the next begins. Use `order` field to guarantee sequence.

**Use Cases:**
- Document processing
- Order fulfillment
- Data ETL pipelines
- Multi-stage approvals

---

### Pattern 7: Fan-Out / Broadcast

Send multiple notifications simultaneously.

```typescript
const workflow = await client.createWorkflow({
  name: 'Notify All Stakeholders',
  trigger: 'application_submitted',
  phase: 'now',
  interval: 0,
  actions: [
    {
      action_type: 'notify_slack',
      payload: { channel: 'hiring' },
      order: 1,
    },
    {
      action_type: 'send_email',
      payload: { template: 'applicant_confirmation' },
      order: 1,  // Same order = parallel execution
    },
    {
      action_type: 'create_jira_ticket',
      payload: { project: 'HIRING' },
      order: 1,
    },
  ],
});
```

**Note:** All actions with the same `order` can execute in parallel.

**Use Cases:**
- Multi-channel notifications
- Parallel API calls
- Batch processing
- Event broadcasting

---

## Conditional Workflows

### Pattern 8: Conditional Execution

Execute actions based on conditions.

```typescript
const workflow = await client.createWorkflow({
  name: 'Tiered User Onboarding',
  trigger: 'user_created',
  phase: 'now',
  interval: 0,
  actions: [
    {
      action_type: 'send_email',
      payload: { template: 'free_tier_welcome' },
      condition: {
        field: 'meta.subscription_tier',
        operator: 'equals',
        value: 'free',
      },
    },
    {
      action_type: 'send_email',
      payload: { template: 'premium_welcome' },
      condition: {
        field: 'meta.subscription_tier',
        operator: 'equals',
        value: 'premium',
      },
    },
    {
      action_type: 'assign_account_manager',
      condition: {
        field: 'meta.subscription_tier',
        operator: 'equals',
        value: 'enterprise',
      },
    },
  ],
});
```

**Implementation:**
Webhook handler checks `condition` before executing action.

**Use Cases:**
- User segmentation
- A/B testing workflows
- Dynamic content delivery
- Role-based automation

---

### Pattern 9: Workflow Branching

Different workflows for different scenarios.

```typescript
// Create multiple workflows
const standardOnboarding = await client.createWorkflow({ ... });
const enterpriseOnboarding = await client.createWorkflow({ ... });

// Choose workflow based on user type
async function onUserCreated(user) {
  const workflowId = user.is_enterprise
    ? enterpriseOnboarding.id
    : standardOnboarding.id;

  await client.executeWorkflow({
    workflowId,
    triggerData: {
      related_table: 'users',
      related_table_pkey: user.id,
    },
  });
}
```

**Use Cases:**
- Multi-tier onboarding
- Different SLAs per customer
- Geographic-specific workflows
- Feature flag-based automation

---

## Integration Patterns

### Pattern 10: External API Integration

Call external APIs as part of workflow.

```typescript
const workflow = await client.createWorkflow({
  name: 'Sync to CRM',
  trigger: 'user_created',
  phase: 'now',
  interval: 0,
  actions: [
    {
      action_type: 'create_crm_contact',
      target_endpoint: '/api/integrations/salesforce',
      payload: {
        object: 'Contact',
        fields: ['email', 'name', 'company'],
      },
    },
    {
      action_type: 'send_to_analytics',
      target_endpoint: '/api/integrations/segment',
      payload: {
        event: 'User Signed Up',
      },
      order: 1,  // Parallel with CRM sync
    },
  ],
});

// In webhook handler:
async function handleCRMSync(action) {
  const { meta } = action;

  // Call Salesforce API
  const contact = await salesforce.createContact({
    email: meta.user_email,
    firstName: meta.user_name,
  });

  // Update meta with Salesforce ID for future reference
  await supabase
    .from('workflow_action_logs')
    .update({
      meta: { ...meta, salesforce_id: contact.id },
    })
    .eq('id', action.id);
}
```

**Use Cases:**
- CRM synchronization (Salesforce, HubSpot)
- Analytics tracking (Segment, Mixpanel)
- Communication platforms (Slack, Discord)
- Payment processing (Stripe webhooks)

---

### Pattern 11: Webhook Fan-In

Aggregate results from multiple sources.

```typescript
const workflow = await client.createWorkflow({
  name: 'Aggregate User Data',
  trigger: 'user_created',
  phase: 'now',
  interval: 0,
  actions: [
    {
      action_type: 'fetch_social_profile',
      payload: { platform: 'linkedin' },
      order: 1,
    },
    {
      action_type: 'fetch_social_profile',
      payload: { platform: 'github' },
      order: 1,
    },
    {
      action_type: 'enrich_profile',
      payload: { service: 'clearbit' },
      order: 1,
    },
    {
      action_type: 'aggregate_data',
      order: 2,  // Runs after all fetches complete
    },
  ],
});
```

**Use Cases:**
- Data enrichment from multiple sources
- Parallel API calls with aggregation
- Multi-source validation
- Federated search

---

## Error Handling Patterns

### Pattern 12: Retry with Backoff

Automatic retry for failed actions.

```typescript
// Built-in retry mechanism handles this
// Exponential backoff: 1min, 5min, 15min, 45min, 135min

// Custom retry configuration in webhook handler:
export async function handler(req) {
  const { id: logId, tries } = req.body;

  try {
    await executeAction(req.body);

    await supabase
      .from('workflow_action_logs')
      .update({ status: 'completed' })
      .eq('id', logId);
  } catch (error) {
    if (isRetryableError(error) && tries < 5) {
      // Mark for retry
      const nextRetryAt = new Date(
        Date.now() + Math.pow(2, tries) * 60 * 1000
      );

      await supabase
        .from('workflow_action_logs')
        .update({
          status: 'not_started',
          execute_at: nextRetryAt.toISOString(),
          error_message: error.message,
        })
        .eq('id', logId);
    } else {
      // Max retries exceeded or non-retryable error
      await supabase
        .from('workflow_action_logs')
        .update({
          status: 'failed',
          error_message: error.message,
        })
        .eq('id', logId);

      // Optionally: send alert to admin
      await sendAdminAlert({
        type: 'workflow_failed',
        workflowId: req.body.workflow_id,
        error: error.message,
      });
    }
  }
}

function isRetryableError(error) {
  return (
    error.code === 'ETIMEDOUT' ||
    error.code === 'ECONNRESET' ||
    error.response?.status === 429 ||
    error.response?.status >= 500
  );
}
```

**Use Cases:**
- API rate limiting handling
- Network error recovery
- Temporary service outages
- Database connection issues

---

### Pattern 13: Dead Letter Queue

Handle permanently failed workflows.

```typescript
// Create separate workflow for failed actions
const deadLetterWorkflow = await client.createWorkflow({
  name: 'Handle Failed Actions',
  trigger: 'workflow_failed',
  phase: 'now',
  interval: 0,
  actions: [
    {
      action_type: 'log_to_sentry',
      payload: { severity: 'error' },
    },
    {
      action_type: 'send_admin_alert',
      payload: { channel: 'critical-alerts' },
    },
    {
      action_type: 'create_support_ticket',
      payload: { priority: 'high' },
    },
  ],
});

// In main workflow handler:
if (tries >= MAX_RETRIES) {
  await client.executeWorkflow({
    workflowId: deadLetterWorkflow.id,
    triggerData: {
      related_table: 'workflow_action_logs',
      related_table_pkey: failedLogId,
      meta: {
        original_workflow_id: workflowId,
        error_message: lastError,
      },
    },
  });
}
```

**Use Cases:**
- Critical error alerting
- Manual intervention triggers
- Audit trail for failures
- Compliance logging

---

## Advanced Patterns

### Pattern 14: State Machine Workflow

Implement complex state transitions.

```typescript
const interviewWorkflow = await client.createWorkflow({
  name: 'Interview Scheduling State Machine',
  trigger: 'interview_requested',
  phase: 'now',
  interval: 0,
  actions: [
    {
      action_type: 'send_availability_request',
      order: 1,
      metadata: { next_state: 'awaiting_availability' },
    },
    {
      action_type: 'reminder_availability',
      order: 2,
      payload: { delay_hours: 48 },
      condition: {
        field: 'current_state',
        operator: 'equals',
        value: 'awaiting_availability',
      },
    },
    {
      action_type: 'schedule_interview',
      order: 3,
      condition: {
        field: 'availability_received',
        operator: 'equals',
        value: true,
      },
    },
    {
      action_type: 'send_confirmation',
      order: 4,
      metadata: { next_state: 'scheduled' },
    },
  ],
});
```

**Use Cases:**
- Order processing (pending → paid → shipped → delivered)
- Interview scheduling (requested → scheduled → completed)
- Approval workflows (submitted → review → approved/rejected)
- Subscription lifecycle (trial → active → churned)

---

### Pattern 15: Workflow Chaining

One workflow triggers another.

```typescript
// Workflow 1: Process payment
const paymentWorkflow = await client.createWorkflow({
  name: 'Process Payment',
  trigger: 'order_created',
  phase: 'now',
  interval: 0,
  actions: [
    {
      action_type: 'charge_card',
      order: 1,
    },
    {
      action_type: 'trigger_fulfillment_workflow',
      order: 2,
      payload: {
        next_workflow: 'order_fulfillment',
      },
    },
  ],
});

// Workflow 2: Fulfill order (triggered by payment workflow)
const fulfillmentWorkflow = await client.createWorkflow({
  name: 'Order Fulfillment',
  trigger: 'payment_confirmed',
  phase: 'now',
  interval: 0,
  actions: [
    {
      action_type: 'create_shipping_label',
      order: 1,
    },
    {
      action_type: 'notify_warehouse',
      order: 2,
    },
    {
      action_type: 'send_tracking_email',
      order: 3,
    },
  ],
});

// In payment workflow handler:
if (paymentSuccessful) {
  await client.executeWorkflow({
    workflowId: fulfillmentWorkflow.id,
    triggerData: {
      related_table: 'orders',
      related_table_pkey: orderId,
    },
  });
}
```

**Use Cases:**
- E-commerce order processing
- Multi-stage approval processes
- Complex business workflows
- Microservices orchestration

---

## Best Practices

### 1. Idempotency

Ensure actions can be safely retried:

```typescript
async function sendEmail(action) {
  const idempotencyKey = `email_${action.id}`;

  // Check if already sent
  const existing = await db.query(
    'SELECT * FROM email_log WHERE idempotency_key = $1',
    [idempotencyKey]
  );

  if (existing.rows.length > 0) {
    console.log('Email already sent, skipping');
    return;
  }

  // Send email
  await emailService.send({ ... });

  // Log sent email
  await db.query(
    'INSERT INTO email_log (idempotency_key, sent_at) VALUES ($1, NOW())',
    [idempotencyKey]
  );
}
```

### 2. Monitoring

Track workflow health:

```typescript
// Daily monitoring query
const stats = await supabase
  .from('workflow_action_logs')
  .select('status')
  .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000));

console.log({
  pending: stats.filter(s => s.status === 'not_started').length,
  processing: stats.filter(s => s.status === 'processing').length,
  completed: stats.filter(s => s.status === 'completed').length,
  failed: stats.filter(s => s.status === 'failed').length,
});
```

### 3. Rate Limiting

Prevent overwhelming external services:

```typescript
const actionsByType = new Map();

async function executeWithRateLimit(action) {
  const key = action.action_type;
  const lastExecution = actionsByType.get(key);

  if (lastExecution && Date.now() - lastExecution < 1000) {
    // Wait before executing
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  await executeAction(action);
  actionsByType.set(key, Date.now());
}
```

---

## Conclusion

These patterns demonstrate the flexibility of the workflow engine for various use cases. Mix and match patterns to build complex automation tailored to your needs.

**Next Steps:**
- Review [ARCHITECTURE.md](./ARCHITECTURE.md) for implementation details
- Check [examples/](../examples/) for working code
- Read [API.md](./API.md) for complete API reference

---

**Last Updated:** January 2025
