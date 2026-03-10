"use client"

import type { FileStatusResponse } from "@/modules/files"

import { ProfessionalChartsCarousel } from "@/modules/dashboard/components/professional-charts-carousel"

interface ChartsCarouselProps {
  files: FileStatusResponse[]
}

export function ChartsCarousel({ files }: ChartsCarouselProps) {
  return <ProfessionalChartsCarousel files={files} />
}

