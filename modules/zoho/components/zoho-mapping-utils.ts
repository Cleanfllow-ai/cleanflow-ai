// ─── Zoho Books field mapping definitions & helpers ───────────────────────────

export interface MappingField {
    key: string
    label: string
    required: boolean
    help: string
}

export function getMappingFields(entity: string): MappingField[] {
    if (entity === 'items') {
        return [
            { key: 'item_id', label: 'Item ID', required: false, help: 'Zoho item ID' },
            { key: 'name', label: 'Item Name', required: true, help: 'Zoho item name' },
            { key: 'description', label: 'Description', required: false, help: 'Item description' },
            { key: 'purchase_description', label: 'Purchase Description', required: false, help: 'Purchase description' },
            { key: 'sales_description', label: 'Sales Description', required: false, help: 'Sales description' },
            { key: 'rate', label: 'Rate', required: false, help: 'Unit price / rate' },
            { key: 'cost_price', label: 'Cost Price', required: false, help: 'Purchase rate/cost price' },
            { key: 'unit', label: 'Unit', required: false, help: 'Unit type' },
            { key: 'status', label: 'Status', required: false, help: 'Active/Inactive' },
            { key: 'stock_on_hand', label: 'Stock On Hand', required: false, help: 'Quantity on hand' },
            { key: 'reorder_level', label: 'Reorder Point', required: false, help: 'Reorder level' },
            { key: 'vendor_id', label: 'Preferred Vendor ID', required: false, help: 'Preferred vendor' },
        ]
    }
    if (entity === 'customers' || entity === 'vendors' || entity === 'contacts') {
        return [
            { key: 'contact_id', label: 'Contact ID', required: false, help: 'Zoho contact ID' },
            { key: 'contact_name', label: 'Contact Name', required: true, help: 'Customer/Vendor name' },
            { key: 'company_name', label: 'Company', required: false, help: 'Company name' },
            { key: 'email', label: 'Email', required: false, help: 'Email address' },
            { key: 'phone', label: 'Phone', required: false, help: 'Phone number' },
            { key: 'contact_type', label: 'Contact Type', required: false, help: 'customer/vendor' },
            { key: 'status', label: 'Status', required: false, help: 'Active/Inactive' },
            { key: 'currency_code', label: 'Currency Code', required: false, help: 'Currency code' },
            { key: 'created_time', label: 'Created Time', required: false, help: 'Created time' },
            { key: 'last_modified_time', label: 'Last Modified', required: false, help: 'Last modified time' },
            { key: 'billing_address', label: 'Billing Address', required: false, help: 'Address line 1' },
            { key: 'billing_city', label: 'Billing City', required: false, help: 'City' },
            { key: 'billing_state', label: 'Billing State', required: false, help: 'State' },
            { key: 'billing_zip', label: 'Billing Zip', required: false, help: 'Postal code' },
            { key: 'billing_country', label: 'Billing Country', required: false, help: 'Country' },
        ]
    }
    if (entity === 'invoices') {
        return [
            { key: 'invoice_id', label: 'Invoice ID', required: false, help: 'Zoho invoice ID' },
            { key: 'invoice_date', label: 'Invoice Date', required: false, help: 'Invoice date' },
            { key: 'customer_id', label: 'Customer ID', required: true, help: 'Zoho contact ID' },
            { key: 'status', label: 'Status', required: false, help: 'Invoice status' },
            { key: 'currency_code', label: 'Currency Code', required: false, help: 'Currency code' },
            { key: 'total', label: 'Total Amount', required: false, help: 'Invoice total' },
            { key: 'due_date', label: 'Due Date', required: false, help: 'Payment due date' },
            { key: 'notes', label: 'Notes', required: false, help: 'Invoice notes' },
            { key: 'line_items', label: 'Line Items', required: false, help: 'JSON array of line items' },
            { key: 'item_id', label: 'Item ID', required: false, help: 'Fallback if no line_items' },
            { key: 'item_name', label: 'Item Name', required: false, help: 'Item name' },
            { key: 'description', label: 'Description', required: false, help: 'Line description' },
            { key: 'quantity', label: 'Quantity', required: false, help: 'Fallback if no line_items' },
            { key: 'rate', label: 'Rate', required: false, help: 'Fallback if no line_items' },
            { key: 'line_amount', label: 'Line Amount', required: false, help: 'Line total amount' },
            { key: 'tax_id', label: 'Tax ID', required: false, help: 'Tax ID' },
        ]
    }
    if (entity === 'sales_orders') {
        return [
            { key: 'sales_order_id', label: 'Sales Order ID', required: false, help: 'Zoho sales order ID' },
            { key: 'order_date', label: 'Order Date', required: false, help: 'Order date' },
            { key: 'customer_id', label: 'Customer ID', required: true, help: 'Zoho contact ID' },
            { key: 'status', label: 'Status', required: false, help: 'Order status' },
            { key: 'currency_code', label: 'Currency Code', required: false, help: 'Currency code' },
            { key: 'total_amount', label: 'Total Amount', required: false, help: 'Order total' },
            { key: 'notes', label: 'Notes', required: false, help: 'Order notes' },
            { key: 'line_items', label: 'Line Items', required: false, help: 'JSON array of line items' },
            { key: 'item_id', label: 'Item ID', required: false, help: 'Fallback if no line_items' },
            { key: 'item_name', label: 'Item Name', required: false, help: 'Item name' },
            { key: 'description', label: 'Description', required: false, help: 'Line description' },
            { key: 'quantity', label: 'Quantity', required: false, help: 'Quantity' },
            { key: 'rate', label: 'Rate', required: false, help: 'Unit price / rate' },
            { key: 'line_amount', label: 'Line Amount', required: false, help: 'Line total' },
            { key: 'tax_id', label: 'Tax ID', required: false, help: 'Tax ID' },
        ]
    }
    if (entity === 'purchase_orders') {
        return [
            { key: 'purchase_order_id', label: 'Purchase Order ID', required: false, help: 'Zoho purchase order ID' },
            { key: 'po_date', label: 'PO Date', required: false, help: 'Purchase order date' },
            { key: 'vendor_id', label: 'Vendor ID', required: true, help: 'Zoho vendor ID' },
            { key: 'status', label: 'Status', required: false, help: 'Order status' },
            { key: 'currency_code', label: 'Currency Code', required: false, help: 'Currency code' },
            { key: 'total_amount', label: 'Total Amount', required: false, help: 'Order total' },
            { key: 'expected_receipt_date', label: 'Expected Receipt Date', required: false, help: 'Expected receipt date' },
            { key: 'notes', label: 'Notes', required: false, help: 'Order notes' },
            { key: 'line_items', label: 'Line Items', required: false, help: 'JSON array of line items' },
            { key: 'item_id', label: 'Item ID', required: false, help: 'Fallback if no line_items' },
            { key: 'item_name', label: 'Item Name', required: false, help: 'Item name' },
            { key: 'description', label: 'Description', required: false, help: 'Line description' },
            { key: 'quantity', label: 'Quantity', required: false, help: 'Quantity' },
            { key: 'rate', label: 'Rate', required: false, help: 'Unit price / rate' },
            { key: 'line_amount', label: 'Line Amount', required: false, help: 'Line total' },
            { key: 'tax_id', label: 'Tax ID', required: false, help: 'Tax ID' },
        ]
    }
    if (entity === 'inventory_items') {
        return [
            { key: 'item_id', label: 'Item ID', required: false, help: 'Zoho item ID' },
            { key: 'item_name', label: 'Item Name', required: true, help: 'Zoho item name' },
            { key: 'description', label: 'Description', required: false, help: 'Item description' },
            { key: 'purchase_description', label: 'Purchase Description', required: false, help: 'Purchase description' },
            { key: 'sales_description', label: 'Sales Description', required: false, help: 'Sales description' },
            { key: 'base_price', label: 'Base Price', required: false, help: 'Sales rate' },
            { key: 'cost_price', label: 'Cost Price', required: false, help: 'Purchase rate' },
            { key: 'unit_type', label: 'Unit Type', required: false, help: 'Unit type' },
            { key: 'status', label: 'Status', required: false, help: 'Active/Inactive' },
            { key: 'quantity_on_hand', label: 'Stock On Hand', required: false, help: 'Quantity on hand' },
            { key: 'reorder_point', label: 'Reorder Point', required: false, help: 'Reorder level' },
            { key: 'preferred_vendor_id', label: 'Preferred Vendor ID', required: false, help: 'Preferred vendor' },
        ]
    }
    return []
}

