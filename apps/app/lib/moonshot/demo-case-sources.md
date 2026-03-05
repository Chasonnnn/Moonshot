# Demo Case Sources and Adaptation Policy

This document tracks external inspiration used for Demo V2 fixture content in `/demo`.

## Rewrite Policy

- Use public prompt patterns only as inspiration, not as direct copy.
- Do not use verbatim company prompts or scoring language.
- Normalize all cases to Moonshot entities, datasets, and telemetry semantics.
- Keep deterministic fixture behavior so outputs are reproducible across runs.

## Source Set

1. Weulass data-science take-home collection: <https://github.com/Weulass/Data-Science-Take-Home-Assignments>
2. Airbnb new-grad assignment: <https://raw.githubusercontent.com/Weulass/Data-Science-Take-Home-Assignments/master/Airbnb%20New%20grad/README.md>
3. Stord network optimization assignment: <https://raw.githubusercontent.com/Weulass/Data-Science-Take-Home-Assignments/master/Stord/README.md>
4. Klaviyo data-science exercise: <https://raw.githubusercontent.com/Weulass/Data-Science-Take-Home-Assignments/master/Klaviyo/Readme>
5. AB pricing challenge: <https://github.com/bertlee272/AB_Testing_Pricing_Test>

## Moonshot Demo Mapping

- `tpl_jda_quality`: discrepancy triage, reconciliation SQL, escalation judgment.
- `tpl_data_analyst`: product/marketplace metric prioritization and root-cause storytelling.
- `tpl_jda_ambiguity`: ambiguous stakeholder request handling and scoped decision framing.
- `tpl_doordash_enablement`: 4-week marketplace growth case prep with fixture + live demo pressure testing.
- Round-2 analytics fixtures: purchase/cohort and model-critique style artifacts (Python + R).
- Round-3 dashboard fixtures: pricing/segment recommendation framing and tradeoff communication.
