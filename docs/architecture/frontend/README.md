# Frontend architecture reference

This document captures the current frontend implementation structure in the repository so it can be used as a practical guide for future feature work and AI-assisted changes.

## 1. Purpose and stack

The frontend is a React + TypeScript single-page application built with Vite.

Current stack:

- React 19
- TypeScript
- Vite
- React Router
- TanStack Query for server state
- Axios for HTTP requests
- Tailwind CSS for styling
- shadcn/ui-style component patterns and utility composition
- Zod and React Hook Form for forms
- Sonner for toasts

The app is intended to feel polished and responsive, with a warm yellow accent and a modern, playful design language.

## 2. High-level application structure

The main frontend source lives in [frontend/src](../../frontend/src).

Top-level folders:

- components: reusable UI pieces
- pages: route-level screens
- layouts: shell layout for auth and app pages
- routes: route configuration and route guards
- hooks: reusable client-side logic
- services: API access layer
- types: shared TypeScript models
- utils: pure helpers and formatting logic
- lib: shared UI utilities and Tailwind helpers

## 3. Current folder structure

The frontend currently follows this structure:

```text
frontend/
  public/
  src/
    App.tsx
    index.css
    main.tsx
    components/
    hooks/
    layouts/
    lib/
    pages/
    routes/
    services/
    types/
    utils/
```

The application entry is composed in [frontend/src/App.tsx](../../frontend/src/App.tsx).

Routing responsibilities:

- public routes for login and registration
- public profile view route for shareable profiles
- protected routes for dashboard, learning tree, study sessions, profile, and trash
- a redirect from the root to the default learning view

There is a protected route wrapper that redirects unauthenticated users to login.

## 4. Layered frontend architecture

### 4.1 Pages

Location: [frontend/src/pages](../../frontend/src/pages)

Pages are route-level containers. They should:

- compose layout and UI sections
- gather page-specific state
- call services or hooks
- pass data to presentational components

Pages are not the place for low-level API transport code or business logic that should be shared.

### 4.2 Layouts

Location: [frontend/src/layouts](../../frontend/src/layouts)

Layouts define the shared app shell:

- app layout for authenticated pages
- auth layout for login and registration

The layout layer is responsible for the shared chrome, navigation, and consistent page framing.

### 4.3 Components

Location: [frontend/src/components](../../frontend/src/components)

The UI is organized around reusable components rather than page-level one-offs.

The component tree is split into areas such as:

- tree-related UI for the learning hierarchy
- notes editing and preview components
- profile cards and stat visuals
- CRUD dialogs for items and sessions

A good rule for this codebase is: if a piece of UI could be reused across more than one screen, it should usually live in components.

### 4.4 Hooks

Location: [frontend/src/hooks](../../frontend/src/hooks)

Hooks encapsulate reusable stateful logic such as:

- auth state and refresh coordination
- local UI state like sidebar collapse or tree view mode
- page-specific behavior that should not live directly inside components

Hooks should remain focused on client-side concerns and should not contain direct DOM manipulation unless absolutely necessary.

### 4.5 Services

Location: [frontend/src/services](../../frontend/src/services)

This is the API abstraction layer.

The app uses service modules for each resource domain, such as:

- auth API
- items API
- sessions API
- dashboard API
- profile API
- uploads API

The central API client is [frontend/src/services/client.ts](../../frontend/src/services/client.ts). It provides:

- a shared Axios instance
- token attachment for authenticated requests
- refresh-cookie handling through withCredentials
- a single-flight refresh strategy for 401 retries
- logout handling when refresh fails

In this frontend architecture, components and pages should not call Axios or fetch directly. They should go through the service layer.

## 5. Data flow

A typical data flow looks like this:

1. A page renders and requests data from a service module.
2. The service uses the shared API client to make an HTTP request.
3. The request carries the access token and refresh cookie as needed.
4. The result is returned to the page or hook.
5. The page updates local component state or TanStack Query state.
6. The UI re-renders based on the new state.

This keeps API transport concerns centralized and avoids repeating authentication, retry, and error-handling logic across the app.

## 6. State strategy

The frontend uses a hybrid state approach:

- React component state for local UI behavior
- React Router for navigation state and route transitions
- TanStack Query for server-fetched data and cache management
- localStorage-backed hooks for lightweight preferences such as collapsed sidebar state or tree view mode

The app does not rely on a large global store. Instead, it uses focused local state and service-driven data fetching.

## 7. Authentication flow on the client

The client auth story is centered around the shared API client and an access-token store.

Behavior:

- login and register store an access token in memory
- protected requests attach the access token as a Bearer token
- refresh requests use credentials so the httpOnly cookie is included
- a 401 from an authenticated request triggers a silent refresh attempt
- if refresh fails, the app logs the user out and clears auth state

This keeps authentication concerns consistent across the app rather than scattering refresh logic into individual screens.

## 8. Important UI conventions

### 8.1 Responsive-first design

Responsive behavior is treated as a core requirement rather than a late polish step. The app should be validated for:

- phone-sized screens
- tablet-sized screens
- laptop or desktop-sized screens

