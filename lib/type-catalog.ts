// AUTO-GENERATED FROM docs/type_system_catalog.json
// MD5: 67bf7cab7768fc346d60f175f5b5179d
// Do not edit directly; run tools/generate_type_catalog.py

export type RuleId = string;
export type CoreType = string;
export type TypeAlias = string;

export const CORE_TYPES: Record<string, any> = {
  "string": {
    "name": "string",
    "rules": [
      "R4",
      "R6",
      "R17",
      "R18"
    ],
    "description": "Variable-length character data"
  },
  "integer": {
    "name": "integer",
    "rules": [
      "R9",
      "R10"
    ],
    "description": "Whole numbers without decimals"
  },
  "decimal": {
    "name": "decimal",
    "rules": [
      "R9",
      "R10",
      "R11"
    ],
    "description": "Numbers with decimal precision"
  },
  "boolean": {
    "name": "boolean",
    "rules": [],
    "description": "True/False values"
  },
  "date": {
    "name": "date",
    "rules": [
      "R12",
      "R13",
      "R14",
      "R16"
    ],
    "description": "Calendar date (no time)"
  },
  "datetime": {
    "name": "datetime",
    "rules": [
      "R12",
      "R13",
      "R14",
      "R15",
      "R16"
    ],
    "description": "Date with time, no TZ"
  },
  "timestamp": {
    "name": "timestamp",
    "rules": [
      "R12",
      "R13",
      "R14",
      "R15"
    ],
    "description": "Date/time with timezone"
  },
  "time": {
    "name": "time",
    "rules": [],
    "description": "Time of day"
  },
  "uuid": {
    "name": "uuid",
    "rules": [
      "R4",
      "R17"
    ],
    "description": "Universally unique identifier"
  },
  "json": {
    "name": "json",
    "rules": [
      "R17",
      "R18"
    ],
    "description": "Structured JSON data"
  },
  "enum": {
    "name": "enum",
    "rules": [
      "R19"
    ],
    "description": "Controlled vocabulary / enumerated values"
  },
  "identifier": {
    "name": "identifier",
    "rules": [
      "R7",
      "R18",
      "R21"
    ],
    "description": "Unique business identifier (ID, number, code)"
  },
  "money": {
    "name": "money",
    "rules": [
      "R9",
      "R10"
    ],
    "description": "Monetary amount (currency-aware)"
  },
  "percentage": {
    "name": "percentage",
    "rules": [
      "R9",
      "R10"
    ],
    "description": "Percentage value (0-100 or 0-1)"
  },
  "flag": {
    "name": "flag",
    "rules": [],
    "description": "Boolean-like flag (TRUE/FALSE/Y/N/1/0)"
  },
  "hierarchical_key": {
    "name": "hierarchical_key",
    "rules": [],
    "description": "Column controlling row grouping/hierarchy"
  }
};
export const TYPE_ALIASES: Record<string, any> = {
  "email": {
    "name": "email",
    "extends": "string",
    "rules": [
      "R33"
    ],
    "category": "contact",
    "description": "Email address"
  },
  "work_email": {
    "name": "work_email",
    "extends": "email",
    "rules": [],
    "category": "contact",
    "description": "Corporate email domain"
  },
  "phone_international": {
    "name": "phone_international",
    "extends": "string",
    "rules": [
      "R33",
      "R18"
    ],
    "category": "contact",
    "description": "Phone with country code"
  },
  "phone_local": {
    "name": "phone_local",
    "extends": "string",
    "rules": [
      "R33",
      "R18"
    ],
    "category": "contact",
    "description": "Local phone without country code"
  },
  "url": {
    "name": "url",
    "extends": "string",
    "rules": [
      "R18"
    ],
    "category": "contact",
    "description": "Web URL"
  },
  "ip_address_v4": {
    "name": "ip_address_v4",
    "extends": "string",
    "rules": [
      "R18"
    ],
    "category": "contact",
    "description": "IPv4 address"
  },
  "ip_address_v6": {
    "name": "ip_address_v6",
    "extends": "string",
    "rules": [
      "R18"
    ],
    "category": "contact",
    "description": "IPv6 address"
  },
  "mac_address": {
    "name": "mac_address",
    "extends": "string",
    "rules": [
      "R18"
    ],
    "category": "contact",
    "description": "Network MAC"
  },
  "address_line": {
    "name": "address_line",
    "extends": "string",
    "rules": [
      "R5",
      "R18"
    ],
    "category": "address"
  },
  "city": {
    "name": "city",
    "extends": "string",
    "rules": [
      "R5",
      "R18"
    ],
    "category": "address"
  },
  "state_province": {
    "name": "state_province",
    "extends": "string",
    "rules": [
      "R5",
      "R18"
    ],
    "category": "address"
  },
  "postal_code": {
    "name": "postal_code",
    "extends": "string",
    "rules": [
      "R18"
    ],
    "category": "address"
  },
  "country_name": {
    "name": "country_name",
    "extends": "string",
    "rules": [
      "R19",
      "R5",
      "R18"
    ],
    "category": "address"
  },
  "latitude": {
    "name": "latitude",
    "extends": "decimal",
    "rules": [
      "R10"
    ],
    "category": "geo"
  },
  "longitude": {
    "name": "longitude",
    "extends": "decimal",
    "rules": [
      "R10"
    ],
    "category": "geo"
  },
  "currency_amount": {
    "name": "currency_amount",
    "extends": "money",
    "rules": [],
    "category": "financial"
  },
  "currency_code": {
    "name": "currency_code",
    "extends": "enum",
    "rules": [
      "R27"
    ],
    "category": "financial"
  },
  "percentage": {
    "name": "percentage",
    "extends": "percentage",
    "rules": [],
    "category": "financial"
  },
  "price": {
    "name": "price",
    "extends": "money",
    "rules": [],
    "category": "financial"
  },
  "tax_rate": {
    "name": "tax_rate",
    "extends": "decimal",
    "rules": [
      "R10"
    ],
    "category": "financial"
  },
  "exchange_rate": {
    "name": "exchange_rate",
    "extends": "decimal",
    "rules": [
      "R10"
    ],
    "category": "financial"
  },
  "iban": {
    "name": "iban",
    "extends": "string",
    "rules": [
      "R18"
    ],
    "category": "financial"
  },
  "credit_card": {
    "name": "credit_card",
    "extends": "string",
    "rules": [
      "R18"
    ],
    "category": "financial"
  },
  "sku": {
    "name": "sku",
    "extends": "identifier",
    "rules": [],
    "category": "code"
  },
  "ean": {
    "name": "ean",
    "extends": "identifier",
    "rules": [],
    "category": "code"
  },
  "upc": {
    "name": "upc",
    "extends": "identifier",
    "rules": [],
    "category": "code"
  },
  "asin": {
    "name": "asin",
    "extends": "identifier",
    "rules": [],
    "category": "code"
  },
  "isbn": {
    "name": "isbn",
    "extends": "identifier",
    "rules": [],
    "category": "code"
  },
  "batch_lot_number": {
    "name": "batch_lot_number",
    "extends": "identifier",
    "rules": [],
    "category": "code"
  },
  "serial_number": {
    "name": "serial_number",
    "extends": "identifier",
    "rules": [],
    "category": "code"
  },
  "gl_account_code": {
    "name": "gl_account_code",
    "extends": "identifier",
    "rules": [
      "R28"
    ],
    "category": "code"
  },
  "tax_id": {
    "name": "tax_id",
    "extends": "identifier",
    "rules": [
      "R26"
    ],
    "category": "identity"
  },
  "ssn": {
    "name": "ssn",
    "extends": "string",
    "rules": [
      "R18"
    ],
    "category": "identity"
  },
  "national_id": {
    "name": "national_id",
    "extends": "identifier",
    "rules": [],
    "category": "identity"
  },
  "employee_id": {
    "name": "employee_id",
    "extends": "identifier",
    "rules": [],
    "category": "identity"
  },
  "customer_id": {
    "name": "customer_id",
    "extends": "identifier",
    "rules": [],
    "category": "identity"
  },
  "order_number": {
    "name": "order_number",
    "extends": "identifier",
    "rules": [],
    "category": "identity"
  },
  "invoice_number": {
    "name": "invoice_number",
    "extends": "identifier",
    "rules": [],
    "category": "identity"
  },
  "version": {
    "name": "version",
    "extends": "string",
    "rules": [
      "R18"
    ],
    "category": "identity"
  },
  "color_hex": {
    "name": "color_hex",
    "extends": "string",
    "rules": [
      "R18"
    ],
    "category": "identity"
  },
  "birth_date": {
    "name": "birth_date",
    "extends": "date",
    "rules": [],
    "category": "date"
  },
  "transaction_date": {
    "name": "transaction_date",
    "extends": "date",
    "rules": [
      "R15"
    ],
    "category": "date"
  },
  "fiscal_period": {
    "name": "fiscal_period",
    "extends": "string",
    "rules": [
      "R29",
      "R18"
    ],
    "category": "date"
  },
  "fiscal_year": {
    "name": "fiscal_year",
    "extends": "integer",
    "rules": [
      "R29"
    ],
    "category": "date"
  },
  "year": {
    "name": "year",
    "extends": "integer",
    "rules": [
      "R10"
    ],
    "category": "date"
  },
  "quantity": {
    "name": "quantity",
    "extends": "integer",
    "rules": [
      "R10"
    ],
    "category": "quantity"
  },
  "quantity_decimal": {
    "name": "quantity_decimal",
    "extends": "decimal",
    "rules": [
      "R10"
    ],
    "category": "quantity"
  },
  "age": {
    "name": "age",
    "extends": "integer",
    "rules": [
      "R10"
    ],
    "category": "quantity"
  },
  "weight": {
    "name": "weight",
    "extends": "decimal",
    "rules": [
      "R11"
    ],
    "category": "quantity"
  },
  "distance": {
    "name": "distance",
    "extends": "decimal",
    "rules": [
      "R11"
    ],
    "category": "quantity"
  },
  "temperature": {
    "name": "temperature",
    "extends": "decimal",
    "rules": [
      "R10"
    ],
    "category": "quantity"
  },
  "status_code": {
    "name": "status_code",
    "extends": "enum",
    "rules": [],
    "category": "controlled"
  },
  "country_code": {
    "name": "country_code",
    "extends": "enum",
    "rules": [
      "R19"
    ],
    "category": "controlled"
  },
  "language_code": {
    "name": "language_code",
    "extends": "enum",
    "rules": [],
    "category": "controlled"
  },
  "uom_code": {
    "name": "uom_code",
    "extends": "string",
    "rules": [
      "R30",
      "R5",
      "R18"
    ],
    "category": "controlled"
  },
  "boolean_text": {
    "name": "boolean_text",
    "extends": "flag",
    "rules": [],
    "category": "controlled"
  },
  "person_name": {
    "name": "person_name",
    "extends": "string",
    "rules": [
      "R5",
      "R18"
    ],
    "category": "text"
  },
  "company_name": {
    "name": "company_name",
    "extends": "string",
    "rules": [
      "R5",
      "R18"
    ],
    "category": "text"
  },
  "product_name": {
    "name": "product_name",
    "extends": "string",
    "rules": [
      "R5",
      "R18"
    ],
    "category": "text"
  },
  "description": {
    "name": "description",
    "extends": "string",
    "rules": [
      "R23",
      "R18"
    ],
    "category": "text"
  },
  "notes": {
    "name": "notes",
    "extends": "string",
    "rules": [
      "R23",
      "R24",
      "R18"
    ],
    "category": "text"
  },
  "rich_text_html": {
    "name": "rich_text_html",
    "extends": "string",
    "rules": [
      "R25",
      "R18"
    ],
    "category": "text"
  },
  "subscription_id": {
    "name": "subscription_id",
    "extends": "identifier",
    "rules": [],
    "category": "business",
    "description": "Subscription identifier"
  },
  "product_sku": {
    "name": "product_sku",
    "extends": "identifier",
    "rules": [],
    "category": "business",
    "description": "Product SKU code"
  },
  "charge_model": {
    "name": "charge_model",
    "extends": "enum",
    "rules": [],
    "category": "business",
    "description": "Charge pricing model type"
  },
  "billing_period": {
    "name": "billing_period",
    "extends": "enum",
    "rules": [],
    "category": "business",
    "description": "Billing period (Month, Quarter, Annual)"
  },
  "accounting_code": {
    "name": "accounting_code",
    "extends": "identifier",
    "rules": [
      "R28"
    ],
    "category": "business",
    "description": "Accounting/revenue recognition code"
  },
  "rate_plan_id": {
    "name": "rate_plan_id",
    "extends": "identifier",
    "rules": [],
    "category": "business",
    "description": "Rate plan identifier"
  },
  "order_type": {
    "name": "order_type",
    "extends": "enum",
    "rules": [],
    "category": "business",
    "description": "Order/amendment type discriminator"
  },
  "discount_type": {
    "name": "discount_type",
    "extends": "enum",
    "rules": [],
    "category": "business",
    "description": "Discount level/apply type"
  },
  "term_type": {
    "name": "term_type",
    "extends": "enum",
    "rules": [],
    "category": "business",
    "description": "Subscription term type (TERMED/EVERGREEN)"
  },
  "trigger_event": {
    "name": "trigger_event",
    "extends": "enum",
    "rules": [],
    "category": "business",
    "description": "Revenue trigger event/condition"
  },
  "price_format": {
    "name": "price_format",
    "extends": "enum",
    "rules": [],
    "category": "business",
    "description": "Price format (FlatFee/PerUnit)"
  },
  "unit_of_measure": {
    "name": "unit_of_measure",
    "extends": "string",
    "rules": [
      "R30"
    ],
    "category": "business",
    "description": "Unit of measure"
  },
  "custom_field": {
    "name": "custom_field",
    "extends": "string",
    "rules": [],
    "category": "business",
    "description": "Custom field (__c suffix)"
  }
};
export const RULES: Record<string, any> = {
  "R1": {
    "id": "R1",
    "name": "Missing Required Value",
    "severity": "critical",
    "fixable": false,
    "description": "NULL in non-nullable column",
    "tags": [
      "nullable_false",
      "primary_key"
    ]
  },
  "R2": {
    "id": "R2",
    "name": "Duplicate Primary Key",
    "severity": "critical",
    "fixable": false,
    "description": "Primary key value not unique",
    "tags": [
      "primary_key",
      "unique"
    ]
  },
  "R3": {
    "id": "R3",
    "name": "Duplicate Transaction Row",
    "severity": "warning",
    "fixable": false,
    "tags": []
  },
  "R4": {
    "id": "R4",
    "name": "Whitespace Issues",
    "severity": "low",
    "fixable": true,
    "tags": [
      "universal"
    ]
  },
  "R5": {
    "id": "R5",
    "name": "Casing/Formatting",
    "severity": "low",
    "fixable": true,
    "tags": []
  },
  "R6": {
    "id": "R6",
    "name": "Encoding/Mojibake",
    "severity": "medium",
    "fixable": true,
    "tags": []
  },
  "R7": {
    "id": "R7",
    "name": "Special Characters in IDs",
    "severity": "medium",
    "fixable": false,
    "tags": []
  },
  "R8": {
    "id": "R8",
    "name": "Noise Suffix",
    "severity": "low",
    "fixable": true,
    "tags": []
  },
  "R9": {
    "id": "R9",
    "name": "Numeric as Text",
    "severity": "medium",
    "fixable": true,
    "tags": []
  },
  "R10": {
    "id": "R10",
    "name": "Out-of-Range / Scale Violation",
    "severity": "high",
    "fixable": false,
    "tags": []
  },
  "R11": {
    "id": "R11",
    "name": "Unit / Scale Mismatch",
    "severity": "medium",
    "fixable": false,
    "tags": []
  },
  "R12": {
    "id": "R12",
    "name": "Date Format Inconsistency",
    "severity": "medium",
    "fixable": true,
    "tags": []
  },
  "R13": {
    "id": "R13",
    "name": "Invalid Calendar Date",
    "severity": "high",
    "fixable": false,
    "tags": []
  },
  "R14": {
    "id": "R14",
    "name": "Unparseable Date",
    "severity": "high",
    "fixable": false,
    "tags": []
  },
  "R15": {
    "id": "R15",
    "name": "Future-Dated Outside Policy",
    "severity": "medium",
    "fixable": false,
    "tags": []
  },
  "R16": {
    "id": "R16",
    "name": "Mixed Date Separators",
    "severity": "low",
    "fixable": true,
    "tags": []
  },
  "R17": {
    "id": "R17",
    "name": "Hidden Null / Control Characters",
    "severity": "medium",
    "fixable": true,
    "tags": [
      "universal"
    ]
  },
  "R18": {
    "id": "R18",
    "name": "Excessively Long Text",
    "severity": "medium",
    "fixable": false,
    "tags": []
  },
  "R19": {
    "id": "R19",
    "name": "Status Outside Enum",
    "severity": "medium",
    "fixable": false,
    "tags": []
  },
  "R21": {
    "id": "R21",
    "name": "Truncated Value Detected",
    "severity": "medium",
    "fixable": false,
    "description": "Value appears cut off or truncated",
    "tags": []
  },
  "R22": {
    "id": "R22",
    "name": "Schema Drift",
    "severity": "high",
    "fixable": false,
    "description": "CSV header fields not matching template",
    "tags": [
      "dataset_level"
    ]
  },
  "R23": {
    "id": "R23",
    "name": "HTML/XSS Injection",
    "severity": "critical",
    "fixable": true,
    "tags": []
  },
  "R24": {
    "id": "R24",
    "name": "SQL Injection",
    "severity": "critical",
    "fixable": true,
    "tags": []
  },
  "R25": {
    "id": "R25",
    "name": "Script/Command Injection",
    "severity": "critical",
    "fixable": true,
    "tags": []
  },
  "R26": {
    "id": "R26",
    "name": "Invalid Tax Registration",
    "severity": "high",
    "fixable": false,
    "description": "Invalid tax ID/VAT format",
    "tags": []
  },
  "R27": {
    "id": "R27",
    "name": "Invalid Currency Code",
    "severity": "medium",
    "fixable": false,
    "tags": []
  },
  "R28": {
    "id": "R28",
    "name": "Invalid GL/Subledger Code",
    "severity": "medium",
    "fixable": false,
    "description": "GL or accounting code not in valid set",
    "tags": []
  },
  "R29": {
    "id": "R29",
    "name": "Posting in Closed Period",
    "severity": "medium",
    "fixable": false,
    "tags": []
  },
  "R30": {
    "id": "R30",
    "name": "Invalid UOM",
    "severity": "medium",
    "fixable": false,
    "tags": []
  },
  "R31": {
    "id": "R31",
    "name": "Invalid Warehouse Code",
    "severity": "medium",
    "fixable": false,
    "description": "Warehouse code not in valid set",
    "tags": []
  },
  "R32": {
    "id": "R32",
    "name": "Negative Inventory",
    "severity": "high",
    "fixable": false,
    "description": "Inventory quantity is negative",
    "tags": []
  },
  "R33": {
    "id": "R33",
    "name": "Invalid Email/Phone Format",
    "severity": "medium",
    "fixable": false,
    "description": "Email or phone number fails format validation",
    "tags": []
  },
  "R34": {
    "id": "R34",
    "name": "Missing FX Rate",
    "severity": "medium",
    "fixable": false,
    "description": "No exchange rate found for currency pair",
    "tags": []
  }
};

