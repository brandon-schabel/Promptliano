-- Add composite indexes for research_sources table
CREATE INDEX `research_sources_research_status_idx` ON `research_sources` (`research_id`, `status`);--> statement-breakpoint
CREATE INDEX `research_sources_fetched_at_idx` ON `research_sources` (`fetched_at`);--> statement-breakpoint

-- Add composite indexes for research_document_sections table
CREATE INDEX `research_document_sections_research_order_idx` ON `research_document_sections` (`research_id`, `order_index`);--> statement-breakpoint
CREATE INDEX `research_document_sections_status_idx` ON `research_document_sections` (`status`);
