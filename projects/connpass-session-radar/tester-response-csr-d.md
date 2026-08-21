# Tester response: CSR-D reviewer findings

## Addressed within approved v0.2 seams

- **CSR-D-01:** The step now requires the recipient-visible `matching-event` to use the approved
  `remaining-estimate` capacity kind and to carry an integer `remainingSeats` value.
- **CSR-D-07:** The runner now validates the approved `CommittedInterestConditions` representation:
  `sourceFormat: yaml`, `committed: true`, the expected `revisionRef`, and a non-empty profile set.
  It continues to use the approved `revised-conditions` fixture for the changed-condition case.
- **CSR-D-04 safe summary:** The step retains the approved recipient-visible failure capture and checks
  its failure kind, empty event list, one-notification cardinality, and string summary. It no longer
  uses a partial keyword blacklist that could falsely imply complete secrecy coverage.

## Remaining non-inferable issue requiring escalation

The approved v0.2 contract cannot independently exercise a failure while creating/normalizing the
daily list. Its only `FixtureEventSource.mode` for CSR-D-04 is `FETCH_FAILURE`, explicitly defined as
an acquisition-stage failure, and `AcceptanceRunInput.fixtureRef` has no list-creation-failure value.
The recipient capture has no oracle for arbitrary private configuration values or raw external error
payloads either. Therefore the tester cannot add a second CSR-D-04 failure path or claim exhaustive
secret exclusion without inventing an input/observation seam beyond v0.2. This remains escalated rather
than being filled by an implementation-specific assumption.
