/**
 * Custom Columns Service Contract Tests
 *
 * Tests all 6 custom column operations with SQL/Prisma parity validation
 * Pattern: Feature Flag + Dual Execution + Transaction Support
 * Each test validates that the Prisma implementation produces identical output to SQL.
 *
 * Operations tested:
 * 1. createCustomColumn - Create custom column with configuration (TRANSACTION)
 * 2. getCustomColumns - Get all custom columns for a project
 * 3. getCustomColumnById - Get a specific custom column
 * 4. updateCustomColumn - Update custom column and configuration (TRANSACTION)
 * 5. deleteCustomColumn - Delete a custom column
 * 6. getProjectColumns - Get project columns in UI format
 */

import db from '../../../config/db';
import { getTestTeam, getTestUser } from '../setup';
import { CustomColumnsService } from '../../../services/custom-columns/custom-columns-service';

describe('Custom Columns Service - Contract Tests', () => {
  let testTeamId: string;
  let testUserId: string;
  let testProjectId: string;
  let customColumnsService: CustomColumnsService;

  beforeAll(async () => {
    // Get existing test team and user
    const team = await getTestTeam();
    testTeamId = team.id;

    const user = await getTestUser(testTeamId);
    testUserId = user.id;

    // Create test project
    const projectResult = await db.query(
      `INSERT INTO projects (name, key, team_id, owner_id, status_id)
       VALUES ($1, $2, $3, $4, (SELECT id FROM sys_project_statuses WHERE is_default = true LIMIT 1))
       RETURNING id`,
      ['Test Project Custom Columns', 'TPCC', testTeamId, testUserId]
    );
    testProjectId = projectResult.rows[0].id;

    // Initialize custom columns service
    customColumnsService = CustomColumnsService.getInstance();
  });

  afterAll(async () => {
    // Cleanup test data (cascade will handle related records)
    await db.query('DELETE FROM cc_custom_columns WHERE project_id = $1', [testProjectId]);
    await db.query('DELETE FROM projects WHERE id = $1', [testProjectId]);
  });

  // ============================================
  // CONTRACT TESTS (6 total)
  // ============================================

  describe('1. createCustomColumn - Create with transaction', () => {
    it('should create column with configuration and selections (SQL/Prisma parity)', async () => {
      const testData = {
        project_id: testProjectId,
        name: 'Status Dropdown',
        key: 'status_dropdown_sql',
        field_type: 'dropdown',
        width: 200,
        is_visible: true,
        configuration: {
          field_title: 'Task Status',
          field_type: 'dropdown',
          selections_list: [
            { selection_id: 'sel1', selection_name: 'Open', selection_color: '#00FF00' },
            { selection_id: 'sel2', selection_name: 'In Progress', selection_color: '#FFAA00' },
            { selection_id: 'sel3', selection_name: 'Closed', selection_color: '#FF0000' }
          ]
        }
      };

      // SQL Implementation (original from custom-columns-controller.ts:11-164)
      const client = await db.pool.connect();
      let sqlColumnId: string;
      let sqlData: any;

      try {
        await client.query('BEGIN');

        // 1. Insert main custom column
        const columnQuery = `
          INSERT INTO cc_custom_columns (
            project_id, name, key, field_type, width, is_visible, is_custom_column
          ) VALUES ($1, $2, $3, $4, $5, $6, true)
          RETURNING id;
        `;
        const columnResult = await client.query(columnQuery, [
          testData.project_id,
          testData.name,
          testData.key,
          testData.field_type,
          testData.width,
          testData.is_visible
        ]);
        sqlColumnId = columnResult.rows[0].id;

        // 2. Insert configuration
        const configQuery = `
          INSERT INTO cc_column_configurations (
            column_id, field_title, field_type, number_type,
            decimals, label, label_position, preview_value,
            expression, first_numeric_column_key, second_numeric_column_key
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          RETURNING id;
        `;
        await client.query(configQuery, [
          sqlColumnId,
          testData.configuration.field_title,
          testData.configuration.field_type,
          null, null, null, null, null, null, null, null
        ]);

        // 3. Insert selections
        const selectionQuery = `
          INSERT INTO cc_selection_options (
            column_id, selection_id, selection_name, selection_color, selection_order
          ) VALUES ($1, $2, $3, $4, $5);
        `;
        for (const [index, selection] of testData.configuration.selections_list!.entries()) {
          await client.query(selectionQuery, [
            sqlColumnId,
            selection.selection_id,
            selection.selection_name,
            selection.selection_color,
            index
          ]);
        }

        await client.query('COMMIT');

        // Fetch complete data
        const getColumnQuery = `
          SELECT
            cc.*,
            cf.field_title,
            cf.number_type,
            cf.decimals,
            cf.label,
            cf.label_position,
            cf.preview_value,
            cf.expression,
            cf.first_numeric_column_key,
            cf.second_numeric_column_key,
            (
              SELECT json_agg(
                json_build_object(
                  'selection_id', so.selection_id,
                  'selection_name', so.selection_name,
                  'selection_color', so.selection_color
                )
              )
              FROM cc_selection_options so
              WHERE so.column_id = cc.id
            ) as selections_list,
            (
              SELECT json_agg(
                json_build_object(
                  'label_id', lo.label_id,
                  'label_name', lo.label_name,
                  'label_color', lo.label_color
                )
              )
              FROM cc_label_options lo
              WHERE lo.column_id = cc.id
            ) as labels_list
          FROM cc_custom_columns cc
          LEFT JOIN cc_column_configurations cf ON cf.column_id = cc.id
          WHERE cc.id = $1;
        `;
        const result = await client.query(getColumnQuery, [sqlColumnId]);
        sqlData = result.rows[0];
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }

      // Prisma Implementation
      const prismaTestData = { ...testData, key: 'status_dropdown_prisma' };
      const prismaData = await customColumnsService.createCustomColumn(prismaTestData);

      // Validate structure parity
      expect(prismaData.name).toBe(sqlData.name);
      expect(prismaData.field_type).toBe(sqlData.field_type);
      expect(prismaData.width).toBe(sqlData.width);
      expect(prismaData.is_visible).toBe(sqlData.is_visible);
      expect(prismaData.field_title).toBe(sqlData.field_title);
      expect(prismaData.selections_list).toHaveLength(sqlData.selections_list.length);

      // Verify selections order and content
      for (let i = 0; i < sqlData.selections_list.length; i++) {
        expect(prismaData.selections_list[i].selection_id).toBe(sqlData.selections_list[i].selection_id);
        expect(prismaData.selections_list[i].selection_name).toBe(sqlData.selections_list[i].selection_name);
        expect(prismaData.selections_list[i].selection_color).toBe(sqlData.selections_list[i].selection_color);
      }

      // Cleanup
      await db.query('DELETE FROM cc_custom_columns WHERE id IN ($1, $2)', [sqlColumnId, prismaData.id]);
    });

    it('should create column with labels (SQL/Prisma parity)', async () => {
      const testData = {
        project_id: testProjectId,
        name: 'Priority Labels',
        key: 'priority_labels_sql',
        field_type: 'label',
        width: 150,
        is_visible: true,
        configuration: {
          field_title: 'Task Priority',
          field_type: 'label',
          labels_list: [
            { label_id: 'lbl1', label_name: 'High', label_color: '#FF0000' },
            { label_id: 'lbl2', label_name: 'Medium', label_color: '#FFAA00' },
            { label_id: 'lbl3', label_name: 'Low', label_color: '#00FF00' }
          ]
        }
      };

      // SQL Implementation
      const client = await db.pool.connect();
      let sqlColumnId: string;
      let sqlData: any;

      try {
        await client.query('BEGIN');

        const columnQuery = `
          INSERT INTO cc_custom_columns (
            project_id, name, key, field_type, width, is_visible, is_custom_column
          ) VALUES ($1, $2, $3, $4, $5, $6, true)
          RETURNING id;
        `;
        const columnResult = await client.query(columnQuery, [
          testData.project_id, testData.name, testData.key,
          testData.field_type, testData.width, testData.is_visible
        ]);
        sqlColumnId = columnResult.rows[0].id;

        const configQuery = `
          INSERT INTO cc_column_configurations (
            column_id, field_title, field_type, number_type,
            decimals, label, label_position, preview_value,
            expression, first_numeric_column_key, second_numeric_column_key
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          RETURNING id;
        `;
        await client.query(configQuery, [
          sqlColumnId, testData.configuration.field_title,
          testData.configuration.field_type,
          null, null, null, null, null, null, null, null
        ]);

        const labelQuery = `
          INSERT INTO cc_label_options (
            column_id, label_id, label_name, label_color, label_order
          ) VALUES ($1, $2, $3, $4, $5);
        `;
        for (const [index, label] of testData.configuration.labels_list!.entries()) {
          await client.query(labelQuery, [
            sqlColumnId, label.label_id, label.label_name,
            label.label_color, index
          ]);
        }

        await client.query('COMMIT');

        const getColumnQuery = `
          SELECT
            cc.*,
            cf.field_title,
            cf.number_type,
            cf.decimals,
            cf.label,
            cf.label_position,
            cf.preview_value,
            cf.expression,
            cf.first_numeric_column_key,
            cf.second_numeric_column_key,
            (
              SELECT json_agg(
                json_build_object(
                  'selection_id', so.selection_id,
                  'selection_name', so.selection_name,
                  'selection_color', so.selection_color
                )
              )
              FROM cc_selection_options so
              WHERE so.column_id = cc.id
            ) as selections_list,
            (
              SELECT json_agg(
                json_build_object(
                  'label_id', lo.label_id,
                  'label_name', lo.label_name,
                  'label_color', lo.label_color
                )
              )
              FROM cc_label_options lo
              WHERE lo.column_id = cc.id
            ) as labels_list
          FROM cc_custom_columns cc
          LEFT JOIN cc_column_configurations cf ON cf.column_id = cc.id
          WHERE cc.id = $1;
        `;
        const result = await client.query(getColumnQuery, [sqlColumnId]);
        sqlData = result.rows[0];
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }

      // Prisma Implementation
      const prismaTestData = { ...testData, key: 'priority_labels_prisma' };
      const prismaData = await customColumnsService.createCustomColumn(prismaTestData);

      // Validate
      expect(prismaData.name).toBe(sqlData.name);
      expect(prismaData.labels_list).toHaveLength(sqlData.labels_list.length);

      for (let i = 0; i < sqlData.labels_list.length; i++) {
        expect(prismaData.labels_list[i].label_id).toBe(sqlData.labels_list[i].label_id);
        expect(prismaData.labels_list[i].label_name).toBe(sqlData.labels_list[i].label_name);
      }

      // Cleanup
      await db.query('DELETE FROM cc_custom_columns WHERE id IN ($1, $2)', [sqlColumnId, prismaData.id]);
    });
  });

  describe('2. getCustomColumns - Get all columns for project', () => {
    it('should return all custom columns with configurations (SQL/Prisma parity)', async () => {
      // Create test columns
      const columnData = {
        project_id: testProjectId,
        name: 'Test Column',
        key: 'test_column_get',
        field_type: 'text',
        width: 180,
        is_visible: true,
        configuration: {
          field_title: 'Test Field',
          field_type: 'text'
        }
      };

      const createdColumn = await customColumnsService.createCustomColumn(columnData);

      // SQL Query (original from custom-columns-controller.ts:167-214)
      const q = `
        SELECT
          cc.*,
          cf.field_title,
          cf.number_type,
          cf.decimals,
          cf.label,
          cf.label_position,
          cf.preview_value,
          cf.expression,
          cf.first_numeric_column_key,
          cf.second_numeric_column_key,
          (
            SELECT json_agg(
              json_build_object(
                'selection_id', so.selection_id,
                'selection_name', so.selection_name,
                'selection_color', so.selection_color
              )
            )
            FROM cc_selection_options so
            WHERE so.column_id = cc.id
          ) as selections_list,
          (
            SELECT json_agg(
              json_build_object(
                'label_id', lo.label_id,
                'label_name', lo.label_name,
                'label_color', lo.label_color
              )
            )
            FROM cc_label_options lo
            WHERE lo.column_id = cc.id
          ) as labels_list
        FROM cc_custom_columns cc
        LEFT JOIN cc_column_configurations cf ON cf.column_id = cc.id
        WHERE cc.project_id = $1
        ORDER BY cc.created_at DESC;
      `;
      const sqlResult = await db.query(q, [testProjectId]);
      const sqlData = sqlResult.rows;

      // Prisma Implementation
      const prismaData = await customColumnsService.getCustomColumns({
        project_id: testProjectId
      });

      // Validate
      expect(prismaData).toHaveLength(sqlData.length);
      expect(prismaData[0].name).toBe(sqlData[0].name);
      expect(prismaData[0].field_title).toBe(sqlData[0].field_title);

      // Cleanup
      await db.query('DELETE FROM cc_custom_columns WHERE id = $1', [createdColumn.id]);
    });
  });

  describe('3. getCustomColumnById - Get specific column', () => {
    it('should return column with all configurations (SQL/Prisma parity)', async () => {
      // Create test column
      const columnData = {
        project_id: testProjectId,
        name: 'Get By ID Test',
        key: 'get_by_id_test',
        field_type: 'number',
        width: 120,
        is_visible: true,
        configuration: {
          field_title: 'Amount',
          field_type: 'number',
          number_type: 'currency',
          decimals: 2
        }
      };

      const createdColumn = await customColumnsService.createCustomColumn(columnData);

      // SQL Query (original from custom-columns-controller.ts:217-264)
      const q = `
        SELECT
          cc.*,
          cf.field_title,
          cf.number_type,
          cf.decimals,
          cf.label,
          cf.label_position,
          cf.preview_value,
          cf.expression,
          cf.first_numeric_column_key,
          cf.second_numeric_column_key,
          (
            SELECT json_agg(
              json_build_object(
                'selection_id', so.selection_id,
                'selection_name', so.selection_name,
                'selection_color', so.selection_color
              )
            )
            FROM cc_selection_options so
            WHERE so.column_id = cc.id
          ) as selections_list,
          (
            SELECT json_agg(
              json_build_object(
                'label_id', lo.label_id,
                'label_name', lo.label_name,
                'label_color', lo.label_color
              )
            )
            FROM cc_label_options lo
            WHERE lo.column_id = cc.id
          ) as labels_list
        FROM cc_custom_columns cc
        LEFT JOIN cc_column_configurations cf ON cf.column_id = cc.id
        WHERE cc.id = $1;
      `;
      const sqlResult = await db.query(q, [createdColumn.id]);
      const sqlData = sqlResult.rows[0];

      // Prisma Implementation
      const prismaData = await customColumnsService.getCustomColumnById({
        id: createdColumn.id
      });

      // Validate
      expect(prismaData.id).toBe(sqlData.id);
      expect(prismaData.name).toBe(sqlData.name);
      expect(prismaData.number_type).toBe(sqlData.number_type);
      expect(prismaData.decimals).toBe(sqlData.decimals);

      // Cleanup
      await db.query('DELETE FROM cc_custom_columns WHERE id = $1', [createdColumn.id]);
    });
  });

  describe('4. updateCustomColumn - Update with transaction', () => {
    it('should update column and replace selections (SQL/Prisma parity)', async () => {
      // Create initial column
      const initialData = {
        project_id: testProjectId,
        name: 'Update Test',
        key: 'update_test_sql',
        field_type: 'dropdown',
        width: 150,
        is_visible: true,
        configuration: {
          field_title: 'Original',
          field_type: 'dropdown',
          selections_list: [
            { selection_id: 'old1', selection_name: 'Old Option', selection_color: '#AAAAAA' }
          ]
        }
      };

      const sqlColumn = await customColumnsService.createCustomColumn(initialData);
      const prismaColumn = await customColumnsService.createCustomColumn({
        ...initialData,
        key: 'update_test_prisma'
      });

      const updateData = {
        name: 'Updated Column',
        field_type: 'dropdown',
        width: 200,
        is_visible: false,
        configuration: {
          field_title: 'Updated Title',
          field_type: 'dropdown',
          selections_list: [
            { selection_id: 'new1', selection_name: 'New Option 1', selection_color: '#FF0000' },
            { selection_id: 'new2', selection_name: 'New Option 2', selection_color: '#00FF00' }
          ]
        }
      };

      // SQL Implementation (original from custom-columns-controller.ts:267-432)
      const client = await db.pool.connect();
      let sqlData: any;

      try {
        await client.query('BEGIN');

        // 1. Update main column
        const columnQuery = `
          UPDATE cc_custom_columns
          SET name = $1, field_type = $2, width = $3, is_visible = $4, updated_at = CURRENT_TIMESTAMP
          WHERE id = $5
          RETURNING id;
        `;
        await client.query(columnQuery, [
          updateData.name, updateData.field_type,
          updateData.width, updateData.is_visible, sqlColumn.id
        ]);

        // 2. Update configuration
        const configQuery = `
          UPDATE cc_column_configurations
          SET
            field_title = $1,
            field_type = $2,
            number_type = $3,
            decimals = $4,
            label = $5,
            label_position = $6,
            preview_value = $7,
            expression = $8,
            first_numeric_column_key = $9,
            second_numeric_column_key = $10,
            updated_at = CURRENT_TIMESTAMP
          WHERE column_id = $11;
        `;
        await client.query(configQuery, [
          updateData.configuration.field_title,
          updateData.configuration.field_type,
          null, null, null, null, null, null, null, null,
          sqlColumn.id
        ]);

        // 3. Replace selections
        await client.query('DELETE FROM cc_selection_options WHERE column_id = $1', [sqlColumn.id]);

        const selectionQuery = `
          INSERT INTO cc_selection_options (
            column_id, selection_id, selection_name, selection_color, selection_order
          ) VALUES ($1, $2, $3, $4, $5);
        `;
        for (const [index, selection] of updateData.configuration.selections_list!.entries()) {
          await client.query(selectionQuery, [
            sqlColumn.id, selection.selection_id,
            selection.selection_name, selection.selection_color, index
          ]);
        }

        await client.query('COMMIT');

        // Fetch updated data
        const getColumnQuery = `
          SELECT
            cc.*,
            cf.field_title,
            cf.number_type,
            cf.decimals,
            cf.label,
            cf.label_position,
            cf.preview_value,
            cf.expression,
            cf.first_numeric_column_key,
            cf.second_numeric_column_key,
            (
              SELECT json_agg(
                json_build_object(
                  'selection_id', so.selection_id,
                  'selection_name', so.selection_name,
                  'selection_color', so.selection_color
                )
              )
              FROM cc_selection_options so
              WHERE so.column_id = cc.id
            ) as selections_list,
            (
              SELECT json_agg(
                json_build_object(
                  'label_id', lo.label_id,
                  'label_name', lo.label_name,
                  'label_color', lo.label_color
                )
              )
              FROM cc_label_options lo
              WHERE lo.column_id = cc.id
            ) as labels_list
          FROM cc_custom_columns cc
          LEFT JOIN cc_column_configurations cf ON cf.column_id = cc.id
          WHERE cc.id = $1;
        `;
        const result = await client.query(getColumnQuery, [sqlColumn.id]);
        sqlData = result.rows[0];
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }

      // Prisma Implementation
      const prismaData = await customColumnsService.updateCustomColumn({
        id: prismaColumn.id,
        ...updateData
      });

      // Validate
      expect(prismaData.name).toBe(sqlData.name);
      expect(prismaData.width).toBe(sqlData.width);
      expect(prismaData.is_visible).toBe(sqlData.is_visible);
      expect(prismaData.field_title).toBe(sqlData.field_title);
      expect(prismaData.selections_list).toHaveLength(2);
      expect(prismaData.selections_list).toHaveLength(sqlData.selections_list.length);

      // Cleanup
      await db.query('DELETE FROM cc_custom_columns WHERE id IN ($1, $2)', [sqlColumn.id, prismaColumn.id]);
    });
  });

  describe('5. deleteCustomColumn - Delete column', () => {
    it('should delete column and cascade to related tables (SQL/Prisma parity)', async () => {
      // Create test columns
      const columnData = {
        project_id: testProjectId,
        name: 'Delete Test',
        key: 'delete_test_sql',
        field_type: 'text',
        configuration: {
          field_title: 'To Delete',
          field_type: 'text'
        }
      };

      const sqlColumn = await customColumnsService.createCustomColumn(columnData);
      const prismaColumn = await customColumnsService.createCustomColumn({
        ...columnData,
        key: 'delete_test_prisma'
      });

      // SQL Query (original from custom-columns-controller.ts:435-448)
      const q = `
        DELETE FROM cc_custom_columns
        WHERE id = $1
        RETURNING id;
      `;
      await db.query(q, [sqlColumn.id]);

      // Verify SQL deletion
      const sqlCheck = await db.query('SELECT * FROM cc_custom_columns WHERE id = $1', [sqlColumn.id]);
      expect(sqlCheck.rows.length).toBe(0);

      // Verify cascade deletion of configuration
      const sqlConfigCheck = await db.query(
        'SELECT * FROM cc_column_configurations WHERE column_id = $1',
        [sqlColumn.id]
      );
      expect(sqlConfigCheck.rows.length).toBe(0);

      // Prisma Implementation
      await customColumnsService.deleteCustomColumn({ id: prismaColumn.id });

      // Verify Prisma deletion
      const prismaCheck = await db.query('SELECT * FROM cc_custom_columns WHERE id = $1', [prismaColumn.id]);
      expect(prismaCheck.rows.length).toBe(0);

      // Verify cascade deletion of configuration
      const prismaConfigCheck = await db.query(
        'SELECT * FROM cc_column_configurations WHERE column_id = $1',
        [prismaColumn.id]
      );
      expect(prismaConfigCheck.rows.length).toBe(0);

      // Both should behave identically
      expect(sqlCheck.rows.length).toBe(prismaCheck.rows.length);
      expect(sqlConfigCheck.rows.length).toBe(prismaConfigCheck.rows.length);
    });
  });

  describe('6. getProjectColumns - Get columns in UI format', () => {
    it('should return columns formatted for UI (SQL/Prisma parity)', async () => {
      // Create test column
      const columnData = {
        project_id: testProjectId,
        name: 'UI Format Test',
        key: 'ui_format_test',
        field_type: 'dropdown',
        width: 175,
        is_visible: true,
        configuration: {
          field_title: 'Status',
          field_type: 'dropdown',
          selections_list: [
            { selection_id: 's1', selection_name: 'Active', selection_color: '#00AA00' }
          ]
        }
      };

      const createdColumn = await customColumnsService.createCustomColumn(columnData);

      // SQL Query (original from custom-columns-controller.ts:451-530)
      const q = `
        WITH column_data AS (
          SELECT
            cc.id,
            cc.key,
            cc.name,
            cc.field_type,
            cc.width,
            cc.is_visible,
            cf.field_title,
            cf.number_type,
            cf.decimals,
            cf.label,
            cf.label_position,
            cf.preview_value,
            cf.expression,
            cf.first_numeric_column_key,
            cf.second_numeric_column_key,
            (
              SELECT json_agg(
                json_build_object(
                  'selection_id', so.selection_id,
                  'selection_name', so.selection_name,
                  'selection_color', so.selection_color
                )
              )
              FROM cc_selection_options so
              WHERE so.column_id = cc.id
            ) as selections_list,
            (
              SELECT json_agg(
                json_build_object(
                  'label_id', lo.label_id,
                  'label_name', lo.label_name,
                  'label_color', lo.label_color
                )
              )
              FROM cc_label_options lo
              WHERE lo.column_id = cc.id
            ) as labels_list
          FROM cc_custom_columns cc
          LEFT JOIN cc_column_configurations cf ON cf.column_id = cc.id
          WHERE cc.project_id = $1
        )
        SELECT
          json_agg(
            json_build_object(
              'key', cd.key,
              'id', cd.id,
              'name', cd.name,
              'width', cd.width,
              'pinned', cd.is_visible,
              'custom_column', true,
              'custom_column_obj', json_build_object(
                'fieldType', cd.field_type,
                'fieldTitle', cd.field_title,
                'numberType', cd.number_type,
                'decimals', cd.decimals,
                'label', cd.label,
                'labelPosition', cd.label_position,
                'previewValue', cd.preview_value,
                'expression', cd.expression,
                'firstNumericColumnKey', cd.first_numeric_column_key,
                'secondNumericColumnKey', cd.second_numeric_column_key,
                'selectionsList', COALESCE(cd.selections_list, '[]'::json),
                'labelsList', COALESCE(cd.labels_list, '[]'::json)
              )
            )
          ) as columns
        FROM column_data cd;
      `;
      const sqlResult = await db.query(q, [testProjectId]);
      const sqlData = sqlResult.rows[0]?.columns || [];

      // Prisma Implementation
      const prismaData = await customColumnsService.getProjectColumns({
        project_id: testProjectId
      });

      // Validate structure
      expect(prismaData).toHaveLength(sqlData.length);
      expect(prismaData[0].key).toBe(sqlData[0].key);
      expect(prismaData[0].name).toBe(sqlData[0].name);
      expect(prismaData[0].custom_column).toBe(true);
      expect(prismaData[0].custom_column_obj.fieldType).toBe(sqlData[0].custom_column_obj.fieldType);
      expect(prismaData[0].custom_column_obj.selectionsList).toHaveLength(
        sqlData[0].custom_column_obj.selectionsList.length
      );

      // Cleanup
      await db.query('DELETE FROM cc_custom_columns WHERE id = $1', [createdColumn.id]);
    });
  });
});
