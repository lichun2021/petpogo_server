## Purpose

Let admins manage the set of hardware action codes (physical states hardware can detect and report), let pet hardware report the pet's current physical state as one of those codes, and let the App poll for the latest code plus its mapped GLB animation so it can play the matching animation. Monitoring of past reports is covered by the pet-event-log capability.

## ADDED Requirements

### Requirement: Admin manages hardware action codes
The system SHALL allow an authenticated admin to create, list, update, and soft-delete hardware action codes, each a status identifier describing a physical pet state as detected by hardware/sensing (e.g. lying down 躺卧, eating 进食, sitting 坐, walking 行走, standing 站立) — not itself an animation. Each code SHALL have a name/identifier, an admin-editable display name, icon, and enabled/disabled flag. The system SHALL seed five hardware action codes (lying down, eating, sitting, walking, standing) as initial data, but admins may create additional codes as hardware gains new detectable states, or delete existing ones; the set is not fixed.

#### Scenario: Admin creates a hardware action code
- **WHEN** an authenticated admin submits a code identifier, display name, and icon for a new hardware action code
- **THEN** the system creates the action code and it becomes a valid code hardware can subsequently report

#### Scenario: Admin lists hardware action codes
- **WHEN** an authenticated admin requests the list of hardware action codes
- **THEN** the system returns all non-deleted action codes with their current display name, icon, and enabled state

#### Scenario: Admin edits an action code's display metadata
- **WHEN** an authenticated admin updates the display name or icon of a hardware action code
- **THEN** the system persists the change and it is reflected in subsequent manifest and reporting responses

#### Scenario: Admin deletes a hardware action code
- **WHEN** an authenticated admin deletes a hardware action code
- **THEN** the system marks it as deleted, excludes it from the admin list, and hardware reports using that code are subsequently rejected as unknown

### Requirement: Admin maps each hardware action code to a GLB action resource
The system SHALL allow an authenticated admin to set or clear, for any hardware action code, a reference to a GLB action resource (see pet-resource-library) that supplies the animation to play when that code is the pet's current state. This mapping is independent of which codes exist: admins may change or clear it at any time without creating, renaming, or deleting the code itself.

#### Scenario: Admin maps an action code to a GLB action resource
- **WHEN** an authenticated admin sets a hardware action code's GLB action resource reference to an existing, enabled GLB action resource
- **THEN** the system persists the mapping and subsequent polls resolving that action code include the mapped resource's animation URL

#### Scenario: Admin maps an action code to a non-existent GLB action resource
- **WHEN** an authenticated admin submits a GLB action resource reference that does not exist or is deleted
- **THEN** the system rejects the mapping change and leaves the previous mapping (if any) unchanged

#### Scenario: Admin clears an action code's mapping
- **WHEN** an authenticated admin clears the GLB action resource reference for a hardware action code
- **THEN** subsequent polls resolving that action code return no animation URL for it until a new mapping is set

#### Scenario: Action code has no mapping yet
- **WHEN** an authenticated admin views a hardware action code that has never been mapped to a GLB action resource
- **THEN** the system shows it with no GLB action resource selected, distinct from an explicit invalid reference

### Requirement: Hardware reports current action code
The system SHALL accept a signed report from pet hardware (or its backend) indicating a device's current physical state, identified by device and one of the currently defined, non-deleted action codes, and record it as that device's latest known action code. The report SHALL carry only the code — it never carries or references a GLB file directly.

#### Scenario: Hardware reports a valid action code
- **WHEN** hardware sends an authenticated report identifying its device and a valid, non-deleted action code
- **THEN** the system stores this as the device's latest action code along with the report timestamp

#### Scenario: Hardware reports an unknown action code
- **WHEN** hardware sends a report with a code that is not currently defined (never created, or since deleted)
- **THEN** the system rejects the report and does not change the device's stored latest action code

#### Scenario: Report fails authentication
- **WHEN** a report is received without a valid signature
- **THEN** the system rejects the report with an authentication error

### Requirement: App polls current action and its resolved animation
The system SHALL allow an authenticated App user to poll for the latest reported action code of a pet's associated device, together with the GLB animation URL currently mapped to that code (if any), so the client can play the corresponding animation without a separate lookup.

#### Scenario: App polls for latest action
- **WHEN** an authenticated user requests the current action for a pet they own that has an associated device
- **THEN** the system returns the most recently reported action code, its report timestamp, and the GLB animation URL currently mapped to that code

#### Scenario: Reported action code has no GLB mapping
- **WHEN** an authenticated user polls for the current action and the reported code is not currently mapped to any GLB action resource
- **THEN** the system returns the action code and timestamp with no animation URL, rather than an error

#### Scenario: No action ever reported
- **WHEN** an authenticated user requests the current action for a device that has never reported an action
- **THEN** the system returns an empty/unknown result rather than an error

(Monitoring of historical hardware action reports is covered by the pet-event-log capability's unified pet event query, not duplicated here.)
