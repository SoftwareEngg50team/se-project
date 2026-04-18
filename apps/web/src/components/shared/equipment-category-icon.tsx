"use client";

import type { LucideIcon } from "lucide-react";
import {
  AudioLines,
  Cable,
  LampCeiling,
  Mic2,
  MonitorPlay,
  Package,
  Power,
  Projector,
  Radio,
  Speaker,
  Sparkles,
  Wrench,
} from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  speakers: Speaker,
  subwoofers: AudioLines,
  amplifiers: Power,
  mixers: Radio,
  microphones: Mic2,
  "di boxes": Cable,
  "stage lights": LampCeiling,
  "moving heads": Sparkles,
  "lighting controllers": Wrench,
  "dmx accessories": Cable,
  trusses: MonitorPlay,
  generators: Power,
  "power distribution": Cable,
  "led walls": MonitorPlay,
  projectors: Projector,
};

export function EquipmentCategoryIcon({
  name,
  className = "size-4",
}: {
  name: string;
  className?: string;
}) {
  const Icon = iconMap[name.toLowerCase()] ?? Package;
  return <Icon className={className} />;
}
