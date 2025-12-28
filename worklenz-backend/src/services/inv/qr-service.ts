/**
 * QR Code Service
 * Handles business logic for QR code generation and lookup for inventory components
 */

import * as QRCode from 'qrcode';
import prisma from "../../config/prisma";
import { IComponent } from "../../interfaces/inv/component.interface";

/**
 * QR Code Data Structure
 * This data is encoded as JSON string in the QR code
 */
export interface IQRCodeData {
  id: string;
  name: string;
  sku: string | null;
  team_id: string;
  type: 'inventory_component';
}

/**
 * Generate QR code for a component
 * Returns base64 data URL: data:image/png;base64,...
 */
export async function generateQRCodeForComponent(
  componentId: string,
  teamId: string
): Promise<{ qr_code_data: string; qr_code_image: string }> {
  // Validate component exists and belongs to team
  const component = await prisma.inv_components.findFirst({
    where: {
      id: componentId,
      team_id: teamId
    }
  });

  if (!component) {
    throw new Error("Component not found or does not belong to this team");
  }

  // Build QR code data payload
  const qrData: IQRCodeData = {
    id: component.id,
    name: component.name,
    sku: component.sku,
    team_id: component.team_id,
    type: 'inventory_component'
  };

  // Convert to JSON string
  const qrDataString = JSON.stringify(qrData);

  try {
    // Generate QR code as base64 data URL
    const qrCodeImage = await QRCode.toDataURL(qrDataString, {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 256
    });

    return {
      qr_code_data: qrDataString,
      qr_code_image: qrCodeImage
    };
  } catch (error) {
    throw new Error(`Failed to generate QR code: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Lookup component from QR code data
 * Returns component details or null if not found/invalid
 */
export async function lookupComponentByQR(
  qrCodeData: string,
  teamId: string
): Promise<IComponent | null> {
  // Parse QR code data
  let parsedData: IQRCodeData;
  try {
    parsedData = JSON.parse(qrCodeData);
  } catch (error) {
    throw new Error("Invalid QR code data: malformed JSON");
  }

  // Validate required fields
  if (!parsedData.id || !parsedData.team_id || !parsedData.type) {
    throw new Error("Invalid QR code data: missing required fields");
  }

  // Validate type
  if (parsedData.type !== 'inventory_component') {
    throw new Error(`Invalid QR code type: expected 'inventory_component', got '${parsedData.type}'`);
  }

  // Validate team_id matches (security check)
  if (parsedData.team_id !== teamId) {
    throw new Error("QR code does not belong to this team");
  }

  // Lookup component by ID
  const component = await prisma.inv_components.findFirst({
    where: {
      id: parsedData.id,
      team_id: teamId
    }
  });

  return component;
}
