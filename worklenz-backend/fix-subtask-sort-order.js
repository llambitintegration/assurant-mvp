#!/usr/bin/env node
/**
 * Fix sort_order in 14-subtasks.json to avoid conflict with parent tasks
 * Parent tasks use sort_order 0-9, so offset subtasks by 10
 */

const fs = require('fs');
const path = require('path');

const subtasksPath = path.join(__dirname, '../context/output/14-subtasks.json');
const subtasksData = JSON.parse(fs.readFileSync(subtasksPath, 'utf-8'));

console.log('Fixing sort_order values...');
console.log(`Total subtasks: ${subtasksData.subtasks.length}`);

// Add 10 to each sort_order to avoid conflict with parent tasks (0-9)
subtasksData.subtasks.forEach(subtask => {
  subtask.sort_order += 10;
});

// Write back to file
fs.writeFileSync(subtasksPath, JSON.stringify(subtasksData, null, 2), 'utf-8');

console.log('✓ Fixed sort_order values (offset by 10)');
console.log(`  New range: ${subtasksData.subtasks[0].sort_order} - ${subtasksData.subtasks[subtasksData.subtasks.length-1].sort_order}`);
