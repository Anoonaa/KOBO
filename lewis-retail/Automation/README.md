# Automation — Postman Collection

This folder is for your **Task 2** deliverables.

## Requirements

Export your Postman Master Collection as **JSON v2.1** and save it here.

### Collection Structure

```
Lewis Retail Engine.postman_collection.json
├── Stock & Inventory (15 requests)
│   ├── GET /inventory
│   ├── GET /inventory/:id
│   ├── POST /stock/update
│   ├── GET /inventory/low-stock
│   ├── Negative stock scenarios
│   └── Non-existent SKU queries
├── Pricing & Revenue Integrity (20 requests)
│   ├── GET /pricing/calculate (various scenarios)
│   ├── GET /pricing/vat-rates
│   ├── VAT verification tests
│   ├── Customer-tier discount tests
│   └── Bulk quantity rounding tests
└── Credit & Debt Governance (15 requests)
    ├── GET /credit/:id
    ├── POST /credit/apply
    ├── Expired credit status tests
    └── Zero credit limit tests
```

### Automated Scripts

Each request must contain Postman test scripts validating:
- **Status Codes** (e.g., `pm.response.to.have.status(200)`)
- **Response Time** (e.g., `pm.expect(pm.response.responseTime).to.be.below(2000)`)
- **JSON Schema Integrity** (e.g., validate required fields exist and have correct types)

### Total Required: 50+ requests
