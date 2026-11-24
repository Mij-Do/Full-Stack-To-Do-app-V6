'use client';

import { MAX_RECURRENCE_INTERVAL, recurrenceChoiceSchema, type RecurrenceChoice } from '@/lib/validations/task';

interface RecurrenceFieldsProps {
  idPrefix: string;
  frequency: RecurrenceChoice;
  interval: number;
  onFrequencyChange: (value: RecurrenceChoice) => void;
  onIntervalChange: (value: number) => void;
  disabled?: boolean;
  intervalError?: string;
}

export function RecurrenceFields({ idPrefix, frequency, interval, onFrequencyChange, onIntervalChange, disabled = false, intervalError }: RecurrenceFieldsProps) {
  const frequencyId = `${idPrefix}-recurrence-frequency`;
  const intervalId = `${idPrefix}-recurrence-interval`;
  return <fieldset className="space-y-2 rounded-lg border p-3">
    <legend className="px-1 text-sm font-medium">Recurrence</legend>
    <label htmlFor={frequencyId} className="block text-sm">Repeat</label>
    <select
      id={frequencyId}
      value={frequency}
      disabled={disabled}
      onChange={(event) => {
        const value = recurrenceChoiceSchema.safeParse(event.target.value);
        if (value.success) onFrequencyChange(value.data);
      }}
      className="h-9 w-full rounded-md border border-input bg-background px-2.5 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
    >
      <option value="none">No recurrence</option>
      <option value="daily">Daily</option>
      <option value="weekly">Weekly</option>
      <option value="monthly">Monthly</option>
    </select>
    {frequency !== 'none' && <>
      <label htmlFor={intervalId} className="block text-sm">Repeat every</label>
      <input
        id={intervalId}
        type="number"
        min={1}
        max={MAX_RECURRENCE_INTERVAL}
        step={1}
        value={Number.isFinite(interval) ? interval : ''}
        disabled={disabled}
        onChange={(event) => onIntervalChange(event.target.value === '' ? 0 : Number(event.target.value))}
        aria-invalid={Boolean(intervalError)}
        className="h-9 w-full rounded-md border border-input bg-background px-2.5 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive disabled:opacity-50"
      />
      <p className="text-xs text-muted-foreground">Enter a positive whole number. A due date is required.</p>
      {intervalError && <p role="alert" className="text-sm text-destructive">{intervalError}</p>}
    </>}
  </fieldset>;
}
