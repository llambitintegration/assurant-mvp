-- Migration: Increase allocation_percent precision to support multi-role allocations
-- Date: 2025-12-27
-- Reason: Some resources work multiple roles simultaneously, resulting in allocation
--         percentages exceeding 100% (e.g., Tabitha Brown with 3 roles = ~275%)
--         Current DECIMAL(5,2) max is 999.99, but data contains values up to 2600%

ALTER TABLE rcm_allocations
ALTER COLUMN allocation_percent TYPE DECIMAL(7,2);

-- This allows values from -99999.99 to 99999.99
-- which is sufficient for even extreme multi-role scenarios
