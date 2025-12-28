/**
 * Storage Location Test Fixtures
 * Provides mock storage location data for testing with hierarchical relationships
 */

/**
 * Base location properties shared by all locations
 */
const baseLocationProps = {
  team_id: 'team-1-uuid',
  is_active: true,
  created_at: new Date('2024-01-01T00:00:00Z'),
  updated_at: new Date('2024-01-01T00:00:00Z'),
  created_by: 'user-1-uuid',
};

/**
 * Create a mock storage location
 */
export function createMockLocation(overrides: any = {}): any {
  return {
    id: 'location-1-uuid',
    location_code: 'WH-A-01',
    location_name: 'Warehouse A - Aisle 1',
    parent_location_id: null,
    description: 'Main warehouse aisle 1',
    notes: null,
    ...baseLocationProps,
    ...overrides,
  };
}

/**
 * Create a root-level location (no parent)
 */
export function createRootLocation(overrides: any = {}): any {
  return createMockLocation({
    id: 'location-root-uuid',
    location_code: 'WH-MAIN',
    location_name: 'Main Warehouse',
    parent_location_id: null,
    description: 'Primary warehouse facility',
    ...overrides,
  });
}

/**
 * Create a child location with a parent
 */
export function createChildLocation(parentId: string, overrides: any = {}): any {
  return createMockLocation({
    id: 'location-child-uuid',
    location_code: 'WH-A-01-R1',
    location_name: 'Warehouse A - Aisle 1 - Rack 1',
    parent_location_id: parentId,
    description: 'First rack in aisle 1',
    ...overrides,
  });
}

/**
 * Create a hierarchical location structure (3 levels deep)
 */
export function createLocationHierarchy(): any[] {
  const warehouse = createMockLocation({
    id: 'location-warehouse-uuid',
    location_code: 'WH-001',
    location_name: 'Main Warehouse',
    parent_location_id: null,
    description: 'Main warehouse building',
  });

  const aisle = createMockLocation({
    id: 'location-aisle-uuid',
    location_code: 'WH-001-A1',
    location_name: 'Aisle A1',
    parent_location_id: warehouse.id,
    description: 'Aisle A1 in main warehouse',
  });

  const rack = createMockLocation({
    id: 'location-rack-uuid',
    location_code: 'WH-001-A1-R01',
    location_name: 'Rack 01',
    parent_location_id: aisle.id,
    description: 'Rack 01 in Aisle A1',
  });

  const shelf = createMockLocation({
    id: 'location-shelf-uuid',
    location_code: 'WH-001-A1-R01-S1',
    location_name: 'Shelf 1',
    parent_location_id: rack.id,
    description: 'Top shelf in Rack 01',
  });

  return [warehouse, aisle, rack, shelf];
}

/**
 * Create a list of sibling locations (same parent)
 */
export function createSiblingLocations(parentId: string | null, count: number): any[] {
  return Array.from({ length: count }, (_, i) => {
    return createMockLocation({
      id: `location-sibling-${i + 1}-uuid`,
      location_code: `LOC-${String(i + 1).padStart(3, '0')}`,
      location_name: `Location ${i + 1}`,
      parent_location_id: parentId,
      description: `Storage location ${i + 1}`,
    });
  });
}

/**
 * Create locations that would form a circular reference (for validation testing)
 */
export function createCircularReferenceLocations(): any[] {
  const location1 = createMockLocation({
    id: 'location-circular-1-uuid',
    location_code: 'CIR-001',
    location_name: 'Circular Location 1',
    parent_location_id: 'location-circular-3-uuid', // Points to location 3
  });

  const location2 = createMockLocation({
    id: 'location-circular-2-uuid',
    location_code: 'CIR-002',
    location_name: 'Circular Location 2',
    parent_location_id: location1.id, // Points to location 1
  });

  const location3 = createMockLocation({
    id: 'location-circular-3-uuid',
    location_code: 'CIR-003',
    location_name: 'Circular Location 3',
    parent_location_id: location2.id, // Points to location 2, creating a circle
  });

  return [location1, location2, location3];
}

/**
 * Create an inactive location (soft deleted)
 */
export function createInactiveLocation(overrides: any = {}): any {
  return createMockLocation({
    id: 'location-inactive-uuid',
    location_code: 'OLD-LOC-001',
    location_name: 'Decommissioned Storage',
    is_active: false,
    updated_at: new Date('2024-06-01T00:00:00Z'),
    ...overrides,
  });
}

/**
 * Create locations for different teams (for multi-tenancy testing)
 */
export function createLocationsForMultipleTeams(teamIds: string[]): any[] {
  return teamIds.map((teamId, i) => {
    return createMockLocation({
      id: `location-team-${i + 1}-uuid`,
      team_id: teamId,
      location_code: `TEAM${i + 1}-WH-001`,
      location_name: `Team ${i + 1} Warehouse`,
      parent_location_id: null,
    });
  });
}

/**
 * Create a location with complete information
 */
export function createLocationWithFullDetails(overrides: any = {}): any {
  return createMockLocation({
    id: 'location-full-details-uuid',
    location_code: 'WH-A-01-R05-S3',
    location_name: 'Warehouse A - Aisle 1 - Rack 5 - Shelf 3',
    description: 'High-security storage for sensitive components',
    notes: 'Temperature controlled, requires badge access',
    ...overrides,
  });
}

/**
 * Create a location with minimal information
 */
export function createMinimalLocation(overrides: any = {}): any {
  return createMockLocation({
    id: 'location-minimal-uuid',
    location_code: 'MIN-001',
    location_name: 'Minimal Location',
    parent_location_id: null,
    description: null,
    notes: null,
    ...overrides,
  });
}

/**
 * Create complex multi-level location tree
 */
export function createComplexLocationTree(): any[] {
  const building = createMockLocation({
    id: 'building-uuid',
    location_code: 'BLDG-001',
    location_name: 'Building 1',
    parent_location_id: null,
  });

  const floor1 = createMockLocation({
    id: 'floor1-uuid',
    location_code: 'BLDG-001-F1',
    location_name: 'Floor 1',
    parent_location_id: building.id,
  });

  const floor2 = createMockLocation({
    id: 'floor2-uuid',
    location_code: 'BLDG-001-F2',
    location_name: 'Floor 2',
    parent_location_id: building.id,
  });

  const room101 = createMockLocation({
    id: 'room101-uuid',
    location_code: 'BLDG-001-F1-R101',
    location_name: 'Room 101',
    parent_location_id: floor1.id,
  });

  const room102 = createMockLocation({
    id: 'room102-uuid',
    location_code: 'BLDG-001-F1-R102',
    location_name: 'Room 102',
    parent_location_id: floor1.id,
  });

  const room201 = createMockLocation({
    id: 'room201-uuid',
    location_code: 'BLDG-001-F2-R201',
    location_name: 'Room 201',
    parent_location_id: floor2.id,
  });

  return [building, floor1, floor2, room101, room102, room201];
}

/**
 * Create duplicate location codes (same code, different teams) for unique constraint testing
 */
export function createDuplicateLocationCodes(): any[] {
  return [
    createMockLocation({
      id: 'location-dup-1-uuid',
      team_id: 'team-1-uuid',
      location_code: 'DUP-001',
      location_name: 'Duplicate Code Location 1',
    }),
    createMockLocation({
      id: 'location-dup-2-uuid',
      team_id: 'team-2-uuid',
      location_code: 'DUP-001', // Same code, different team - should be allowed
      location_name: 'Duplicate Code Location 2',
    }),
  ];
}
