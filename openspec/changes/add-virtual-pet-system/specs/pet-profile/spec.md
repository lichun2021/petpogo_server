## Purpose

Give App users full control over their own pet profiles (create, view, edit, remove) and give admins visibility and correction ability over all pet profiles in the system.

## ADDED Requirements

### Requirement: App user creates a pet profile
The system SHALL allow an authenticated App user to create a pet profile with at least a name, and optional species, breed, gender, birthday, weight, bio, avatar, and associated device.

#### Scenario: Successful creation
- **WHEN** an authenticated user submits a pet name and optional profile fields
- **THEN** the system creates a new pet record owned by that user and returns its id

#### Scenario: Missing required name
- **WHEN** an authenticated user submits a create request without a name
- **THEN** the system rejects the request with a validation error and creates no record

### Requirement: App user lists their own pets
The system SHALL return only non-deleted pets owned by the requesting user when listing pets.

#### Scenario: List own pets
- **WHEN** an authenticated user requests their pet list
- **THEN** the system returns all of that user's non-deleted pet profiles and no pets belonging to other users

### Requirement: App user views a single pet profile
The system SHALL return the full profile of a pet when the requesting user owns that pet and it has not been deleted.

#### Scenario: Owner views existing pet
- **WHEN** an authenticated user requests a pet profile they own
- **THEN** the system returns that pet's full profile

#### Scenario: Non-owner views pet
- **WHEN** an authenticated user requests a pet profile owned by a different user
- **THEN** the system rejects the request with a not-found or forbidden error

### Requirement: App user updates their pet profile
The system SHALL allow the owning user to update mutable profile fields (name, avatar, species, breed, gender, birthday, weight, bio, associated device) on a pet they own.

#### Scenario: Owner updates profile fields
- **WHEN** an authenticated user submits updated fields for a pet they own
- **THEN** the system persists the changes and returns the updated profile

#### Scenario: Non-owner attempts update
- **WHEN** an authenticated user submits an update for a pet they do not own
- **THEN** the system rejects the request and makes no changes

### Requirement: App user soft-deletes their pet profile
The system SHALL mark a pet profile as deleted rather than removing its row, and excluded deleted pets from all subsequent list/detail/status responses for that user.

#### Scenario: Owner deletes pet
- **WHEN** an authenticated user requests deletion of a pet they own
- **THEN** the system marks the pet as deleted and it no longer appears in that user's pet list

#### Scenario: Non-owner attempts delete
- **WHEN** an authenticated user requests deletion of a pet they do not own
- **THEN** the system rejects the request and the pet remains unchanged

### Requirement: Admin lists and searches pet profiles
The system SHALL allow an authenticated admin to list non-deleted pet profiles across all users, paginated, and filterable by owner user id and/or keyword (pet name).

#### Scenario: Admin lists all pets
- **WHEN** an authenticated admin requests the pet list with a page and page size
- **THEN** the system returns a paginated list of non-deleted pets with a total count

#### Scenario: Admin filters by user
- **WHEN** an authenticated admin requests the pet list filtered by a specific user id
- **THEN** the system returns only that user's non-deleted pets

### Requirement: Admin views and edits any pet profile
The system SHALL allow an authenticated admin to view the full detail of, and edit the mutable fields of, any non-deleted pet profile regardless of owner.

#### Scenario: Admin edits a pet profile
- **WHEN** an authenticated admin submits updated fields for any existing pet
- **THEN** the system persists the changes and returns the updated profile

### Requirement: Admin soft-deletes a pet profile
The system SHALL allow an authenticated admin to soft-delete any pet profile.

#### Scenario: Admin deletes a pet
- **WHEN** an authenticated admin requests deletion of a pet
- **THEN** the system marks that pet as deleted and it is excluded from subsequent list and detail responses
