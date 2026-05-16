import type { AugmentationMode } from "../components/steps/augmentations-panel"

export function inferCardinality(srcCount: number, destCount: number, prompt: string): AugmentationMode {
  const p = prompt.toLowerCase()
  const fanOut = /\b(explode|split into rows|one row per|emit one row per|expand to|per month|per day)\b/.test(p)
  const fanIn  = /\b(group by|aggregate|sum of|average of|rollup|consolidate|fold|reduce)\b/.test(p)
  const manyToMany = fanOut && fanIn
  if (manyToMany) return "MANY_TO_MANY"
  if (fanOut)    return srcCount > 1 || destCount > 1 ? "MANY_TO_MANY" : "ONE_TO_MANY"
  if (fanIn)     return "MANY_TO_ONE"
  if (srcCount > 1 && destCount === 1) return "MANY_TO_ONE"
  if (srcCount === 1 && destCount > 1) return "ONE_TO_MANY"
  if (srcCount > 1 && destCount > 1)   return "MANY_TO_MANY"
  return "ONE_TO_ONE"
}

export const CARDINALITY_LABEL: Record<AugmentationMode, string> = {
  ONE_TO_ONE: "1→1", ONE_TO_MANY: "1→N", MANY_TO_ONE: "N→1", MANY_TO_MANY: "N→N",
}
