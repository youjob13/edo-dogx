package elasticsearch

import es8 "github.com/elastic/go-elasticsearch/v8"

// NewClient wires the Elasticsearch SDK client for EDMS outbound adapters.
func NewClient(cfg es8.Config) (*es8.Client, error) {
	return es8.NewClient(cfg)
}
