# Hackathon and Project Schema

This is a compact map of the Builder Hub schema around hackathons, projects, registrations, members, submissions, and judging.

## Core Entity Diagram

```mermaid
erDiagram
    HACKATHON ||--o{ PROJECT : "contains"
    HACKATHON ||--o{ REGISTER_FORM : "has registrations"
    USER ||--o{ REGISTER_FORM : "submits registration"

    PROJECT ||--o{ MEMBER : "has members"
    USER ||--o{ MEMBER : "joins project"

    PROJECT ||--o{ FORM_DATA : "stores submission state"
    FORM_DATA ||--o{ EVALUATION : "receives evaluations"
    USER ||--o{ EVALUATION : "evaluates"

    PROJECT ||--o{ PRIZE : "receives prizes"

    HACKATHON {
        string id PK
        string title
        string description
        datetime start_date
        datetime end_date
        string timezone
        boolean is_public
        string created_by FK
        string updated_by FK
    }

    USER {
        string id PK
        string email UK
        string name
        string user_name
        string custom_attributes[]
        string country
        string github
    }

    REGISTER_FORM {
        string id PK
        string hackathon_id FK
        string email FK
        string name
        string role
        string hackathon_participation
        datetime created_at
    }

    PROJECT {
        string id PK
        string hackaton_id FK
        string project_name
        string short_description
        string full_description
        string origin
        boolean is_winner
        datetime created_at
        datetime updated_at
    }

    MEMBER {
        string id PK
        string project_id FK
        string user_id FK
        string email
        string role
        string status
    }

    FORM_DATA {
        string id PK
        string project_id FK
        string origin
        json form_data
        int current_stage
        string final_verdict
        datetime timestamp
    }

    EVALUATION {
        string id PK
        string form_data_id FK
        string evaluator_id FK
        string verdict
        string comment
        float score_overall
        json scores
        int stage
        datetime created_at
    }

    PRIZE {
        string id PK
        string project_id FK
        int prize
        string track
        string icon
    }
```

## How To Read It

- `Hackathon -> Project` is the main parent/child relationship.
- `Hackathon -> RegisterForm -> User` tracks registrations for a hackathon.
- `Project -> Member -> User` tracks who belongs to the team.
- `Project -> FormData` holds submission state and program-specific payloads.
- `FormData -> Evaluation -> User` is the judging / review flow.
- `Project -> Prize` is the public project prize relation already in BH.

## Build Games Notes

For Build Games specifically, the important current path is:

- the Build Games project still lives in `Project`
- stage and submission state live in `FormData`
- the stage field already used by Builder Hub is `FormData.current_stage`
- Build Games-specific submission payloads live under `form_data.build_games`
- evaluations are attached to the relevant `FormData` row

So the practical Build Games chain today is:

```mermaid
flowchart LR
    H["Hackathon (Build Games)"] --> P["Project"]
    P --> F["FormData (origin = build_games)"]
    F --> S["current_stage"]
    F --> J["form_data.build_games JSON"]
    F --> E["Evaluation rows"]
```

## Important Implementation Notes

- The actual foreign key field on `Project` is named `hackaton_id` in the schema.
- `User.custom_attributes` is a `String[]`, not a JSON role object.
- `FormData` is the correct place to look for Build Games progression and review state.
