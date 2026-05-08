import type { ThreatLevel } from './types';

export interface TriggerDef {
  id: string;
  label: string;
  escalateTo: ThreatLevel;
}

export const TRIGGERS: readonly TriggerDef[] = [
  { id: 'airborne_transmission',  label: 'Confirmed airborne transmission case',           escalateTo: 'elevated' },
  { id: 'r0_above_one',           label: 'R0 estimate crosses above 1.0',                  escalateTo: 'elevated' },
  { id: 'doubling_48h',           label: 'Case count doubles within 48 hours',             escalateTo: 'moderate' },
  { id: 'spike_mutation',         label: 'New ANDV strain with Gn/Gc spike mutations',     escalateTo: 'moderate' },
  { id: 'no_known_exposure',      label: 'Case with NO close/prolonged exposure history',  escalateTo: 'moderate' },
  { id: 'who_above_low',          label: 'WHO raises risk assessment above LOW',           escalateTo: 'moderate' },
  { id: 'cdc_above_level3',       label: 'CDC raises above Level 3',                       escalateTo: 'moderate' },
  { id: 'community_transmission', label: 'Community transmission outside index contacts', escalateTo: 'elevated' },
  { id: 'twenty_countries',       label: 'Cases in 20+ countries',                         escalateTo: 'low' },
];

export const TRIGGER_BY_ID: Record<string, TriggerDef> = Object.fromEntries(
  TRIGGERS.map((t) => [t.id, t]),
);

export interface ThreatLevelToken {
  label: string;
  textCls: string;
  borderCls: string;
  dotCls: string;
}

export const THREAT_LEVEL_TOKEN: Record<ThreatLevel, ThreatLevelToken> = {
  minimal:  { label: 'MINIMAL',  textCls: 'text-green',          borderCls: 'border-green',          dotCls: 'bg-green' },
  low:      { label: 'LOW',      textCls: 'text-text-secondary', borderCls: 'border-text-secondary', dotCls: 'bg-text-secondary' },
  moderate: { label: 'MODERATE', textCls: 'text-amber',          borderCls: 'border-amber',          dotCls: 'bg-amber' },
  elevated: { label: 'ELEVATED', textCls: 'text-orange',         borderCls: 'border-orange',         dotCls: 'bg-orange' },
  high:     { label: 'HIGH',     textCls: 'text-red',            borderCls: 'border-red',            dotCls: 'bg-red' },
  critical: { label: 'CRITICAL', textCls: 'text-red',            borderCls: 'border-red',            dotCls: 'bg-red' },
};
