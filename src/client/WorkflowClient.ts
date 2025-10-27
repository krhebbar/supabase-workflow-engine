/**
 * Supabase Workflow Engine - TypeScript Client
 *
 * Type-safe client for creating and managing workflows.
 * Provides a clean API for workflow operations with full TypeScript support.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';

// Type aliases for cleaner code
type WorkflowTable = Database['public']['Tables']['workflow'];
type WorkflowActionTable = Database['public']['Tables']['workflow_action'];
type WorkflowActionLogsTable = Database['public']['Tables']['workflow_action_logs'];

type WorkflowRow = WorkflowTable['Row'];
type WorkflowInsert = WorkflowTable['Insert'];
type WorkflowActionRow = WorkflowActionTable['Row'];
type WorkflowActionInsert = WorkflowActionTable['Insert'];
type WorkflowActionLogRow = WorkflowActionLogsTable['Row'];

// Client configuration
export interface WorkflowClientConfig {
  supabaseUrl: string;
  supabaseKey: string;
  organizationId?: string;
}

// Workflow creation types
export interface CreateWorkflowRequest {
  name: string;
  description?: string;
  trigger: WorkflowRow['trigger'];
  phase: WorkflowRow['phase'];
  interval?: number; // Minutes
  actions: CreateActionRequest[];
  metadata?: Record<string, any>;
}

export interface CreateActionRequest {
  action_type: string;
  target_endpoint?: string;
  payload: Record<string, any>;
  order?: number; // Auto-assigned if not provided
  condition?: Record<string, any>;
}

// Workflow execution types
export interface ExecuteWorkflowRequest {
  workflowId: string;
  triggerData: {
    related_table: WorkflowActionLogRow['related_table'];
    related_table_pkey: string;
    meta?: Record<string, any>;
  };
  executeAt?: Date; // Defaults to now
}

// Query result types
export interface WorkflowWithActions extends WorkflowRow {
  actions: WorkflowActionRow[];
}

export interface WorkflowExecutionStatus {
  log: WorkflowActionLogRow;
  action: WorkflowActionRow;
  workflow: WorkflowRow;
}

/**
 * Main client for interacting with the Workflow Engine
 */
export class WorkflowClient {
  private supabase: SupabaseClient<Database>;
  private organizationId?: string;

  constructor(config: WorkflowClientConfig) {
    this.supabase = createClient<Database>(
      config.supabaseUrl,
      config.supabaseKey
    );
    this.organizationId = config.organizationId;
  }

  /**
   * Create a new workflow with its actions
   */
  async createWorkflow(
    request: CreateWorkflowRequest
  ): Promise<WorkflowWithActions> {
    // Validate organization ID
    if (!this.organizationId) {
      throw new Error('organizationId is required for creating workflows');
    }

    // Insert workflow
    const { data: workflow, error: workflowError } = await this.supabase
      .from('workflow')
      .insert({
        name: request.name,
        description: request.description,
        trigger: request.trigger,
        phase: request.phase,
        interval: request.interval ?? 0,
        organization_id: this.organizationId,
        metadata: request.metadata ?? {},
      })
      .select()
      .single();

    if (workflowError) throw workflowError;
    if (!workflow) throw new Error('Failed to create workflow');

    // Insert actions
    const actionsToInsert: WorkflowActionInsert[] = request.actions.map(
      (action, index) => ({
        workflow_id: workflow.id,
        action_type: action.action_type,
        target_endpoint: action.target_endpoint,
        payload: action.payload,
        order: action.order ?? index + 1,
        condition: action.condition,
      })
    );

    const { data: actions, error: actionsError } = await this.supabase
      .from('workflow_action')
      .insert(actionsToInsert)
      .select();

    if (actionsError) {
      // Rollback: delete workflow if actions fail
      await this.supabase.from('workflow').delete().eq('id', workflow.id);
      throw actionsError;
    }

    return {
      ...workflow,
      actions: actions ?? [],
    };
  }

  /**
   * Get a workflow by ID with its actions
   */
  async getWorkflow(workflowId: string): Promise<WorkflowWithActions | null> {
    const { data: workflow, error: workflowError } = await this.supabase
      .from('workflow')
      .select('*')
      .eq('id', workflowId)
      .single();

    if (workflowError) throw workflowError;
    if (!workflow) return null;

    const { data: actions, error: actionsError } = await this.supabase
      .from('workflow_action')
      .select('*')
      .eq('workflow_id', workflowId)
      .order('order', { ascending: true });

    if (actionsError) throw actionsError;

    return {
      ...workflow,
      actions: actions ?? [],
    };
  }

