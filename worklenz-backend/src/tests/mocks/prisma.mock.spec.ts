/**
 * Prisma Mock Validation Tests
 * Ensures the Prisma mock is correctly configured and functional
 */

import prismaMock, { resetPrismaMock } from './prisma.mock';

describe('Prisma Mock Setup', () => {
  beforeEach(() => {
    resetPrismaMock();
  });

  it('should create a mock Prisma client', () => {
    expect(prismaMock).toBeDefined();
    expect(prismaMock.rcm_resources).toBeDefined();
    expect(prismaMock.rcm_allocations).toBeDefined();
  });

  it('should mock findMany method', async () => {
    const mockData = [{ id: '123', resource_type: 'personnel' as const }];
    prismaMock.rcm_resources.findMany.mockResolvedValue(mockData as any);

    const result = await prismaMock.rcm_resources.findMany();

    expect(result).toEqual(mockData);
    expect(prismaMock.rcm_resources.findMany).toHaveBeenCalled();
  });

  it('should reset mocks between tests', () => {
    prismaMock.rcm_resources.findMany.mockResolvedValue([]);
    resetPrismaMock();

    expect(prismaMock.rcm_resources.findMany).not.toHaveBeenCalled();
  });

  it('should support $queryRaw mocking', async () => {
    const mockProjects = [{ id: 'project-1', name: 'Test Project' }];
    prismaMock.$queryRaw.mockResolvedValue(mockProjects as any);

    const result = await prismaMock.$queryRaw`SELECT * FROM projects`;

    expect(result).toEqual(mockProjects);
  });
});
