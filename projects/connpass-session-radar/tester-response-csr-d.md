# Tester response: CSR-D reviewer findings

The approved v0.3 seam now supplies a fixed synthetic canary for the existing
`FETCH_FAILURE` fixture. The tester translation uses that exact contract value:

`CSR_D_04_SYNTHETIC_PRIVATE_CANARY_NOT_A_REAL_SECRET`

CSR-D-04 now asserts that the recipient-visible failure summary does not contain the canary,
while retaining the approved checks for one attempted notification, `failure` kind, empty event
list, and string summary. The path remains FETCH_FAILURE-only; no list-build failure fixture was
added. The earlier v0.2 escalation about the lack of an observation oracle is resolved for this
specific synthetic canary by the approved v0.3 contract.
