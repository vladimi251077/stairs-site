# Calculator benchmark audit (report template)

## Benchmark scenario
- Base: existing metal frame
- Shape: U-turn with landing
- Steps: 16 total
- Width: 900 mm
- Landing: 900 × 2000 mm
- Railing: metal (proxy for 16 mm tubes)
- Upper balustrade: 1100 mm
- Finish: MDF (missing direct UI option)
- Coating: enamel (missing direct UI option)
- Cladding: full

## Target price
- **290 000 ₽**

## Important notes for this PR
- This PR adds transparent debug breakdown only.
- This PR does **not** change formulas, rates, coefficients, or pricing behavior.
- This PR does **not** change Supabase schema, backend/API, or admin pricing model.

## Missing direct UI options
- MDF finish option is not present in current finish material selector.
- Enamel coating option is not present as separate coating option.
- 16 mm tube railing is not present as separate railing option (using `metal` as proxy).

## Expected outputs from debug mode
- `window.__lastCalculation` after each successful run in `/calculator.html?debugPrice=1`
- Console breakdown with line-item subtotals and coefficients.