  /**
   * List all workflows for the organization
   */
  async listWorkflows(): Promise<WorkflowRow[]> {
    const query = this.supabase.from('workflow').select('*').order('created_at', { descending: true });

    if (this.organizationId) {
      query.eq('organization_id', this.organizationId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  }

  /**
   * Update a workflow's configuration
   */
  async updateWorkflow(
    workflowId: string,
    updates: Partial<Pick<WorkflowRow, 'name' | 'description' | 'is_active' | 'is_paused' | 'metadata'>>
  ): Promise<WorkflowRow> {
    const { data, error } = await this.supabase
      .from('workflow')
      .update(updates)
      .eq('id', workflowId)
      .select()
      .single();

    if (error) throw error;
    if (!data) throw new Error('Workflow not found');
    return data;
  }

  /**
   * Pause a workflow (stops execution without deleting)
   */
  async pauseWorkflow(workflowId: string): Promise<void> {
    await this.updateWorkflow(workflowId, { is_paused: true });
  }

  /**
   * Resume a paused workflow
   */
  async resumeWorkflow(workflowId: string): Promise<void> {
    await this.updateWorkflow(workflowId, { is_paused: false });
  }

  /**
   * Deactivate a workflow (soft delete)
   */
  async deactivateWorkflow(workflowId: string): Promise<void> {
    await this.updateWorkflow(workflowId, { is_active: false });
  }

  /**
   * Delete a workflow and all its actions
   */
  async deleteWorkflow(workflowId: string): Promise<void> {
    const { error } = await this.supabase
      .from('workflow')
      .delete()
      .eq('id', workflowId);

    if (error) throw error;
  }

  /**
   * Manually execute a workflow (creates action logs)
   * Useful for testing or manual triggering
   */
  async executeWorkflow(request: ExecuteWorkflowRequest): Promise<void> {
    // Get workflow and its actions
    const workflow = await this.getWorkflow(request.workflowId);
    if (!workflow) throw new Error('Workflow not found');
    if (!workflow.is_active) throw new Error('Workflow is not active');
    if (workflow.is_paused) throw new Error('Workflow is paused');

    // Calculate execution times based on workflow phase and interval
    const baseTime = request.executeAt ?? new Date();
    const intervalMs = Number(workflow.interval) * 60 * 1000;

    let executeAt: Date;
    switch (workflow.phase) {
      case 'now':
        executeAt = baseTime;
        break;
      case 'after':
        executeAt = new Date(baseTime.getTime() + intervalMs);
        break;
      case 'before':
        executeAt = new Date(baseTime.getTime() - intervalMs);
        break;
      default:
        executeAt = baseTime;
    }

    // Create action logs for each action
    const logsToInsert = workflow.actions.map((action) => ({
      workflow_id: workflow.id,
      workflow_action_id: action.id,
      execute_at: executeAt.toISOString(),
      related_table: request.triggerData.related_table,
      related_table_pkey: request.triggerData.related_table_pkey,
      meta: request.triggerData.meta ?? {},
      status: 'not_started' as const,
    }));

    const { error } = await this.supabase
      .from('workflow_action_logs')
      .insert(logsToInsert);

    if (error) throw error;
  }

  /**
   * Get execution status for a specific workflow run
   */
  async getExecutionStatus(
    relatedTable: string,
    relatedTablePkey: string
  ): Promise<WorkflowExecutionStatus[]> {
    const { data, error } = await this.supabase
      .from('workflow_action_logs')
      .select(
        `
        *,
        workflow:workflow_id(*),
        action:workflow_action_id(*)
      `
      )
      .eq('related_table', relatedTable)
      .eq('related_table_pkey', relatedTablePkey)
      .order('created_at', { descending: true });

    if (error) throw error;

    return (data ?? []).map((row) => ({
      log: row as WorkflowActionLogRow,
      action: (row as any).action,
      workflow: (row as any).workflow,
    }));
  }

  /**
   * Get all pending workflow actions (for monitoring)
   */
  async getPendingActions(): Promise<WorkflowActionLogRow[]> {
    const { data, error } = await this.supabase
      .from('workflow_action_logs')
      .select('*')
      .eq('status', 'not_started')
      .order('execute_at', { ascending: true })
      .limit(100);

    if (error) throw error;
    return data ?? [];
  }

  /**
   * Get failed workflow actions that need attention
   */
  async getFailedActions(minRetries: number = 3): Promise<WorkflowActionLogRow[]> {
    const { data, error } = await this.supabase
      .from('workflow_action_logs')
      .select('*')
      .eq('status', 'failed')
      .gte('tries', minRetries)
      .order('created_at', { descending: true })
      .limit(100);

    if (error) throw error;
    return data ?? [];
  }

  /**
   * Retry a failed workflow action
   */
  async retryAction(logId: number): Promise<void> {
    const { error } = await this.supabase
      .from('workflow_action_logs')
      .update({
        status: 'not_started',
        execute_at: new Date().toISOString(),
        error_message: null,
      })
      .eq('id', logId);

    if (error) throw error;
  }

  /**
   * Stop a workflow execution (mark as stopped)
   */
  async stopExecution(logId: number): Promise<void> {
    const { error } = await this.supabase
      .from('workflow_action_logs')
      .update({
        status: 'stopped',
        completed_at: new Date().toISOString(),
      })
      .eq('id', logId);

    if (error) throw error;
  }

  /**
   * Get workflow execution statistics
   */
  async getStatistics(workflowId?: string) {
    let query = this.supabase.from('workflow_action_logs').select('status');

    if (workflowId) {
      query = query.eq('workflow_id', workflowId);
    }

    const { data, error } = await query;
    if (error) throw error;

    const stats = {
      total: data?.length ?? 0,
      not_started: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      stopped: 0,
    };

    data?.forEach((row) => {
      stats[row.status as keyof typeof stats]++;
    });

    return stats;
  }
}

/**
 * Utility function to create a workflow client instance
 */
export function createWorkflowClient(
  config: WorkflowClientConfig
): WorkflowClient {
  return new WorkflowClient(config);
}

// Export types for consumers
export type {
  Database,
  WorkflowRow,
  WorkflowActionRow,
  WorkflowActionLogRow,
};