const UNIVERSAL_RULES: Set<RuleId> = new Set(Object.entries(RULES).filter(([, r]) => (r.tags || []).includes("universal")).map(([id]) => id));

const lineageCache = new Map<string, string[]>();
export function lineage(name: string): string[] {
  if (lineageCache.has(name)) return lineageCache.get(name)!;
  if (CORE_TYPES[name]) {
    lineageCache.set(name, [name]);
    return [name];
  }
  const alias = TYPE_ALIASES[name];
  if (!alias) throw new Error(`Unknown type alias: ${name}`);
  const parent = lineage(alias.extends);
  const res = [...parent, name];
  lineageCache.set(name, res);
  return res;
}

export interface DerivedRuleSet {
  rules: RuleId[];
  ruleSources: Record<RuleId, string>;
  typeUsed: string;
  keyUsed: "none" | "primary_key" | "unique";
  nullable: boolean;
}

export function deriveRulesV2(
  typeName: string,
  keyType: "none" | "primary_key" | "unique" = "none",
  nullable: boolean = true,
  exclude: Set<RuleId> = new Set()
): DerivedRuleSet {
  const rules: RuleId[] = [];
  const sources: Record<RuleId, string> = {};

  const add = (rid: RuleId, source: string) => {
    if (exclude.has(rid) || sources[rid]) return;
    rules.push(rid);
    sources[rid] = source;
  };

  Array.from(UNIVERSAL_RULES).sort().forEach((rid) => add(rid, "universal"));

  lineage(typeName).forEach((t) => {
    const bucket = CORE_TYPES[t] ? CORE_TYPES : TYPE_ALIASES;
    const scope = CORE_TYPES[t] ? "core" : "alias";
    (bucket[t].rules || []).forEach((rid: RuleId) => add(rid, `${scope}:${t}`));
  });

  if (keyType === "primary_key") {
    add("R1", "primary_key");
    add("R2", "primary_key");
  } else if (keyType === "unique") {
    add("R2", "unique");
  }

  if (!nullable) {
    add("R1", "nullable:false");
  }

  return { rules, ruleSources: sources, typeUsed: typeName, keyUsed: keyType, nullable };
}

export function validateCatalog(): boolean {
  for (const [name, alias] of Object.entries(TYPE_ALIASES)) {
    const parent = (alias as any).extends;
    if (!CORE_TYPES[parent] && !TYPE_ALIASES[parent]) {
      throw new Error(`Alias ${name} extends unknown type ${parent}`);
    }
  }
  for (const c of Object.values(CORE_TYPES)) {
    (c as any).rules?.forEach((r: string) => {
      if (!RULES[r]) throw new Error(`Core type references unknown rule ${r}`);
    });
  }
  for (const a of Object.values(TYPE_ALIASES)) {
    (a as any).rules?.forEach((r: string) => {
      if (!RULES[r]) throw new Error(`Alias references unknown rule ${r}`);
    });
  }
  return true;
}

validateCatalog();
