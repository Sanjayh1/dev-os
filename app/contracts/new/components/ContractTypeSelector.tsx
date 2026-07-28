'use client'

// Spec: docs/specs/upload-extraction.md — dropdown, 'NDA' | 'MSA'.

export type ContractType = 'NDA' | 'MSA'

interface ContractTypeSelectorProps {
  value: ContractType
  onChange: (value: ContractType) => void
}

export function ContractTypeSelector({ value, onChange }: ContractTypeSelectorProps) {
  return (
    <div className="flex flex-col gap-xs">
      <label htmlFor="contract-type" className="text-body font-medium text-text-secondary">
        Contract type
      </label>
      <select
        id="contract-type"
        value={value}
        onChange={(e) => onChange(e.target.value as ContractType)}
        className="h-11 rounded-input border border-border-strong bg-white px-md text-body text-text-primary transition duration-150 ease-out focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
      >
        <option value="NDA">NDA</option>
        <option value="MSA">MSA</option>
      </select>
    </div>
  )
}
