// Spec: docs/specs/upload-extraction.md — standard term lists per contract_type.
// Shared by the upload preview response and the extraction prompt's target-term list.

export type ContractType = 'NDA' | 'MSA'

export const STANDARD_TERMS: Record<ContractType, string[]> = {
  NDA: [
    'Disclosing Party',
    'Receiving Party',
    'Effective Date',
    'Term Length',
    'Confidentiality Scope',
    'Permitted Exceptions',
    'Governing Law',
    'Return/Destruction of Information Clause',
    'Remedies for Breach',
    'Termination Conditions',
  ],
  MSA: [
    'Client Party',
    'Service Provider Party',
    'Effective Date',
    'Term Length',
    'Scope of Services',
    'Payment Terms',
    'Governing Law',
    'Limitation of Liability',
    'Indemnification Clause',
    'Confidentiality Clause',
    'Termination Conditions',
    'Dispute Resolution Mechanism',
  ],
}
