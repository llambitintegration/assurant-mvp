/**
 * QR Service Unit Tests
 * Tests for QR code generation and component lookup with comprehensive coverage
 */

// Mock QRCode library (must be before imports)
jest.mock('qrcode', () => ({
  __esModule: true,
  toDataURL: jest.fn()
}));

// Mock the Prisma client (must be before imports)
jest.mock('../../../../config/prisma', () => ({
  __esModule: true,
  default: {
    inv_components: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn()
    }
  }
}));

// Unmock modules we need to test
jest.unmock('../../../../services/inv/qr-service');
jest.unmock('@prisma/client');
jest.unmock('../../../fixtures/inv/component-fixtures');

import * as QRCode from 'qrcode';
import {
  generateQRCodeForComponent,
  lookupComponentByQR,
  IQRCodeData
} from '../../../../services/inv/qr-service';
import prisma from '../../../../config/prisma';
import {
  createMockComponentWithSupplier,
  createMockComponentWithLocation,
  createComponentWithQRCode,
  createInactiveComponent
} from '../../../fixtures/inv/component-fixtures';

// Get reference to the mocked libraries
const mockQRCode = QRCode as jest.Mocked<typeof QRCode>;
const mockPrismaClient = prisma as jest.Mocked<typeof prisma>;

describe('QR Service', () => {
  const TEAM_ID = 'team-1-uuid';
  const OTHER_TEAM_ID = 'team-2-uuid';
  const COMPONENT_ID = 'component-1-uuid';

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  describe('generateQRCodeForComponent', () => {
    it('should generate QR code successfully for valid component', async () => {
      const mockComponent = createMockComponentWithSupplier({
        id: COMPONENT_ID,
        name: 'Test Component',
        sku: 'TEST-SKU-001',
        team_id: TEAM_ID
      });

      const mockQRDataURL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA';

      mockPrismaClient.inv_components.findFirst.mockResolvedValue(mockComponent as any);
      mockQRCode.toDataURL.mockResolvedValue(mockQRDataURL);

      const result = await generateQRCodeForComponent(COMPONENT_ID, TEAM_ID);

      // Verify component was looked up with team scoping
      expect(mockPrismaClient.inv_components.findFirst).toHaveBeenCalledWith({
        where: {
          id: COMPONENT_ID,
          team_id: TEAM_ID
        }
      });

      // Verify QR code data format
      const parsedData = JSON.parse(result.qr_code_data);
      expect(parsedData).toEqual({
        id: COMPONENT_ID,
        name: 'Test Component',
        sku: 'TEST-SKU-001',
        team_id: TEAM_ID,
        type: 'inventory_component'
      });

      // Verify QR code image is returned
      expect(result.qr_code_image).toBe(mockQRDataURL);

      // Verify QRCode.toDataURL was called with correct options
      expect(mockQRCode.toDataURL).toHaveBeenCalledWith(
        result.qr_code_data,
        {
          errorCorrectionLevel: 'H',
          type: 'image/png',
          quality: 0.92,
          margin: 1,
          width: 256
        }
      );
    });

    it('should generate QR code for component with null SKU', async () => {
      const mockComponent = createMockComponentWithSupplier({
        id: COMPONENT_ID,
        name: 'Component Without SKU',
        sku: null,
        team_id: TEAM_ID
      });

      const mockQRDataURL = 'data:image/png;base64,ABC123';

      mockPrismaClient.inv_components.findFirst.mockResolvedValue(mockComponent as any);
      mockQRCode.toDataURL.mockResolvedValue(mockQRDataURL);

      const result = await generateQRCodeForComponent(COMPONENT_ID, TEAM_ID);

      const parsedData = JSON.parse(result.qr_code_data);
      expect(parsedData.sku).toBeNull();
      expect(parsedData.type).toBe('inventory_component');
    });

    it('should generate QR code for component owned by storage location', async () => {
      const mockComponent = createMockComponentWithLocation({
        id: COMPONENT_ID,
        name: 'Location Component',
        sku: 'LOC-SKU-001',
        team_id: TEAM_ID
      });

      const mockQRDataURL = 'data:image/png;base64,XYZ789';

      mockPrismaClient.inv_components.findFirst.mockResolvedValue(mockComponent as any);
      mockQRCode.toDataURL.mockResolvedValue(mockQRDataURL);

      const result = await generateQRCodeForComponent(COMPONENT_ID, TEAM_ID);

      expect(result.qr_code_data).toBeDefined();
      expect(result.qr_code_image).toBe(mockQRDataURL);
    });

    it('should throw error when component not found', async () => {
      mockPrismaClient.inv_components.findFirst.mockResolvedValue(null);

      await expect(generateQRCodeForComponent('non-existent-uuid', TEAM_ID))
        .rejects.toThrow('Component not found or does not belong to this team');

      expect(mockQRCode.toDataURL).not.toHaveBeenCalled();
    });

    it('should throw error when component belongs to different team', async () => {
      mockPrismaClient.inv_components.findFirst.mockResolvedValue(null);

      await expect(generateQRCodeForComponent(COMPONENT_ID, OTHER_TEAM_ID))
        .rejects.toThrow('Component not found or does not belong to this team');

      expect(mockPrismaClient.inv_components.findFirst).toHaveBeenCalledWith({
        where: {
          id: COMPONENT_ID,
          team_id: OTHER_TEAM_ID
        }
      });

      expect(mockQRCode.toDataURL).not.toHaveBeenCalled();
    });

    it('should throw error when QRCode library fails', async () => {
      const mockComponent = createMockComponentWithSupplier({
        id: COMPONENT_ID,
        team_id: TEAM_ID
      });

      mockPrismaClient.inv_components.findFirst.mockResolvedValue(mockComponent as any);
      mockQRCode.toDataURL.mockRejectedValue(new Error('QR generation failed'));

      await expect(generateQRCodeForComponent(COMPONENT_ID, TEAM_ID))
        .rejects.toThrow('Failed to generate QR code: QR generation failed');
    });

    it('should handle QRCode library throwing non-Error objects', async () => {
      const mockComponent = createMockComponentWithSupplier({
        id: COMPONENT_ID,
        team_id: TEAM_ID
      });

      mockPrismaClient.inv_components.findFirst.mockResolvedValue(mockComponent as any);
      mockQRCode.toDataURL.mockRejectedValue('String error');

      await expect(generateQRCodeForComponent(COMPONENT_ID, TEAM_ID))
        .rejects.toThrow('Failed to generate QR code: Unknown error');
    });

    it('should generate valid data URL format', async () => {
      const mockComponent = createMockComponentWithSupplier({
        id: COMPONENT_ID,
        team_id: TEAM_ID
      });

      const mockQRDataURL = 'data:image/png;base64,ValidBase64String==';

      mockPrismaClient.inv_components.findFirst.mockResolvedValue(mockComponent as any);
      mockQRCode.toDataURL.mockResolvedValue(mockQRDataURL);

      const result = await generateQRCodeForComponent(COMPONENT_ID, TEAM_ID);

      expect(result.qr_code_image).toMatch(/^data:image\/png;base64,/);
    });

    it('should work with inactive components', async () => {
      const mockComponent = createInactiveComponent({
        id: COMPONENT_ID,
        team_id: TEAM_ID,
        is_active: false
      });

      const mockQRDataURL = 'data:image/png;base64,InactiveComponent';

      mockPrismaClient.inv_components.findFirst.mockResolvedValue(mockComponent as any);
      mockQRCode.toDataURL.mockResolvedValue(mockQRDataURL);

      const result = await generateQRCodeForComponent(COMPONENT_ID, TEAM_ID);

      expect(result.qr_code_data).toBeDefined();
      expect(result.qr_code_image).toBe(mockQRDataURL);
    });
  });

  describe('lookupComponentByQR', () => {
    it('should lookup component successfully from valid QR data', async () => {
      const qrData: IQRCodeData = {
        id: COMPONENT_ID,
        name: 'Test Component',
        sku: 'TEST-SKU-001',
        team_id: TEAM_ID,
        type: 'inventory_component'
      };

      const qrDataString = JSON.stringify(qrData);

      const mockComponent = createMockComponentWithSupplier({
        id: COMPONENT_ID,
        name: 'Test Component',
        sku: 'TEST-SKU-001',
        team_id: TEAM_ID
      });

      mockPrismaClient.inv_components.findFirst.mockResolvedValue(mockComponent as any);

      const result = await lookupComponentByQR(qrDataString, TEAM_ID);

      expect(result).toEqual(mockComponent);
      expect(mockPrismaClient.inv_components.findFirst).toHaveBeenCalledWith({
        where: {
          id: COMPONENT_ID,
          team_id: TEAM_ID
        }
      });
    });

    it('should return null when component not found', async () => {
      const qrData: IQRCodeData = {
        id: 'non-existent-uuid',
        name: 'Missing Component',
        sku: 'MISSING-SKU',
        team_id: TEAM_ID,
        type: 'inventory_component'
      };

      const qrDataString = JSON.stringify(qrData);

      mockPrismaClient.inv_components.findFirst.mockResolvedValue(null);

      const result = await lookupComponentByQR(qrDataString, TEAM_ID);

      expect(result).toBeNull();
    });

    it('should throw error for malformed JSON', async () => {
      const invalidJSON = 'not-valid-json{';

      await expect(lookupComponentByQR(invalidJSON, TEAM_ID))
        .rejects.toThrow('Invalid QR code data: malformed JSON');

      expect(mockPrismaClient.inv_components.findFirst).not.toHaveBeenCalled();
    });

    it('should throw error when id field is missing', async () => {
      const qrData = {
        name: 'Test Component',
        sku: 'TEST-SKU-001',
        team_id: TEAM_ID,
        type: 'inventory_component'
        // Missing 'id' field
      };

      const qrDataString = JSON.stringify(qrData);

      await expect(lookupComponentByQR(qrDataString, TEAM_ID))
        .rejects.toThrow('Invalid QR code data: missing required fields');

      expect(mockPrismaClient.inv_components.findFirst).not.toHaveBeenCalled();
    });

    it('should throw error when team_id field is missing', async () => {
      const qrData = {
        id: COMPONENT_ID,
        name: 'Test Component',
        sku: 'TEST-SKU-001',
        type: 'inventory_component'
        // Missing 'team_id' field
      };

      const qrDataString = JSON.stringify(qrData);

      await expect(lookupComponentByQR(qrDataString, TEAM_ID))
        .rejects.toThrow('Invalid QR code data: missing required fields');

      expect(mockPrismaClient.inv_components.findFirst).not.toHaveBeenCalled();
    });

    it('should throw error when type field is missing', async () => {
      const qrData = {
        id: COMPONENT_ID,
        name: 'Test Component',
        sku: 'TEST-SKU-001',
        team_id: TEAM_ID
        // Missing 'type' field
      };

      const qrDataString = JSON.stringify(qrData);

      await expect(lookupComponentByQR(qrDataString, TEAM_ID))
        .rejects.toThrow('Invalid QR code data: missing required fields');
    });

    it('should throw error when type is not "inventory_component"', async () => {
      const qrData = {
        id: COMPONENT_ID,
        name: 'Test Component',
        sku: 'TEST-SKU-001',
        team_id: TEAM_ID,
        type: 'asset'
      };

      const qrDataString = JSON.stringify(qrData);

      await expect(lookupComponentByQR(qrDataString, TEAM_ID))
        .rejects.toThrow("Invalid QR code type: expected 'inventory_component', got 'asset'");

      expect(mockPrismaClient.inv_components.findFirst).not.toHaveBeenCalled();
    });

    it('should throw error when team_id does not match (security check)', async () => {
      const qrData: IQRCodeData = {
        id: COMPONENT_ID,
        name: 'Test Component',
        sku: 'TEST-SKU-001',
        team_id: OTHER_TEAM_ID, // Different team
        type: 'inventory_component'
      };

      const qrDataString = JSON.stringify(qrData);

      await expect(lookupComponentByQR(qrDataString, TEAM_ID))
        .rejects.toThrow('QR code does not belong to this team');

      expect(mockPrismaClient.inv_components.findFirst).not.toHaveBeenCalled();
    });

    it('should lookup component with null SKU', async () => {
      const qrData: IQRCodeData = {
        id: COMPONENT_ID,
        name: 'Component Without SKU',
        sku: null,
        team_id: TEAM_ID,
        type: 'inventory_component'
      };

      const qrDataString = JSON.stringify(qrData);

      const mockComponent = createMockComponentWithSupplier({
        id: COMPONENT_ID,
        sku: null,
        team_id: TEAM_ID
      });

      mockPrismaClient.inv_components.findFirst.mockResolvedValue(mockComponent as any);

      const result = await lookupComponentByQR(qrDataString, TEAM_ID);

      expect(result).toEqual(mockComponent);
    });

    it('should work with components owned by storage location', async () => {
      const qrData: IQRCodeData = {
        id: COMPONENT_ID,
        name: 'Location Component',
        sku: 'LOC-SKU-001',
        team_id: TEAM_ID,
        type: 'inventory_component'
      };

      const qrDataString = JSON.stringify(qrData);

      const mockComponent = createMockComponentWithLocation({
        id: COMPONENT_ID,
        team_id: TEAM_ID
      });

      mockPrismaClient.inv_components.findFirst.mockResolvedValue(mockComponent as any);

      const result = await lookupComponentByQR(qrDataString, TEAM_ID);

      expect(result).toEqual(mockComponent);
    });

    it('should find inactive components (deleted)', async () => {
      const qrData: IQRCodeData = {
        id: COMPONENT_ID,
        name: 'Inactive Component',
        sku: 'INACTIVE-SKU',
        team_id: TEAM_ID,
        type: 'inventory_component'
      };

      const qrDataString = JSON.stringify(qrData);

      const mockComponent = createInactiveComponent({
        id: COMPONENT_ID,
        team_id: TEAM_ID,
        is_active: false
      });

      mockPrismaClient.inv_components.findFirst.mockResolvedValue(mockComponent as any);

      const result = await lookupComponentByQR(qrDataString, TEAM_ID);

      expect(result).toEqual(mockComponent);
    });

    it('should handle empty JSON object', async () => {
      const qrDataString = JSON.stringify({});

      await expect(lookupComponentByQR(qrDataString, TEAM_ID))
        .rejects.toThrow('Invalid QR code data: missing required fields');
    });

    it('should handle JSON array instead of object', async () => {
      const qrDataString = JSON.stringify([COMPONENT_ID, TEAM_ID]);

      await expect(lookupComponentByQR(qrDataString, TEAM_ID))
        .rejects.toThrow('Invalid QR code data: missing required fields');
    });

    it('should handle whitespace-only strings', async () => {
      const qrDataString = '   ';

      await expect(lookupComponentByQR(qrDataString, TEAM_ID))
        .rejects.toThrow('Invalid QR code data: malformed JSON');
    });

    it('should handle empty string', async () => {
      const qrDataString = '';

      await expect(lookupComponentByQR(qrDataString, TEAM_ID))
        .rejects.toThrow('Invalid QR code data: malformed JSON');
    });

    it('should validate team scoping on lookup', async () => {
      const qrData: IQRCodeData = {
        id: COMPONENT_ID,
        name: 'Test Component',
        sku: 'TEST-SKU-001',
        team_id: TEAM_ID,
        type: 'inventory_component'
      };

      const qrDataString = JSON.stringify(qrData);

      mockPrismaClient.inv_components.findFirst.mockResolvedValue(null);

      await lookupComponentByQR(qrDataString, TEAM_ID);

      expect(mockPrismaClient.inv_components.findFirst).toHaveBeenCalledWith({
        where: {
          id: COMPONENT_ID,
          team_id: TEAM_ID
        }
      });
    });
  });

  describe('Integration Tests', () => {
    it('should generate and lookup same component successfully', async () => {
      const mockComponent = createMockComponentWithSupplier({
        id: COMPONENT_ID,
        name: 'Round-Trip Component',
        sku: 'ROUND-TRIP-001',
        team_id: TEAM_ID
      });

      const mockQRDataURL = 'data:image/png;base64,RoundTrip==';

      // Generate QR code
      mockPrismaClient.inv_components.findFirst.mockResolvedValue(mockComponent as any);
      mockQRCode.toDataURL.mockResolvedValue(mockQRDataURL);

      const generated = await generateQRCodeForComponent(COMPONENT_ID, TEAM_ID);

      // Lookup using generated QR data
      mockPrismaClient.inv_components.findFirst.mockResolvedValue(mockComponent as any);

      const lookedUp = await lookupComponentByQR(generated.qr_code_data, TEAM_ID);

      expect(lookedUp).toEqual(mockComponent);
    });

    it('should enforce team isolation on generate and lookup', async () => {
      const mockComponent = createMockComponentWithSupplier({
        id: COMPONENT_ID,
        team_id: TEAM_ID
      });

      // Generate for team 1
      mockPrismaClient.inv_components.findFirst.mockResolvedValue(mockComponent as any);
      mockQRCode.toDataURL.mockResolvedValue('data:image/png;base64,Team1');

      const generated = await generateQRCodeForComponent(COMPONENT_ID, TEAM_ID);

      // Try to lookup from team 2 (should fail)
      await expect(lookupComponentByQR(generated.qr_code_data, OTHER_TEAM_ID))
        .rejects.toThrow('QR code does not belong to this team');
    });
  });

  describe('Edge Cases', () => {
    it('should handle component with special characters in name', async () => {
      const mockComponent = createMockComponentWithSupplier({
        id: COMPONENT_ID,
        name: 'Component with "quotes" & symbols!',
        sku: 'SPECIAL-001',
        team_id: TEAM_ID
      });

      const mockQRDataURL = 'data:image/png;base64,Special==';

      mockPrismaClient.inv_components.findFirst.mockResolvedValue(mockComponent as any);
      mockQRCode.toDataURL.mockResolvedValue(mockQRDataURL);

      const result = await generateQRCodeForComponent(COMPONENT_ID, TEAM_ID);

      const parsedData = JSON.parse(result.qr_code_data);
      expect(parsedData.name).toBe('Component with "quotes" & symbols!');
    });

    it('should handle component with unicode characters', async () => {
      const mockComponent = createMockComponentWithSupplier({
        id: COMPONENT_ID,
        name: 'Résistor 日本語 🔧',
        sku: 'UNICODE-001',
        team_id: TEAM_ID
      });

      const mockQRDataURL = 'data:image/png;base64,Unicode==';

      mockPrismaClient.inv_components.findFirst.mockResolvedValue(mockComponent as any);
      mockQRCode.toDataURL.mockResolvedValue(mockQRDataURL);

      const result = await generateQRCodeForComponent(COMPONENT_ID, TEAM_ID);

      const parsedData = JSON.parse(result.qr_code_data);
      expect(parsedData.name).toBe('Résistor 日本語 🔧');
    });

    it('should handle very long component names', async () => {
      const longName = 'A'.repeat(200); // Max length from schema
      const mockComponent = createMockComponentWithSupplier({
        id: COMPONENT_ID,
        name: longName,
        team_id: TEAM_ID
      });

      const mockQRDataURL = 'data:image/png;base64,LongName==';

      mockPrismaClient.inv_components.findFirst.mockResolvedValue(mockComponent as any);
      mockQRCode.toDataURL.mockResolvedValue(mockQRDataURL);

      const result = await generateQRCodeForComponent(COMPONENT_ID, TEAM_ID);

      const parsedData = JSON.parse(result.qr_code_data);
      expect(parsedData.name).toBe(longName);
    });

    it('should handle very long SKUs', async () => {
      const longSKU = 'SKU-' + 'X'.repeat(96); // Max 100 chars from schema
      const mockComponent = createMockComponentWithSupplier({
        id: COMPONENT_ID,
        sku: longSKU,
        team_id: TEAM_ID
      });

      const mockQRDataURL = 'data:image/png;base64,LongSKU==';

      mockPrismaClient.inv_components.findFirst.mockResolvedValue(mockComponent as any);
      mockQRCode.toDataURL.mockResolvedValue(mockQRDataURL);

      const result = await generateQRCodeForComponent(COMPONENT_ID, TEAM_ID);

      const parsedData = JSON.parse(result.qr_code_data);
      expect(parsedData.sku).toBe(longSKU);
    });
  });
});
