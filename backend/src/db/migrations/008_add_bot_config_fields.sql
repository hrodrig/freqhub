-- Add bot configuration metadata (K8s ConfigMap name + config.json path)
ALTER TABLE bots ADD COLUMN configmap_name TEXT;
ALTER TABLE bots ADD COLUMN config_path TEXT;