### 8.2 Search is page-local

Search is intentionally not implemented as a global UI pattern. The learning experience page owns its search input because the search behavior is only meaningful there.

### 8.3 Notes editor is shared

The notes experience is implemented as one shared dialog instance controlled by the learning page. This allows the same notes experience to be reused across different tree nodes without constructing nested dialogs.

## 9. Shared utilities and helpers

The utilities folder contains pure helpers for:

- tree assembly and traversal
- completion count calculations
- markdown editing support
- date formatting
- search and lookup operations

These utilities should stay deterministic and free of side effects so they can be reused safely across multiple pages and components.

## 10. Type safety and API modeling

The frontend uses TypeScript types to mirror the backend API contract.

This is important because the app relies on a clear separation between:

- UI state and view-layer concerns
- server payload shape
- domain-specific helper logic

When backend endpoints change, the frontend types and service modules should be updated in tandem.

## 11. Practical conventions for future changes

When extending the frontend:

- keep reusable UI in components
- keep transport logic in services
- keep page-level orchestration in pages or hooks
- avoid adding ad hoc fetch calls directly inside components
- preserve the current route guard and auth behavior
- preserve the existing separation between server state and local UI state

## 12. Full frontend file structure

```text
frontend/
  .env.example
  .env.local
  .gitignore
  .oxlintrc.json
  components.json
  index.html
  package.json
  package-lock.json
  public/
  README.md
  src/App.tsx
  src/index.css
  src/main.tsx
  src/components/AddSessionDialog.tsx
  src/components/DeleteItemDialog.tsx
  src/components/DeleteSessionDialog.tsx
  src/components/ItemFormDialog.tsx
  src/components/notes/MarkdownPreview.tsx
  src/components/notes/MarkdownToolbar.tsx
  src/components/notes/NotesEditorDialog.tsx
  src/components/notes/markdown-preview.css
  src/components/profile/AllRanksDialog.tsx
  src/components/profile/ContributionHeatmap.tsx
  src/components/profile/ProfileStatCard.tsx
  src/components/profile/StreakRankBadge.tsx
  src/components/shadcn-big-calendar/shadcn-big-calendar.ts
  src/components/shadcn-big-calendar/shadcn-big-calendar.css
  src/components/tree/NoteIndicator.tsx
  src/components/tree/NumberBadge.tsx
  src/components/tree/org-chart.css
  src/components/tree/OrgChartNode.tsx
  src/components/tree/OrgChartTree.tsx
  src/components/tree/TreeGuides.tsx
  src/components/ui/alert-dialog.tsx
  src/components/ui/badge.tsx
  src/components/ui/button.tsx
  src/components/ui/card.tsx
  src/components/ui/dialog.tsx
  src/components/ui/dropdown-menu.tsx
  src/components/ui/input.tsx
  src/components/ui/label.tsx
  src/components/ui/popover.tsx
  src/components/ui/select.tsx
  src/components/ui/separator.tsx
  src/components/ui/skeleton.tsx
  src/components/ui/sonner.tsx
  src/components/ui/switch.tsx
  src/components/ui/table.tsx
  src/components/ui/textarea.tsx
  src/components/ui/tooltip.tsx
  src/hooks/useAuth.tsx
  src/hooks/useCollapsedState.ts
  src/hooks/useLearningTree.ts
  src/hooks/useSidebarCollapsed.ts
  src/hooks/useTreeViewMode.ts
  src/layouts/AppLayout.tsx
  src/layouts/AuthLayout.tsx
  src/lib/utils.ts
  src/pages/DashboardPage.tsx
  src/pages/LearningTreePage.tsx
  src/pages/LoginPage.tsx
  src/pages/ProfilePage.tsx
  src/pages/PublicProfilePage.tsx
  src/pages/RegisterPage.tsx
  src/pages/StudySessionsPage.tsx
  src/pages/TrashPage.tsx
  src/routes/ProtectedRoute.tsx
  src/services/authApi.ts
  src/services/client.ts
  src/services/dashboardApi.ts
  src/services/itemsApi.ts
  src/services/profileApi.ts
  src/services/publicProfileApi.ts
  src/services/sessionsApi.ts
  src/services/tokenStore.ts
  src/services/uploadsApi.ts
  src/types/api.ts
  src/utils/apiError.ts
  src/utils/date.ts
  src/utils/markdownEditing.ts
  src/utils/noteExport.ts
  src/utils/socialPlatforms.ts
  src/utils/streakRank.ts
  src/utils/tree.ts
  src/utils/treeNumbering.ts
  src/utils/url.ts
  tsconfig.app.json
  tsconfig.json
  tsconfig.node.json
  vite.config.ts
```

## 13. Good mental model for this frontend

A helpful mental model is:

- routes decide which screen is shown
- layouts decide the shell around that screen
- pages compose the screen-level experience
- components render the actual UI
- hooks manage reusable behavior
- services talk to the backend
- utilities provide small, deterministic support logic

That separation makes the app easier to extend and easier for future agents to reason about safely.
