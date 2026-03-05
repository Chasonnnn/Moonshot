# DoorDash 4-Week Enablement Operator Runbook

## Setup
1. Select template `tpl_doordash_enablement` in Demo Console.
2. Use fixture mode for deterministic baseline and live mode for pressure testing.
3. Ensure candidate session policy includes `demo_template_id=tpl_doordash_enablement`.

## Weekly Execution Checklist
### Week 1
- Confirm candidate defines sales proxy and caveats.
- Confirm data-quality checklist includes mixed-scale percentages and outlier checks.

### Week 2
- Confirm managed vs unmanaged benchmark and funnel decomposition are complete.
- Confirm SQL timed set includes running-total/window-function query.

### Week 3
- Confirm intervention plan maps to diagnosed gaps.
- Confirm pilot design includes treatment/control split and guardrails.
- Confirm ROI model includes support-cost assumptions.

### Week 4
- Run full 8-minute presentation with strict timebox.
- Ask 10 challenge questions on assumptions, causality, and scalability.
- Log contradictions and revision quality.

## Review Workflow
1. Score with 6-dimension rubric.
2. Capture top 3 failure patterns by severity.
3. Assign drill set for next cycle.

## Failure Pattern Taxonomy
- Data-quality discipline failures: mixed scales, outlier sensitivity, missing-value handling.
- Reasoning failures: causal overclaim, non-actionable recommendation, missing trade-off analysis.
- Communication failures: weak headline, chart overload, unclear decision ask.

## Exit Criteria
Candidate exits program when all gates pass in one full cycle:
- Case completion gate
- Live defense gate
- Transferability gate
