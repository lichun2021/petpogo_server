## Purpose

Give each pet a simple set of养成-game vital stats (satiety, mood, cleanliness) that decay over time and respond to user interactions, so the App can show pet condition and gate/encourage interactions.

## ADDED Requirements

### Requirement: Pet has vital stats
Every pet profile SHALL have three vital stat values: satiety (饱腹度), mood (心情值), and cleanliness (清洁度), each an integer in the range 0-100, defaulting to a full/neutral value when the pet is created.

#### Scenario: New pet has default stats
- **WHEN** a user creates a new pet profile
- **THEN** the pet's satiety, mood, and cleanliness are all initialized to their default value

### Requirement: Vital stats decay over time
The system SHALL reduce a pet's satiety, mood, and cleanliness over elapsed time according to configured decay rates, without allowing any stat to fall below 0.

#### Scenario: Stats decay since last interaction
- **WHEN** a user requests a pet's current status after time has elapsed since the last recorded update
- **THEN** the system computes and returns decayed stat values reflecting the elapsed time, floored at 0

### Requirement: App user queries current vital stats
The system SHALL allow the owning user to fetch the current (decay-applied) satiety, mood, and cleanliness values for a pet they own.

#### Scenario: Owner queries pet status
- **WHEN** an authenticated user requests the status of a pet they own
- **THEN** the system returns the current satiety, mood, and cleanliness values

#### Scenario: Non-owner queries pet status
- **WHEN** an authenticated user requests the status of a pet they do not own
- **THEN** the system rejects the request

### Requirement: Interactions modify vital stats
The system SHALL apply the configured stat effects of an interaction type (see pet-resource-library) to a pet's current stats when that interaction is performed, capping each resulting stat between 0 and 100.

#### Scenario: Feeding interaction increases satiety
- **WHEN** an authenticated user performs a feeding-type interaction on a pet they own
- **THEN** the system increases that pet's satiety by the interaction's configured effect, capped at 100, and persists the new stat values

#### Scenario: Cleaning interaction increases cleanliness
- **WHEN** an authenticated user performs a cleaning-type interaction on a pet they own
- **THEN** the system increases that pet's cleanliness by the interaction's configured effect, capped at 100, and persists the new stat values

#### Scenario: Interaction on a pet not owned by the user
- **WHEN** an authenticated user attempts an interaction on a pet they do not own
- **THEN** the system rejects the request and does not modify any stats
