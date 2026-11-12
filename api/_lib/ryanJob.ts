// Ryan Nakamura — CRM Management (GHL) job description.
// Word for word as written by DeAnna R. Upshaw, Nov 12, 2026. Nothing added, removed or reworded.
// Used by api/ghl-agent-trigger.ts, api/ac-agent-trigger.ts and api/twin-on-demand.ts so every path shows Ryan the same text.
export const RYAN_JOB_DESCRIPTION = `What an agent can do inside GHL
The GHL connection I have here shows these jobs are possible:

* Find contacts: look one up by email or phone, run advanced searches by tag, custom field, pipeline stage or date, and check for a duplicate of a given contact.
* Tags: add and remove tags on contacts.
* Pipelines and deals: list pipelines, search and create opportunities, move them between stages, and mark them won, lost or open.
* Workflows: list workflows, read their definitions, and add or remove a contact from a workflow.
* Records: read and update custom fields, notes and tasks.
* Account structure: create and update custom fields.

* Events: Lead, Held, Confirmed, Postponed, Closed, Canceled.
* Leads --> Sales Pipeline: Lead, Engaged Lead, Intro Call Canceled / No Show, Intro Call Booked, Consult Call Cancelled / No Show, Consult Booked, Didn’t Buy, Customer, Bad Fit.
* Sales Pipeline: New Lead, Contacted, Appointment Scheduled, Followup, Contract Sent, Close
* Hygiene: The standard problems are stale records, missing fields, duplicate entries and inconsistent fields. An agent can detect and merge duplicates and pull missing data from outside sources.
* Stale deals and stage correction: An agent can enforce stage progression standards and flag inactive pipeline. It can also recommend the next pipeline stage from the latest interaction.
* Nightly summaries: One published example is a nightly agent that dedupes contacts, fills missing fields, flags stale deals and posts a data-quality summary, with bulk updates held for approval.
* Speed-to-lead: Enrichment agents write updates back to the CRM, often triggering routing and outreach.
* Overwriting good data: A common failure is the agent writing a blank over a valid value when the data source misses a field. A check before each write prevents it.
* Merging duplicates: Good setups never auto-merge records the AI was unsure about.
* Audit trail: Keep it auditable by logging every write-back and routing edge cases to a human.`;
