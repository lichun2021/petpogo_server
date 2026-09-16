## Purpose

Give admins a way to manage the shared library of backgrounds, 3D pet models (GLB), GLB action resources (playable animation files), and interaction types (each configurable with an animation and stat effects) that the App draws on, and give the App a single manifest to discover what is currently available.

## ADDED Requirements

### Requirement: Admin manages backgrounds
The system SHALL allow an authenticated admin to create, list, update, and soft-delete background entries, each with a name, an image URL, and an enabled/disabled flag.

#### Scenario: Admin creates a background
- **WHEN** an authenticated admin submits a name and an uploaded image URL for a new background
- **THEN** the system creates a background entry and returns its id

#### Scenario: Admin disables a background
- **WHEN** an authenticated admin sets a background's enabled flag to false
- **THEN** the background is excluded from the App-facing resource manifest but remains visible in the admin list

#### Scenario: Admin deletes a background
- **WHEN** an authenticated admin deletes a background
- **THEN** the system marks it as deleted and excludes it from both the admin list and the App-facing manifest

### Requirement: Admin manages pet models (GLB)
The system SHALL allow an authenticated admin to create, list, update, and soft-delete pet model entries, each with a name, a GLB model file URL, a preview thumbnail URL, and an enabled/disabled flag.

#### Scenario: Admin creates a pet model
- **WHEN** an authenticated admin submits a name and an uploaded GLB file URL for a new pet model
- **THEN** the system creates a pet model entry and returns its id

#### Scenario: Admin deletes a pet model
- **WHEN** an authenticated admin deletes a pet model
- **THEN** the system marks it as deleted and excludes it from both the admin list and the App-facing manifest

### Requirement: Admin manages GLB action resources
The system SHALL allow an authenticated admin to create, list, update, and soft-delete GLB action resources, each representing a single playable animation with a name, a GLB file URL, an optional preview/description, and an enabled/disabled flag. A GLB action resource SHALL be independent of any interaction type or hardware action code — it is a standalone animation asset that other entities reference by id.

#### Scenario: Admin creates a GLB action resource
- **WHEN** an authenticated admin submits a name and an uploaded GLB file URL for a new GLB action resource
- **THEN** the system creates the GLB action resource and returns its id, independent of any interaction type or hardware action code

#### Scenario: Admin updates a GLB action resource's file
- **WHEN** an authenticated admin replaces the GLB file URL of an existing GLB action resource
- **THEN** every interaction type or hardware action code currently referencing that resource reflects the updated file on next lookup

#### Scenario: Admin deletes a GLB action resource still referenced elsewhere
- **WHEN** an authenticated admin soft-deletes a GLB action resource that is currently referenced by an interaction type or a hardware action code
- **THEN** the system still marks it as deleted and excludes it from the admin list and App-facing manifest, and referencing entities resolve to no animation until re-mapped

### Requirement: Admin manages interaction types
The system SHALL allow an authenticated admin to create, list, update, and soft-delete interaction types (e.g. feed 喂食, play/tease 逗猫, clean 清洁), each with a name, an icon URL, an enabled/disabled flag, a reference to a GLB action resource (by id) supplying its animation, and a set of vital-stat effects (satiety/mood/cleanliness deltas, any of which may be zero). An interaction type SHALL NOT store its own GLB file URL directly — only a reference to a GLB action resource. The system SHALL seed three interaction types (feed, play/tease, clean) as initial data, but admins may create additional interaction types or delete existing ones; the set is not fixed.

#### Scenario: Admin creates an interaction type
- **WHEN** an authenticated admin submits a name, icon, a reference to an existing GLB action resource, and stat effects for a new interaction type
- **THEN** the system creates the interaction type and returns its id

#### Scenario: Admin creates an interaction type referencing an unknown GLB action resource
- **WHEN** an authenticated admin submits a GLB action resource reference that does not exist or is deleted
- **THEN** the system rejects the request and creates no interaction type

#### Scenario: Admin lists interaction types
- **WHEN** an authenticated admin requests the list of interaction types
- **THEN** the system returns all non-deleted interaction types with their current display name, icon, enabled state, GLB action resource reference, and stat effects

#### Scenario: Admin deletes an interaction type
- **WHEN** an authenticated admin deletes an interaction type
- **THEN** the system marks it as deleted and excludes it from both the admin list and the App-facing manifest, and it can no longer be performed on any pet

### Requirement: Admin configures an interaction type's animation and stat effects
The system SHALL allow an authenticated admin to set or clear, for any interaction type, a reference to a GLB action resource, and to independently set each of the three vital-stat effect values (satiety/mood/cleanliness delta, positive, negative, or zero) applied when that interaction is performed.

#### Scenario: Admin maps an interaction type to a GLB action resource
- **WHEN** an authenticated admin sets an interaction type's GLB action resource reference to an existing, enabled GLB action resource
- **THEN** the system persists the mapping and subsequent App requests for that interaction type return the mapped resource's animation URL

#### Scenario: Admin maps an interaction type to a non-existent GLB action resource
- **WHEN** an authenticated admin submits a GLB action resource reference that does not exist or is deleted
- **THEN** the system rejects the mapping change and leaves the previous mapping (if any) unchanged

#### Scenario: Admin clears an interaction type's mapping
- **WHEN** an authenticated admin clears the GLB action resource reference for an interaction type
- **THEN** subsequent App requests for that interaction type return no animation URL for it until a new mapping is set

#### Scenario: Admin updates an interaction type's stat effects
- **WHEN** an authenticated admin updates the satiety, mood, and/or cleanliness effect values of an interaction type
- **THEN** the system persists the new values and subsequent interactions of that type apply the updated effects instead of the previous ones

### Requirement: Resource upload signing supports GLB and images
The system SHALL provide an admin-facing upload-sign endpoint that issues a time-limited direct-upload URL for both image (background/thumbnail) and GLB model files, without proxying the file bytes through the server.

#### Scenario: Admin requests a signed upload URL for a GLB file
- **WHEN** an authenticated admin requests an upload signature for a `.glb` file
- **THEN** the system returns a signed URL the admin can use to upload the file directly to object storage, along with the resulting public URL

#### Scenario: Admin requests a signed upload URL for an image
- **WHEN** an authenticated admin requests an upload signature for an image file
- **THEN** the system returns a signed URL for direct upload and the resulting public URL

### Requirement: App fetches the resource manifest
The system SHALL provide an endpoint that returns, in a single response, all currently enabled backgrounds, pet models, GLB action resources, and interaction types (each with its display metadata and resolved resource URLs, with interaction types including the resolved animation URL of their referenced GLB action resource) for the App to render as user-selectable options and to play animations.

#### Scenario: App requests the resource manifest
- **WHEN** an authenticated App user requests the pet resource manifest
- **THEN** the system returns the current lists of enabled backgrounds, pet models, GLB action resources, and interaction types (with each interaction type's resolved animation URL) with their URLs and metadata

#### Scenario: Disabled or deleted resources are excluded
- **WHEN** a background, pet model, GLB action resource, or interaction type is disabled or deleted
- **THEN** it does not appear in the App-facing resource manifest