export function normalizeKey(value: string) {
    return value.toLowerCase().replace(/[\s_]+/g, '')
}

export function autoMapColumns(entity: string, columns: string[], dynamicFields?: MappingField[]) {
    const fields = dynamicFields && dynamicFields.length > 0 ? dynamicFields : getMappingFields(entity)
    const mapping: Record<string, string> = {}
    const normalized = new Map(columns.map((c) => [normalizeKey(c), c]))
    for (const field of fields) {
        if (mapping[field.key]) continue

        // 1. Match by normalized key
        const keyMatch = normalized.get(normalizeKey(field.key))
        if (keyMatch) { mapping[field.key] = keyMatch; continue }

        // 2. Match by normalized label
        const labelMatch = normalized.get(normalizeKey(field.label))
        if (labelMatch) { mapping[field.key] = labelMatch; continue }

        // 3. Hardcoded alternatives for common fields
        const alts: Record<string, string[]> = {
            contact_name: ['name', 'itemname', 'companyname', 'customername', 'vendorname', 'displayname'],
            item_name: ['itemname', 'name', 'productname', 'item'],
            name: ['itemname', 'name', 'productname'],
            customer_id: ['customerid', 'contactid', 'customer', 'contact'],
            vendor_id: ['vendorid', 'vendor', 'contactid', 'supplierid'],
            email: ['email', 'emailaddress', 'primaryemail'],
            phone: ['phone', 'phonenumber', 'primaryphone', 'telephone'],
            invoice_number: ['invoicenumber', 'invoiceno', 'docnumber'],
            bill_number: ['billnumber', 'billno', 'billid'],
        }
        const fieldAlts = alts[field.key]
        if (fieldAlts) {
            for (const a of fieldAlts) {
                const found = normalized.get(a)
                if (found) { mapping[field.key] = found; break }
            }
        }
    }
    return mapping
}

export function validateMapping(entity: string, mapping: Record<string, string>, columns: string[], dynamicFields?: MappingField[]) {
    const fields = dynamicFields && dynamicFields.length > 0 ? dynamicFields : getMappingFields(entity)
    const available = new Set(columns)
    for (const field of fields) {
        if (field.required) {
            const source = mapping[field.key]
            if (!source || !available.has(source)) {
                return { valid: false, message: `Missing required mapping for ${field.label}.` }
            }
        }
    }
    return { valid: true, message: '' }
}
