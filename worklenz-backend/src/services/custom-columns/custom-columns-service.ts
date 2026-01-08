/**
 * Custom Columns Service
 * Handles custom column management using Prisma ORM
 *
 * This service replaces SQL queries in custom-columns-controller.ts with Prisma implementations
 * Includes complex transaction support for multi-table operations
 * All methods are validated against contract tests to ensure behavioral parity
 */

import prisma from '../../config/prisma';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';

/**
 * Selection option for custom columns
 */
export interface ISelectionOption {
  selection_id: string;
  selection_name: string;
  selection_color: string;
}

/**
 * Label option for custom columns
 */
export interface ILabelOption {
  label_id: string;
  label_name: string;
  label_color: string;
}

/**
 * Column configuration data
 */
export interface IColumnConfiguration {
  field_title: string;
  field_type: string;
  number_type?: string | null;
  decimals?: number | null;
  label?: string | null;
  label_position?: string | null;
  preview_value?: string | null;
  expression?: string | null;
  first_numeric_column_key?: string | null;
  second_numeric_column_key?: string | null;
  selections_list?: ISelectionOption[];
  labels_list?: ILabelOption[];
}

/**
 * DTO for creating a custom column
 */
export interface ICreateCustomColumnDto {
  project_id: string;
  name: string;
  key: string;
  field_type: string;
  width?: number;
  is_visible?: boolean;
  configuration: IColumnConfiguration;
}

/**
 * DTO for updating a custom column
 */
export interface IUpdateCustomColumnDto {
  id: string;
  name: string;
  field_type: string;
  width: number;
  is_visible: boolean;
  configuration: IColumnConfiguration;
}

/**
 * DTO for getting custom columns
 */
export interface IGetCustomColumnsDto {
  project_id: string;
}

/**
 * DTO for getting custom column by ID
 */
export interface IGetCustomColumnByIdDto {
  id: string;
}

/**
 * DTO for deleting a custom column
 */
export interface IDeleteCustomColumnDto {
  id: string;
}

/**
 * DTO for getting project columns
 */
export interface IGetProjectColumnsDto {
  project_id: string;
}

/**
 * Custom Columns Service
 * Singleton service for managing custom columns with transaction support
 */
export class CustomColumnsService {
  private static instance: CustomColumnsService;
  private featureFlags: FeatureFlagsService;

  private constructor() {
    this.featureFlags = FeatureFlagsService.getInstance();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): CustomColumnsService {
    if (!CustomColumnsService.instance) {
      CustomColumnsService.instance = new CustomColumnsService();
    }
    return CustomColumnsService.instance;
  }

  /**
   * Create a custom column with configuration and options
   * Uses transaction to ensure atomicity across multiple tables
   *
   * Transaction includes:
   * 1. Insert cc_custom_columns
   * 2. Insert cc_column_configurations
   * 3. Insert cc_selection_options (if provided)
   * 4. Insert cc_label_options (if provided)
   */
  async createCustomColumn(data: ICreateCustomColumnDto): Promise<any> {
    return await prisma.$transaction(async (tx) => {
      // 1. Create the main custom column
      const column = await tx.cc_custom_columns.create({
        data: {
          project_id: data.project_id,
          name: data.name,
          key: data.key,
          field_type: data.field_type,
          width: data.width ?? 150,
          is_visible: data.is_visible ?? true,
          is_custom_column: true
        }
      });

      // 2. Create the column configuration
      await tx.cc_column_configurations.create({
        data: {
          column_id: column.id,
          field_title: data.configuration.field_title,
          field_type: data.configuration.field_type,
          number_type: data.configuration.number_type,
          decimals: data.configuration.decimals,
          label: data.configuration.label,
          label_position: data.configuration.label_position,
          preview_value: data.configuration.preview_value,
          expression: data.configuration.expression,
          first_numeric_column_key: data.configuration.first_numeric_column_key,
          second_numeric_column_key: data.configuration.second_numeric_column_key
        }
      });

      // 3. Create selection options if present
      if (data.configuration.selections_list && data.configuration.selections_list.length > 0) {
        await tx.cc_selection_options.createMany({
          data: data.configuration.selections_list.map((selection, index) => ({
            column_id: column.id,
            selection_id: selection.selection_id,
            selection_name: selection.selection_name,
            selection_color: selection.selection_color,
            selection_order: index
          }))
        });
      }

      // 4. Create label options if present
      if (data.configuration.labels_list && data.configuration.labels_list.length > 0) {
        await tx.cc_label_options.createMany({
          data: data.configuration.labels_list.map((label, index) => ({
            column_id: column.id,
            label_id: label.label_id,
            label_name: label.label_name,
            label_color: label.label_color,
            label_order: index
          }))
        });
      }

      // 5. Fetch the complete column data with all relations
      return await this.getCustomColumnByIdInternal(column.id, tx);
    });
  }

