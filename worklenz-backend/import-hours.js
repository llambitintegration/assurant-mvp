#!/usr/bin/env node
/**
 * P0003C Hours Import Script
 *
 * Imports subtasks and time logs for the P0003C project
 *
 * Usage: node import-hours.js
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

// Load JSON files
const subtasksPath = path.join(__dirname, '../context/output/14-subtasks.json');
const timeLogsPath = path.join(__dirname, '../context/output/16-time-logs.json');

const subtasksData = JSON.parse(fs.readFileSync(subtasksPath, 'utf-8'));
const timeLogsData = JSON.parse(fs.readFileSync(timeLogsPath, 'utf-8'));

const subtasks = subtasksData.subtasks;
const timeLogs = timeLogsData.time_logs;

async function importData() {
  console.log('='.repeat(80));
  console.log('P0003C HOURS IMPORT');
  console.log('='.repeat(80));
  console.log('\nProject: Assurant P0003C - Data Center Migration');
  console.log(`Subtasks to import: ${subtasks.length}`);
  console.log(`Time logs to import: ${timeLogs.length}`);
  console.log('');

  try {
    // Step 1: Insert subtasks (using raw SQL, tasks table is @@ignore)
    console.log('[Step 1/3] Importing subtasks...');
    console.log('  Using raw SQL INSERT statements');

    let subtaskCount = 0;
    let subtaskSkipped = 0;

    for (const subtask of subtasks) {
      try {
        const result = await prisma.$executeRaw`
          INSERT INTO tasks (
            id, name, description, project_id, parent_task_id,
            status_id, priority_id, reporter_id, task_no, done,
            start_date, end_date, archived, sort_order,
            created_at, updated_at
          ) VALUES (
            ${subtask.id}::uuid,
            ${subtask.name},
            ${subtask.description},
            ${subtask.project_id}::uuid,
            ${subtask.parent_task_id}::uuid,
            ${subtask.status_id}::uuid,
            ${subtask.priority_id}::uuid,
            ${subtask.reporter_id}::uuid,
            ${subtask.task_no},
            ${subtask.done},
            ${subtask.start_date}::timestamptz,
            ${subtask.end_date}::timestamptz,
            ${subtask.archived},
            ${subtask.sort_order},
            ${subtask.created_at}::timestamptz,
            ${subtask.updated_at}::timestamptz
          )
          ON CONFLICT (id) DO NOTHING
        `;

        if (result > 0) {
          subtaskCount++;
        } else {
          subtaskSkipped++;
        }
      } catch (error) {
        console.error(`  Error inserting subtask ${subtask.id}: ${error.message}`);
        throw error;
      }
    }

    console.log(`  ✓ Created: ${subtaskCount} subtasks`);
    if (subtaskSkipped > 0) {
      console.log(`  ℹ Skipped: ${subtaskSkipped} subtasks (already exist)`);
    }

    // Step 2: Insert time logs (using raw SQL)
    console.log('\n[Step 2/3] Importing time logs...');
    console.log('  Using raw SQL INSERT statements');

    let logCount = 0;
    let logSkipped = 0;

    for (let i = 0; i < timeLogs.length; i++) {
      const log = timeLogs[i];

      try {
        const result = await prisma.$executeRaw`
          INSERT INTO task_work_log (
            id, task_id, user_id, time_spent, description,
            logged_by_timer, created_at, updated_at
          ) VALUES (
            ${log.id}::uuid,
            ${log.task_id}::uuid,
            ${log.user_id}::uuid,
            ${log.time_spent},
            ${log.description},
            ${log.logged_by_timer},
            ${log.created_at}::timestamptz,
            ${log.updated_at}::timestamptz
          )
          ON CONFLICT (id) DO NOTHING
        `;

        if (result > 0) {
          logCount++;
        } else {
          logSkipped++;
        }
      } catch (error) {
        console.error(`  Error inserting time log ${log.id}: ${error.message}`);
        throw error;
      }

      // Progress indicator every 100 logs
      if ((i + 1) % 100 === 0) {
        console.log(`  Progress: ${i + 1}/${timeLogs.length} (${Math.round((i + 1) / timeLogs.length * 100)}%)`);
      }
    }

    console.log(`  ✓ Created: ${logCount} time logs`);
    if (logSkipped > 0) {
      console.log(`  ℹ Skipped: ${logSkipped} time logs (already exist)`);
    }

    // Step 3: Validate import
    console.log('\n[Step 3/3] Validating import...');

    const result = await prisma.$queryRaw`
      SELECT
        COUNT(*)::int as total_logs,
        SUM(time_spent)::bigint as total_seconds,
        COUNT(DISTINCT user_id)::int as unique_users,
        COUNT(DISTINCT task_id)::int as unique_tasks
      FROM task_work_log
      WHERE created_at >= '2025-06-17'::timestamptz
    `;

    const stats = result[0];
    const totalHours = Number(stats.total_seconds) / 3600;

    console.log('\n  Validation Results:');
    console.log(`    - Time logs imported:  ${stats.total_logs}`);
    console.log(`    - Total hours logged:  ${totalHours.toFixed(1)}`);
    console.log(`    - Unique users:        ${stats.unique_users}`);
    console.log(`    - Unique subtasks:     ${stats.unique_tasks}`);

    console.log('\n  Expected vs Actual:');
    console.log(`    - Time logs:   ${stats.total_logs === 765 ? '✓' : '✗'} (expected 765, got ${stats.total_logs})`);
    console.log(`    - Total hours: ${Math.abs(totalHours - 16249) < 1 ? '✓' : '✗'} (expected 16,249, got ${totalHours.toFixed(1)})`);
    console.log(`    - Users:       ${stats.unique_users === 18 ? '✓' : '~'} (expected ~18, got ${stats.unique_users})`);
    console.log(`    - Subtasks:    ${stats.unique_tasks === 71 ? '✓' : '✗'} (expected 71, got ${stats.unique_tasks})`);

    // Final summary
    console.log('\n' + '='.repeat(80));

    const allValid =
      stats.total_logs === 765 &&
      Math.abs(totalHours - 16249) < 1 &&
      stats.unique_tasks === 71;

    if (allValid) {
      console.log('✓ IMPORT COMPLETED SUCCESSFULLY');
      console.log('  All validation checks passed.');
    } else {
      console.log('⚠ IMPORT COMPLETED WITH WARNINGS');
      console.log('  Some validation checks failed. Review results above.');
    }

    console.log('='.repeat(80));

  } catch (error) {
    console.error('\n' + '='.repeat(80));
    console.error('✗ IMPORT FAILED');
    console.error('='.repeat(80));
    console.error('\nError details:');
    console.error(error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Execute import
importData()
  .catch((error) => {
    console.error('\nFatal error during import:', error.message);
    process.exit(1);
  });
