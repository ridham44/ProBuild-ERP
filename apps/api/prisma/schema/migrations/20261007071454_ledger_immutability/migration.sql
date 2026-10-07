-- Ledgers are append-only. Corrections are new REVERSAL rows, never UPDATE/DELETE.
CREATE OR REPLACE FUNCTION probuild_block_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Table "%" is immutable: % is not allowed. Post a reversal instead.', TG_TABLE_NAME, TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER stock_ledger_immutable
  BEFORE UPDATE OR DELETE ON "StockLedger"
  FOR EACH ROW EXECUTE FUNCTION probuild_block_mutation();

CREATE TRIGGER project_cost_ledger_immutable
  BEFORE UPDATE OR DELETE ON "ProjectCostLedger"
  FOR EACH ROW EXECUTE FUNCTION probuild_block_mutation();

CREATE TRIGGER audit_log_immutable
  BEFORE UPDATE OR DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION probuild_block_mutation();

CREATE TRIGGER journal_line_immutable
  BEFORE UPDATE OR DELETE ON "JournalLine"
  FOR EACH ROW EXECUTE FUNCTION probuild_block_mutation();

-- Posted journal entries may only change status (POSTED -> REVERSED); never deleted.
CREATE OR REPLACE FUNCTION probuild_journal_entry_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'JournalEntry cannot be deleted. Post a reversal instead.';
  END IF;
  IF NEW."entryNo" <> OLD."entryNo" OR NEW."entryDate" <> OLD."entryDate" OR NEW."companyId" <> OLD."companyId" THEN
    RAISE EXCEPTION 'JournalEntry header fields are immutable once posted.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER journal_entry_guard
  BEFORE UPDATE OR DELETE ON "JournalEntry"
  FOR EACH ROW EXECUTE FUNCTION probuild_journal_entry_guard();
