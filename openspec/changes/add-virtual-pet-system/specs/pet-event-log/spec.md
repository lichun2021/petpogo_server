## Purpose

Give admins a single, unified place to see everything that happened to a pet — both App-triggered interactions (feed/play/clean etc.) and hardware-reported physical state changes — instead of having to check two separate, unrelated logs.

## ADDED Requirements

### Requirement: System records a pet event for every interaction and every hardware report
The system SHALL append one pet event record whenever an App user successfully performs an interaction on a pet, and whenever hardware successfully reports a current action code for a device. Each event SHALL record the source type (interaction or hardware-action), the pet and/or device involved, the specific interaction type or action code, and a timestamp. A failed or rejected interaction or report (e.g. unknown type/code, ownership mismatch, invalid signature) SHALL NOT produce an event record.

#### Scenario: Interaction produces an event
- **WHEN** an authenticated user successfully performs an interaction (e.g. feed) on a pet they own
- **THEN** the system appends a pet event recording the interaction source, the pet, the interaction type, and the time it occurred

#### Scenario: Hardware report produces an event
- **WHEN** hardware successfully reports a valid current action code for a device
- **THEN** the system appends a pet event recording the hardware-action source, the device (and associated pet, if resolvable), the action code, and the time it occurred

#### Scenario: Rejected interaction produces no event
- **WHEN** an interaction request is rejected (unknown interaction type, disabled interaction type, or the pet is not owned by the requester)
- **THEN** the system does not append any pet event

#### Scenario: Rejected hardware report produces no event
- **WHEN** a hardware report is rejected (invalid signature or unknown action code)
- **THEN** the system does not append any pet event

### Requirement: Admin queries the unified pet event log
The system SHALL allow an authenticated admin to view a paginated list of pet events, filterable by pet, by device, by source type (interaction vs. hardware-action), and by a time range, ordered most-recent-first.

#### Scenario: Admin lists recent events across both sources
- **WHEN** an authenticated admin requests the pet event list with no filters
- **THEN** the system returns a paginated list of pet events from both interaction and hardware-action sources, most recent first

#### Scenario: Admin filters by pet
- **WHEN** an authenticated admin filters the event list by a specific pet
- **THEN** the system returns only events associated with that pet, regardless of source type

#### Scenario: Admin filters by source type
- **WHEN** an authenticated admin filters the event list to interaction-only or hardware-action-only
- **THEN** the system returns only events of the requested source type

#### Scenario: Admin filters by device and time range
- **WHEN** an authenticated admin filters the event list by device and a start/end time range
- **THEN** the system returns only that device's events reported within the given time range
