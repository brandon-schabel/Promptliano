ALTER TABLE `model_configs` ADD `preset_category` text;--> statement-breakpoint
ALTER TABLE `model_configs` ADD `ui_icon` text;--> statement-breakpoint
ALTER TABLE `model_configs` ADD `ui_color` text;--> statement-breakpoint
ALTER TABLE `model_configs` ADD `ui_order` integer DEFAULT 0;