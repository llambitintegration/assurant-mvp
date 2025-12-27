/**
 * Resource Test Fixtures
 * Provides mock resource data for testing
 */

/**
 * Base resource properties shared by all resources
 */
const baseResourceProps = {
  team_id: 'team-1-uuid',
  is_active: true,
  created_at: new Date('2024-01-01T00:00:00Z'),
  updated_at: new Date('2024-01-01T00:00:00Z'),
  created_by: 'user-1-uuid',
  notes: null,
};

/**
 * Create a mock personnel resource
 */
export function createMockPersonnel(overrides: any = {}): any {
  return {
    id: 'resource-1-uuid',
    resource_type: 'personnel' as const,
    first_name: 'John',
    last_name: 'Doe',
    email: 'john.doe@example.com',
    phone: '+1-555-0100',
    employee_id: 'EMP001',
    equipment_name: null,
    model: null,
    serial_number: null,
    department_assignments: [],
    ...baseResourceProps,
    ...overrides,
  };
}

/**
 * Create a mock equipment resource
 */
export function createMockEquipment(overrides: any = {}): any {
  return {
    id: 'equipment-1-uuid',
    resource_type: 'equipment' as const,
    first_name: null,
    last_name: null,
    email: null,
    phone: null,
    employee_id: null,
    equipment_name: 'Laptop Dell XPS 15',
    model: 'XPS 15 9530',
    serial_number: 'SN123456789',
    department_assignments: [],
    ...baseResourceProps,
    ...overrides,
  };
}

/**
 * Create a list of mock personnel resources
 */
export function createMockResourceList(count: number, type: 'personnel' | 'equipment' = 'personnel'): any[] {
  return Array.from({ length: count }, (_, i) => {
    if (type === 'personnel') {
      return createMockPersonnel({
        id: `resource-${i + 1}-uuid`,
        first_name: `Person${i + 1}`,
        last_name: `Last${i + 1}`,
        email: `person${i + 1}@example.com`,
        employee_id: `EMP${String(i + 1).padStart(3, '0')}`,
      });
    } else {
      return createMockEquipment({
        id: `equipment-${i + 1}-uuid`,
        equipment_name: `Equipment ${i + 1}`,
        model: `Model ${i + 1}`,
        serial_number: `SN${String(i + 1).padStart(9, '0')}`,
      });
    }
  });
}

/**
 * Create a resource with department assignment
 */
export function createMockResourceWithDepartment(departmentId: string, departmentName: string, overrides: any = {}): any {
  const resource = createMockPersonnel(overrides);
  resource.department_assignments = [
    {
      id: 'assignment-1-uuid',
      resource_id: resource.id,
      department_id: departmentId,
      is_primary: true,
      assigned_at: new Date('2024-01-01T00:00:00Z'),
      assigned_by: 'user-1-uuid',
      department: {
        id: departmentId,
        name: departmentName,
      },
    },
  ];
  return resource;
}

/**
 * Create a mix of personnel and equipment resources
 */
export function createMixedResourceList(personnelCount: number, equipmentCount: number): any[] {
  const personnel = createMockResourceList(personnelCount, 'personnel');
  const equipment = createMockResourceList(equipmentCount, 'equipment');
  return [...personnel, ...equipment];
}

/**
 * Create a part-time personnel resource (for availability testing)
 */
export function createPartTimePersonnel(overrides: any = {}): any {
  return createMockPersonnel({
    id: 'part-time-resource-uuid',
    first_name: 'Jane',
    last_name: 'Smith',
    email: 'jane.smith@example.com',
    employee_id: 'EMP002',
    ...overrides,
  });
}

/**
 * Create a full-time personnel resource (for availability testing)
 */
export function createFullTimePersonnel(overrides: any = {}): any {
  return createMockPersonnel({
    id: 'full-time-resource-uuid',
    first_name: 'Bob',
    last_name: 'Johnson',
    email: 'bob.johnson@example.com',
    employee_id: 'EMP003',
    ...overrides,
  });
}
