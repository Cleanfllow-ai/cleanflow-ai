// AUTO-GENERATED FROM docs/type_system_catalog.json
// MD5: 033cd3d62b2f714e4bb82ceada0cd91d
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
      "R18",
      "R67"
    ],
    "description": "Variable-length character data"
  },
  "integer": {
    "name": "integer",
    "rules": [
      "R9",
      "R10",
      "R39",
      "R51",
      "R66"
    ],
    "description": "Whole numbers without decimals"
  },
  "decimal": {
    "name": "decimal",
    "rules": [
      "R9",
      "R10",
      "R39",
      "R48",
      "R52"
    ],
    "description": "Numbers with decimal precision"
  },
  "boolean": {
    "name": "boolean",
    "rules": [
      "R39",
      "R53"
    ],
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
      "R16",
      "R54"
    ],
    "description": "Date with time, no TZ"
  },
  "timestamp": {
    "name": "timestamp",
    "rules": [
      "R12",
      "R13",
      "R14",
      "R15",
      "R55"
    ],
    "description": "Date/time with timezone"
  },
  "time": {
    "name": "time",
    "rules": [
      "R39",
      "R56",
      "R57"
    ],
    "description": "Time of day"
  },
  "uuid": {
    "name": "uuid",
    "rules": [
      "R4",
      "R17",
      "R58"
    ],
    "description": "Universally unique identifier"
  },
  "json": {
    "name": "json",
    "rules": [
      "R17",
      "R18",
      "R49",
      "R59"
    ],
    "description": "Structured JSON data"
  }
};
export const TYPE_ALIASES: Record<string, any> = {
  "email": {
    "name": "email",
    "extends": "string",
    "rules": [
      "R31",
      "R60"
    ],
    "category": "contact",
    "description": "Email address"
  },
  "work_email": {
    "name": "work_email",
    "extends": "email",
    "rules": [
      "R73"
    ],
    "category": "contact",
    "description": "Corporate email domain"
  },
  "phone_international": {
    "name": "phone_international",
    "extends": "string",
    "rules": [
      "R32",
      "R61",
      "R18"
    ],
    "category": "contact",
    "description": "Phone with country code"
  },
  "phone_local": {
    "name": "phone_local",
    "extends": "string",
    "rules": [
      "R32",
      "R18"
    ],
    "category": "contact",
    "description": "Local phone without country code"
  },
  "url": {
    "name": "url",
    "extends": "string",
    "rules": [
      "R33",
      "R62",
      "R18"
    ],
    "category": "contact",
    "description": "Web URL"
  },
  "ip_address_v4": {
    "name": "ip_address_v4",
    "extends": "string",
    "rules": [
      "R35",
      "R18"
    ],
    "category": "contact",
    "description": "IPv4 address"
  },
  "ip_address_v6": {
    "name": "ip_address_v6",
    "extends": "string",
    "rules": [
      "R35",
      "R18"
    ],
    "category": "contact",
    "description": "IPv6 address"
  },
  "mac_address": {
    "name": "mac_address",
    "extends": "string",
    "rules": [
      "R68",
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
      "R36",
      "R18"
    ],
    "category": "address"
  },
  "country_name": {
    "name": "country_name",
    "extends": "string",
    "rules": [
      "R28",
      "R18",
      "R5"
    ],
    "category": "address"
  },
  "latitude": {
    "name": "latitude",
    "extends": "decimal",
    "rules": [
      "R69",
      "R10"
    ],
    "category": "geo"
  },
  "longitude": {
    "name": "longitude",
    "extends": "decimal",
    "rules": [
      "R69",
      "R10"
    ],
    "category": "geo"
  },
  "currency_amount": {
    "name": "currency_amount",
    "extends": "decimal",
    "rules": [
      "R22",
      "R40",
      "R63"
    ],
    "category": "financial"
  },
  "currency_code": {
    "name": "currency_code",
    "extends": "string",
    "rules": [
      "R27",
      "R18",
      "R5"
    ],
    "category": "financial"
  },
  "percentage": {
    "name": "percentage",
    "extends": "decimal",
    "rules": [
      "R10"
    ],
    "category": "financial"
  },
  "price": {
    "name": "price",
    "extends": "decimal",
    "rules": [
      "R22",
      "R40",
      "R63"
    ],
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
      "R10",
      "R40"
    ],
    "category": "financial"
  },
  "iban": {
    "name": "iban",
    "extends": "string",
    "rules": [
      "R37",
      "R18"
    ],
    "category": "financial"
  },
  "credit_card": {
    "name": "credit_card",
    "extends": "string",
    "rules": [
      "R64",
      "R18",
      "R26"
    ],
    "category": "financial"
  },
  "sku": {
    "name": "sku",
    "extends": "string",
    "rules": [
      "R44",
      "R18",
      "R7"
    ],
    "category": "code"
  },
  "ean": {
    "name": "ean",
    "extends": "string",
    "rules": [
      "R44",
      "R65",
      "R18"
    ],
    "category": "code"
  },
  "upc": {
    "name": "upc",
    "extends": "string",
    "rules": [
      "R44",
      "R65",
      "R18"
    ],
    "category": "code"
  },
  "asin": {
    "name": "asin",
    "extends": "string",
    "rules": [
      "R44",
      "R18"
    ],
    "category": "code"
  },
  "isbn": {
    "name": "isbn",
    "extends": "string",
    "rules": [
      "R65",
      "R18"
    ],
    "category": "code"
  },
  "batch_lot_number": {
    "name": "batch_lot_number",
    "extends": "string",
    "rules": [
      "R45",
      "R18",
      "R7"
    ],
    "category": "code"
  },
  "serial_number": {
    "name": "serial_number",
    "extends": "string",
    "rules": [
      "R38",
      "R18",
      "R7"
    ],
    "category": "code"
  },
  "gl_account_code": {
    "name": "gl_account_code",
    "extends": "string",
    "rules": [
      "R46",
      "R18",
      "R7"
    ],
    "category": "code"
  },
  "tax_id": {
    "name": "tax_id",
    "extends": "string",
    "rules": [
      "R34",
      "R18",
      "R7"
    ],
    "category": "identity"
  },
  "ssn": {
    "name": "ssn",
    "extends": "string",
    "rules": [
      "R70",
      "R18",
      "R26"
    ],
    "category": "identity"
  },
  "national_id": {
    "name": "national_id",
    "extends": "string",
    "rules": [
      "R26",
      "R18",
      "R7"
    ],
    "category": "identity"
  },
  "employee_id": {
    "name": "employee_id",
    "extends": "string",
    "rules": [
      "R38",
      "R18",
      "R7"
    ],
    "category": "identity"
  },
  "customer_id": {
    "name": "customer_id",
    "extends": "string",
    "rules": [
      "R38",
      "R18",
      "R7"
    ],
    "category": "identity"
  },
  "order_number": {
    "name": "order_number",
    "extends": "string",
    "rules": [
      "R38",
      "R18",
      "R7"
    ],
    "category": "identity"
  },
  "invoice_number": {
    "name": "invoice_number",
    "extends": "string",
    "rules": [
      "R38",
      "R18",
      "R7"
    ],
    "category": "identity"
  },
  "numeric_identifier": {
    "name": "numeric_identifier",
    "extends": "integer",
    "rules": [],
    "category": "identity"
  },
  "version": {
    "name": "version",
    "extends": "string",
    "rules": [
      "R71",
      "R18"
    ],
    "category": "identity"
  },
  "color_hex": {
    "name": "color_hex",
    "extends": "string",
    "rules": [
      "R72",
      "R18"
    ],
    "category": "identity"
  },
  "birth_date": {
    "name": "birth_date",
    "extends": "date",
    "rules": [
      "R42"
    ],
    "category": "date"
  },
  "transaction_date": {
    "name": "transaction_date",
    "extends": "date",
    "rules": [
      "R43"
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
      "R22",
      "R40",
      "R41"
    ],
    "category": "quantity"
  },
  "quantity_decimal": {
    "name": "quantity_decimal",
    "extends": "decimal",
    "rules": [
      "R22",
      "R40",
      "R41"
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
      "R11",
      "R22"
    ],
    "category": "quantity"
  },
  "distance": {
    "name": "distance",
    "extends": "decimal",
    "rules": [
      "R11",
      "R22"
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
    "extends": "string",
    "rules": [
      "R19",
      "R5",
      "R18"
    ],
    "category": "controlled"
  },
  "country_code": {
    "name": "country_code",
    "extends": "string",
    "rules": [
      "R28",
      "R5",
      "R18"
    ],
    "category": "controlled"
  },
  "language_code": {
    "name": "language_code",
    "extends": "string",
    "rules": [
      "R19",
      "R5",
      "R18"
    ],
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
    "extends": "string",
    "rules": [
      "R19",
      "R18"
    ],
    "category": "controlled"
  },
  "person_name": {
    "name": "person_name",
    "extends": "string",
    "rules": [
      "R5",
      "R18",
      "R26"
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
    "fixable": true,
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
    "fixable": true,
    "tags": []
  },
  "R19": {
    "id": "R19",
    "name": "Status Outside Enum",
    "severity": "medium",
    "fixable": false,
    "tags": []
  },
  "R20": {
    "id": "R20",
    "name": "Cross-Field Inconsistency",
    "severity": "high",
    "fixable": false,
    "tags": []
  },
  "R21": {
    "id": "R21",
    "name": "Reference Integrity Violation",
    "severity": "high",
    "fixable": false,
    "tags": []
  },
  "R22": {
    "id": "R22",
    "name": "Unexpected Negative Value",
    "severity": "medium",
    "fixable": false,
    "tags": []
  },
  "R23": {
    "id": "R23",
    "name": "HTML Injection",
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
    "name": "Script Injection",
    "severity": "critical",
    "fixable": true,
    "tags": []
  },
  "R26": {
    "id": "R26",
    "name": "PII Pattern Detected",
    "severity": "high",
    "fixable": false,
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
    "name": "Invalid Country Code",
    "severity": "medium",
    "fixable": false,
    "tags": []
  },
  "R29": {
    "id": "R29",
    "name": "Invalid Fiscal Period",
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
    "name": "Invalid Email Format",
    "severity": "medium",
    "fixable": false,
    "tags": []
  },
  "R32": {
    "id": "R32",
    "name": "Invalid Phone Format",
    "severity": "medium",
    "fixable": false,
    "tags": []
  },
  "R33": {
    "id": "R33",
    "name": "Invalid URL Format",
    "severity": "medium",
    "fixable": false,
    "tags": []
  },
  "R34": {
    "id": "R34",
    "name": "Invalid Tax ID",
    "severity": "high",
    "fixable": false,
    "tags": []
  },
  "R35": {
    "id": "R35",
    "name": "Invalid IP Address",
    "severity": "medium",
    "fixable": false,
    "tags": []
  },
  "R36": {
    "id": "R36",
    "name": "Invalid Postal Code",
    "severity": "medium",
    "fixable": false,
    "tags": []
  },
  "R37": {
    "id": "R37",
    "name": "Invalid IBAN/Bank Account",
    "severity": "high",
    "fixable": false,
    "tags": []
  },
  "R38": {
    "id": "R38",
    "name": "Truncated Value Detected",
    "severity": "medium",
    "fixable": false,
    "tags": []
  },
  "R39": {
    "id": "R39",
    "name": "Placeholder Value Detected",
    "severity": "low",
    "fixable": true,
    "tags": []
  },
  "R40": {
    "id": "R40",
    "name": "Zero Value in Required Field",
    "severity": "medium",
    "fixable": false,
    "tags": []
  },
  "R41": {
    "id": "R41",
    "name": "Negative Quantity",
    "severity": "high",
    "fixable": false,
    "tags": []
  },
  "R42": {
    "id": "R42",
    "name": "Future Birth Date",
    "severity": "high",
    "fixable": false,
    "tags": []
  },
  "R43": {
    "id": "R43",
    "name": "Past-Dated Transaction",
    "severity": "medium",
    "fixable": false,
    "tags": []
  },
  "R44": {
    "id": "R44",
    "name": "Invalid SKU Format",
    "severity": "medium",
    "fixable": false,
    "tags": []
  },
  "R45": {
    "id": "R45",
    "name": "Invalid Batch/Lot Number",
    "severity": "medium",
    "fixable": false,
    "tags": []
  },
  "R46": {
    "id": "R46",
    "name": "Invalid GL Account Format",
    "severity": "medium",
    "fixable": false,
    "tags": []
  },
  "R47": {
    "id": "R47",
    "name": "Mixed Languages Detected",
    "severity": "low",
    "fixable": false,
    "tags": []
  },
  "R48": {
    "id": "R48",
    "name": "Excessive Precision",
    "severity": "low",
    "fixable": true,
    "tags": []
  },
  "R49": {
    "id": "R49",
    "name": "Invalid JSON Structure",
    "severity": "high",
    "fixable": false,
    "tags": []
  },
  "R50": {
    "id": "R50",
    "name": "Invalid Base64 Encoding",
    "severity": "high",
    "fixable": false,
    "tags": []
  },
  "R51": {
    "id": "R51",
    "name": "Non-Integer Value",
    "severity": "high",
    "fixable": false,
    "tags": []
  },
  "R52": {
    "id": "R52",
    "name": "Non-Numeric Value",
    "severity": "high",
    "fixable": false,
    "tags": []
  },
  "R53": {
    "id": "R53",
    "name": "Invalid Boolean Value",
    "severity": "medium",
    "fixable": true,
    "tags": []
  },
  "R54": {
    "id": "R54",
    "name": "Missing Time Component",
    "severity": "medium",
    "fixable": false,
    "tags": []
  },
  "R55": {
    "id": "R55",
    "name": "Missing/Invalid Timezone",
    "severity": "medium",
    "fixable": false,
    "tags": []
  },
  "R56": {
    "id": "R56",
    "name": "Invalid Time Format",
    "severity": "high",
    "fixable": false,
    "tags": []
  },
  "R57": {
    "id": "R57",
    "name": "Time Out of Range",
    "severity": "medium",
    "fixable": false,
    "tags": []
  },
  "R58": {
    "id": "R58",
    "name": "Invalid UUID Format",
    "severity": "high",
    "fixable": false,
    "tags": []
  },
  "R59": {
    "id": "R59",
    "name": "Empty JSON Object/Array",
    "severity": "low",
    "fixable": false,
    "tags": []
  },
  "R60": {
    "id": "R60",
    "name": "Disposable Email Domain",
    "severity": "low",
    "fixable": false,
    "tags": []
  },
  "R61": {
    "id": "R61",
    "name": "Missing Country Code",
    "severity": "medium",
    "fixable": false,
    "tags": []
  },
  "R62": {
    "id": "R62",
    "name": "Missing URL Protocol",
    "severity": "low",
    "fixable": true,
    "tags": []
  },
  "R63": {
    "id": "R63",
    "name": "Currency Precision Mismatch",
    "severity": "low",
    "fixable": true,
    "tags": []
  },
  "R64": {
    "id": "R64",
    "name": "Luhn Checksum Failed",
    "severity": "high",
    "fixable": false,
    "tags": []
  },
  "R65": {
    "id": "R65",
    "name": "Barcode Checksum Failed",
    "severity": "high",
    "fixable": false,
    "tags": []
  },
  "R66": {
    "id": "R66",
    "name": "Leading Zeros in Numeric",
    "severity": "low",
    "fixable": true,
    "tags": []
  },
  "R67": {
    "id": "R67",
    "name": "Empty String Value",
    "severity": "low",
    "fixable": false,
    "tags": []
  },
  "R68": {
    "id": "R68",
    "name": "Invalid MAC Address Format",
    "severity": "medium",
    "fixable": false,
    "tags": []
  },
  "R69": {
    "id": "R69",
    "name": "Invalid Geo Coordinates",
    "severity": "medium",
    "fixable": false,
    "tags": []
  },
  "R70": {
    "id": "R70",
    "name": "Invalid SSN Format",
    "severity": "high",
    "fixable": false,
    "tags": []
  },
  "R71": {
    "id": "R71",
    "name": "Invalid Version Format",
    "severity": "low",
    "fixable": false,
    "tags": []
  },
  "R72": {
    "id": "R72",
    "name": "Invalid Hex Color",
    "severity": "low",
    "fixable": false,
    "tags": []
  },
  "R73": {
    "id": "R73",
    "name": "Invalid Corporate Domain",
    "severity": "medium",
    "fixable": false,
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
  if (!alias) {
    console.warn(`[type-catalog] Unknown type alias "${name}", falling back to "string"`);
    lineageCache.set(name, ["string"]);
    return ["string"];
  }
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
    // Unique constraint tracked as metadata; no duplicate primary key rule
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
