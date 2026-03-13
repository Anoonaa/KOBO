# SQL Audit Queries

This folder is for your **Task 3** deliverables.

Save each audit query as an independent `.sql` file using the naming convention below.

## Structure

```
sql-queries/
├── 3.1-stock-reconciliation/
│   ├── SR-01-stock-mismatch.sql
│   ├── SR-02-inventory-order-gap.sql
│   └── ...
├── 3.2-pricing-audit/
│   ├── PA-01-vat-verification.sql
│   ├── PA-02-discount-accuracy.sql
│   └── ...
├── 3.3-data-hygiene/
│   ├── DH-01-duplicate-skus.sql
│   ├── DH-02-negative-prices.sql
│   └── ...
└── 3.4-business-intelligence/
    ├── BI-01-highest-revenue-skus.sql
    ├── BI-02-slow-moving-stock.sql
    └── ...
```

## Query Categories

| # | Category | Min. Queries | Focus |
|:---:|:---|:---:|:---|
| 3.1 | Stock Reconciliation | 15 | Stock mismatches, API vs DB quantity gaps |
| 3.2 | Pricing Audit | 15 | Multi-table JOINs across Products, Orders, VAT_Rates |
| 3.3 | Data Hygiene & Constraints | 10 | Duplicate SKUs, negative prices, invalid contact formats |
| 3.4 | Business Intelligence | 10 | Highest revenue SKUs, slow-moving stock, buyer reports |

**Total required: 50+**
