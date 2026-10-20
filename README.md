# Stroom — Social Discovery & Vibe Quiz Onboarding Application

**Stroom** is a social discovery application that helps users discover communities, meet new friends, join social meetups, explore travel opportunities, and connect with like-minded people.

The application features a post-login **Dynamic Vibe Quiz Onboarding Experience** and a real-time **Admin CMS Dashboard** for managing quiz questions, answer options, versions, and publication.

---

## 🌟 Key Features

### 1. Dynamic Vibe Quiz & Post-Login Flow
- **Seamless State Machine:** `NOT_STARTED` → `IN_PROGRESS` → `COMPLETED` / `SKIPPED`.
- **First Login Integration:** Automatically guides new users to the Welcome Screen.
- **Dynamic Backend Loading:** Questions and options are loaded from the active published quiz version.
- **Single & Multi-Select:** Supports single choice with auto-validation and multi-choice with configurable `min_selections` and `max_selections`.
- **Session Continuity & Answer Persistence:** In-progress quizzes can be resumed at any time without losing previous selections.
- **Skippable by Design:** Users can skip at any time without having answers fabricated; subsequent logins direct them straight to Home with general recommendations.
- **Celebratory Completion:** Confetti animation, normalized preference tags mapping (`#travel-adventure`, `#friendship`, `#social-meetups`, etc.), and direct routing to their personalized feed.

### 2. Personalized Discovery Feed
- **Real-Time Vibe Matching:** Discovery items (communities, meetups, like-minded people, and trips) are scored and ranked according to active preference tags.
- **Match Badges:** Shows match percentage badges (e.g. `98% Vibe Match`) and highlights matching interest tags.
- **Fallback for Skipped Users:** Clean, inviting discovery feed with an unobtrusive banner allowing users to take the quiz whenever they want.
- **Category Filters & Search:** Easily filter by Communities, Meetups, People, and Trips, or search by keywords.

### 3. Profile & Preferences Management
- View active vibe preference tags.
- Add or remove tags directly from Profile.
- One-click **"Retake Vibe Quiz"** to re-calibrate discovery recommendations anytime.
- Interactive **One-Click QA Testing Switcher** for instant simulation of all user states (`NOT_STARTED`, `SKIPPED`, `COMPLETED`, `ADMIN`).

### 4. Admin Quiz Management CMS
- **Live Metrics Overview:** Total sessions, completion rate %, skip rate %, in-progress count, and registered user metrics.
- **Immutable Versioning:** Published quiz versions are locked; administrators make changes in a draft version cloned from active.
- **Question & Option CRUD:** Add, edit, reorder, and delete questions and options.
- **Stable Preference Values:** Administrators assign stable preference keys (e.g. `travel_adventure`) to ensure consistent matching even when display labels change.
- **Interactive Mobile Device Preview:** A real-time smartphone simulator embedded right into the admin CMS so administrators can test the exact quiz experience before publishing.
- **Publication Safety & Archiving:** Validates that all questions have at least 2 active options and valid selection limits before publishing.

---

## 🔐 Demo Accounts for Testing

| Role | Email | Password | Behavior / Focus |
| :--- | :--- | :--- | :--- |
| **New User** | `user@stroom.app` | `User@123` | Starts with `NOT_STARTED` to test Welcome Screen, Vibe Quiz, and Completion |
| **Administrator** | `admin@stroom.app` | `Admin@123` | Full access to Admin CMS Dashboard, Question Editor, and Publishing |

*(Note: The login view also features **One-Click Instant Access** buttons for both accounts.)*

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- npm

### Installation
```bash
npm install
```

### Running the Application

#### Production Mode (Built Client + Server):
```bash
npm run build
npm start
```
Open [http://localhost:5000](http://localhost:5000) in your browser.

#### Development Mode:
```bash
npm run dev
```
Starts the Express API server on `http://localhost:5000` and Vite dev server on `http://localhost:3000`.

### Running Automated E2E Tests
```bash
npm test
```
Runs the 20-point automated end-to-end verification test suite covering authentication, session persistence, skip behavior, preference mapping, and admin version publication.

---

## 🗄️ Database Architecture

The SQLite database (`data/stroom.db`) includes:
- `users`: User accounts, hashed passwords, roles (`user`, `admin`), and `onboarding_status`.
- `quizzes`: Master quiz definition.
- `quiz_versions`: Immutable published and editable draft versions.
- `questions`: Questions with type (`single`, `multiple`), selection limits, display order, and active flags.
- `options`: Answer choices with stable tag values and display order.
- `quiz_sessions`: User quiz attempts (`IN_PROGRESS`, `COMPLETED`, `SKIPPED`).
- `responses`: Responses linked to session and question.
- `response_options`: Selected options per response.
- `user_preferences`: Normalized user interest tags sourced from quiz completion.
- `discovery_items`: Communities, events, people, and trips with tag arrays for recommendation scoring.