  /**
   * Get all custom columns for a project
   * Includes all configurations and options
   */
  async getCustomColumns(data: IGetCustomColumnsDto): Promise<any[]> {
    const columns = await prisma.cc_custom_columns.findMany({
      where: {
        project_id: data.project_id
      },
      include: {
        cc_column_configurations: {
          select: {
            field_title: true,
            field_type: true,
            number_type: true,
            decimals: true,
            label: true,
            label_position: true,
            preview_value: true,
            expression: true,
            first_numeric_column_key: true,
            second_numeric_column_key: true
          }
        },
        cc_selection_options: {
          select: {
            selection_id: true,
            selection_name: true,
            selection_color: true
          },
          orderBy: {
            selection_order: 'asc'
          }
        },
        cc_label_options: {
          select: {
            label_id: true,
            label_name: true,
            label_color: true
          },
          orderBy: {
            label_order: 'asc'
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    // Transform to match SQL output format
    return columns.map(column => this.transformColumnData(column));
  }

  /**
   * Get a custom column by ID
   */
  async getCustomColumnById(data: IGetCustomColumnByIdDto): Promise<any> {
    const column = await prisma.cc_custom_columns.findUnique({
      where: {
        id: data.id
      },
      include: {
        cc_column_configurations: {
          select: {
            field_title: true,
            field_type: true,
            number_type: true,
            decimals: true,
            label: true,
            label_position: true,
            preview_value: true,
            expression: true,
            first_numeric_column_key: true,
            second_numeric_column_key: true
          }
        },
        cc_selection_options: {
          select: {
            selection_id: true,
            selection_name: true,
            selection_color: true
          },
          orderBy: {
            selection_order: 'asc'
          }
        },
        cc_label_options: {
          select: {
            label_id: true,
            label_name: true,
            label_color: true
          },
          orderBy: {
            label_order: 'asc'
          }
        }
      }
    });

    if (!column) {
      throw new Error('Custom column not found');
    }

    return this.transformColumnData(column);
  }

  /**
   * Update a custom column
   * Uses transaction to ensure atomicity across multiple tables
   *
   * Transaction includes:
   * 1. Update cc_custom_columns
   * 2. Update cc_column_configurations
   * 3. Replace cc_selection_options (delete + insert)
   * 4. Replace cc_label_options (delete + insert)
   */
  async updateCustomColumn(data: IUpdateCustomColumnDto): Promise<any> {
    return await prisma.$transaction(async (tx) => {
      // 1. Update the main custom column
      await tx.cc_custom_columns.update({
        where: {
          id: data.id
        },
        data: {
          name: data.name,
          field_type: data.field_type,
          width: data.width,
          is_visible: data.is_visible,
          updated_at: new Date()
        }
      });

      // 2. Update the configuration
      await tx.cc_column_configurations.updateMany({
        where: {
          column_id: data.id
        },
        data: {
          field_title: data.configuration.field_title,
          field_type: data.configuration.field_type,
          number_type: data.configuration.number_type,
          decimals: data.configuration.decimals,
          label: data.configuration.label,
          label_position: data.configuration.label_position,
          preview_value: data.configuration.preview_value,
          expression: data.configuration.expression,
          first_numeric_column_key: data.configuration.first_numeric_column_key,
          second_numeric_column_key: data.configuration.second_numeric_column_key,
          updated_at: new Date()
        }
      });

      // 3. Update selections if present (delete and recreate)
      if (data.configuration.selections_list !== undefined) {
        // Delete existing selections
        await tx.cc_selection_options.deleteMany({
          where: {
            column_id: data.id
          }
        });

        // Insert new selections
        if (data.configuration.selections_list.length > 0) {
          await tx.cc_selection_options.createMany({
            data: data.configuration.selections_list.map((selection, index) => ({
              column_id: data.id,
              selection_id: selection.selection_id,
              selection_name: selection.selection_name,
              selection_color: selection.selection_color,
              selection_order: index
            }))
          });
        }
      }

      // 4. Update labels if present (delete and recreate)
      if (data.configuration.labels_list !== undefined) {
        // Delete existing labels
        await tx.cc_label_options.deleteMany({
          where: {
            column_id: data.id
          }
        });

        // Insert new labels
        if (data.configuration.labels_list.length > 0) {
          await tx.cc_label_options.createMany({
            data: data.configuration.labels_list.map((label, index) => ({
              column_id: data.id,
              label_id: label.label_id,
              label_name: label.label_name,
              label_color: label.label_color,
              label_order: index
            }))
          });
        }
      }

      // 5. Fetch the updated column data
      return await this.getCustomColumnByIdInternal(data.id, tx);
    });
  }

  /**
   * Delete a custom column by ID
   * Cascade deletes related records automatically via database constraints
   */
  async deleteCustomColumn(data: IDeleteCustomColumnDto): Promise<any> {
    return await prisma.cc_custom_columns.delete({
      where: {
        id: data.id
      }
    });
  }

  /**
   * Get project columns in a formatted structure for UI
   * Returns columns with nested configuration objects
   */
  async getProjectColumns(data: IGetProjectColumnsDto): Promise<any[]> {
    const columns = await prisma.cc_custom_columns.findMany({
      where: {
        project_id: data.project_id
      },
      include: {
        cc_column_configurations: {
          select: {
            field_title: true,
            field_type: true,
            number_type: true,
            decimals: true,
            label: true,
            label_position: true,
            preview_value: true,
            expression: true,
            first_numeric_column_key: true,
            second_numeric_column_key: true
          }
        },
        cc_selection_options: {
          select: {
            selection_id: true,
            selection_name: true,
            selection_color: true
          },
          orderBy: {
            selection_order: 'asc'
          }
        },
        cc_label_options: {
          select: {
            label_id: true,
            label_name: true,
            label_color: true
          },
          orderBy: {
            label_order: 'asc'
          }
        }
      }
    });

    // Transform to match SQL output format for UI
    return columns.map(column => ({
      key: column.key,
      id: column.id,
      name: column.name,
      width: column.width,
      pinned: column.is_visible,
      custom_column: true,
      custom_column_obj: {
        fieldType: column.field_type,
        fieldTitle: column.cc_column_configurations[0]?.field_title,
        numberType: column.cc_column_configurations[0]?.number_type,
        decimals: column.cc_column_configurations[0]?.decimals,
        label: column.cc_column_configurations[0]?.label,
        labelPosition: column.cc_column_configurations[0]?.label_position,
        previewValue: column.cc_column_configurations[0]?.preview_value,
        expression: column.cc_column_configurations[0]?.expression,
        firstNumericColumnKey: column.cc_column_configurations[0]?.first_numeric_column_key,
        secondNumericColumnKey: column.cc_column_configurations[0]?.second_numeric_column_key,
        selectionsList: column.cc_selection_options.map(s => ({
          selection_id: s.selection_id,
          selection_name: s.selection_name,
          selection_color: s.selection_color
        })),
        labelsList: column.cc_label_options.map(l => ({
          label_id: l.label_id,
          label_name: l.label_name,
          label_color: l.label_color
        }))
      }
    }));
  }

  // ===== Private Helper Methods =====

  /**
   * Internal method to get custom column by ID within a transaction
   * Used by create and update operations
   */
  private async getCustomColumnByIdInternal(id: string, tx: any): Promise<any> {
    const column = await tx.cc_custom_columns.findUnique({
      where: { id },
      include: {
        cc_column_configurations: {
          select: {
            field_title: true,
            field_type: true,
            number_type: true,
            decimals: true,
            label: true,
            label_position: true,
            preview_value: true,
            expression: true,
            first_numeric_column_key: true,
            second_numeric_column_key: true
          }
        },
        cc_selection_options: {
          select: {
            selection_id: true,
            selection_name: true,
            selection_color: true
          },
          orderBy: {
            selection_order: 'asc'
          }
        },
        cc_label_options: {
          select: {
            label_id: true,
            label_name: true,
            label_color: true
          },
          orderBy: {
            label_order: 'asc'
          }
        }
      }
    });

    if (!column) {
      throw new Error('Custom column not found');
    }

    return this.transformColumnData(column);
  }

  /**
   * Transform column data from Prisma format to SQL output format
   */
  private transformColumnData(column: any): any {
    const config = column.cc_column_configurations[0];

    return {
      id: column.id,
      project_id: column.project_id,
      name: column.name,
      key: column.key,
      field_type: column.field_type,
      width: column.width,
      is_visible: column.is_visible,
      is_custom_column: column.is_custom_column,
      created_at: column.created_at,
      updated_at: column.updated_at,
      field_title: config?.field_title,
      number_type: config?.number_type,
      decimals: config?.decimals,
      label: config?.label,
      label_position: config?.label_position,
      preview_value: config?.preview_value,
      expression: config?.expression,
      first_numeric_column_key: config?.first_numeric_column_key,
      second_numeric_column_key: config?.second_numeric_column_key,
      selections_list: column.cc_selection_options.length > 0
        ? column.cc_selection_options.map((s: any) => ({
            selection_id: s.selection_id,
            selection_name: s.selection_name,
            selection_color: s.selection_color
          }))
        : null,
      labels_list: column.cc_label_options.length > 0
        ? column.cc_label_options.map((l: any) => ({
            label_id: l.label_id,
            label_name: l.label_name,
            label_color: l.label_color
          }))
        : null
    };
  }
}

/**
 * Convenience function to get custom columns service instance
 */
export function getCustomColumnsService(): CustomColumnsService {
  return CustomColumnsService.getInstance();
}
