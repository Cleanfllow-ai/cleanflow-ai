// ─── Warehouse mapping utilities (dynamic, no predefined entity schemas) ─────

/**
 * Normalize a column name for comparison: lowercase, strip spaces/underscores/hyphens.
 */
function normalizeKey(value: string) {
    return value.toLowerCase().replace(/[\s_\-]+/g, '')
}

/**
 * Common synonyms for fuzzy matching.
 * Each group is a set of normalized tokens that are considered equivalent.
 */
const SYNONYMS: string[][] = [
    ["customername", "name", "contactname", "fullname", "displayname"],
    ["companyname", "company", "organisation", "organization", "orgname"],
    ["email", "emailaddress", "mail"],
    ["phone", "phonenumber", "telephone", "tel", "mobile"],
    ["address", "streetaddress", "street", "addressline1"],
    ["city", "town"],
    ["state", "province", "region"],
    ["zip", "zipcode", "postalcode", "postcode"],
    ["country", "countrycode", "countryname"],
    ["firstname", "fname", "givenname"],
    ["lastname", "lname", "surname", "familyname"],
    ["id", "identifier", "recordid"],
]

function findSynonymMatch(
    targetNorm: string,
    normalizedFileMap: Map<string, string>,
    used: Set<string>
): string | undefined {
    for (const group of SYNONYMS) {
        if (!group.includes(targetNorm)) continue
        for (const synonym of group) {
            const match = normalizedFileMap.get(synonym)
            if (match && !used.has(match)) return match
        }
    }
    return undefined
}

/**
 * Auto-map file columns to target table columns.
 * Strategy: 1) exact normalized match  2) synonym match  3) substring containment
 * targetColumns: actual column names from the existing warehouse table.
 * fileColumns: columns from the user's file.
 * Returns { targetCol: fileCol } mapping.
 */
export function autoMapColumns(
    targetColumns: string[],
    fileColumns: string[]
): Record<string, string> {
    const mapping: Record<string, string> = {}
    const normalizedFileMap = new Map(fileColumns.map((c) => [normalizeKey(c), c]))
    const used = new Set<string>()

    // Pass 1: exact normalized match
    for (const target of targetColumns) {
        const match = normalizedFileMap.get(normalizeKey(target))
        if (match && !used.has(match)) {
            mapping[target] = match
            used.add(match)
        }
    }

    // Pass 2: synonym match for unmapped targets
    for (const target of targetColumns) {
        if (mapping[target]) continue
        const match = findSynonymMatch(normalizeKey(target), normalizedFileMap, used)
        if (match) {
            mapping[target] = match
            used.add(match)
        }
    }

    // Pass 3: substring containment (target contains file col or vice versa)
    for (const target of targetColumns) {
        if (mapping[target]) continue
        const targetNorm = normalizeKey(target)
        for (const [fileNorm, fileCol] of normalizedFileMap) {
            if (used.has(fileCol)) continue
            if (
                (targetNorm.length >= 3 && fileNorm.includes(targetNorm)) ||
                (fileNorm.length >= 3 && targetNorm.includes(fileNorm))
            ) {
                mapping[target] = fileCol
                used.add(fileCol)
                break
            }
        }
    }

    return mapping
}
