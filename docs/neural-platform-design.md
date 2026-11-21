# Slice neural platform design

## Design direction

This release extends the visual language of the neural homepage and daily-brief workspace throughout Slice. The default palette is deep navy with layered blue panels, mint primary actions, cyan context, violet secondary accents, and fine luminous borders. Headings, metrics, navigation, controls, and feedback surfaces now share that hierarchy.

The existing homepage, neural workspace composition, graph geometry, scoring engine, source archive, and forecasts remain the foundation. This release changes presentation and appearance preference handling. It does not change stock rankings, financial calculations, source attribution, permissions, or delivery approval requirements.

## Coverage

| Area | Included work |
| --- | --- |
| Public pages | Shared header, mobile navigation, footer, hero, cards, actions, market board, intelligence feed, and public graph explorer |
| Access and portals | Login/signup surfaces, client portal, advanced client tools, founder/investor views, and security screens |
| Private workspace | Sidebar, compact rail, topbar, breadcrumbs, command palette, page headers, metrics, tabs, forms, and cards |
| Intelligence | Shared research surfaces, notices, badges, model tools, data warehouse panels, and graph-adjacent controls |
| Workflows | AI studio, email workspace, briefs, clients, tasks, team tools, firm tools, and connected context panels |
| Markets and strategy | Market terminal, charts' surrounding UI, earnings, strategy studio, scenarios, decision tools, and customization panels |
| Settings | Consistent prepaint theme, appearance previews, saved theme choices, density, text size, and reduced-motion handling |
| Loading and errors | Root loading, public-page skeletons, workspace fallback states, error/404 screens, and standalone global error boundary |
| Overlays | Command palette, account/navigation menus, advisor routing dock, and client document dock |

## Shared palette

`src/app/neural-theme.css` is the central source for page, surface, text, border, action, and status colors. Component styles inherit those variables instead of independently applying an older white/green theme. The main dark tokens are:

| Role | Value |
| --- | --- |
| Outer page | `#030811` |
| Workspace page | `#050a12` |
| Main panel | `#09141f` |
| Raised panel | `#0d1b2b` |
| Heading | `#e9f6ff` |
| Body text | `#c5d6e6` |
| Muted text | `#94a9bf` |
| Primary mint | `#70e3d2` |
| Primary text | `#042d2b` |
| Secondary cyan | `#6acbe5` |
| Secondary violet | `#a99af4` |

Dedicated primary-action foreground and background tokens prevent white text from becoming difficult to read on a light mint button. Error, risk, warning, success, and informational treatments keep distinct semantic colors. Explicit legacy red palette entries now use rose instead of the old automatic green substitution.

The optional light appearance keeps the same blue/mint identity with dark teal actions. High contrast, reduced motion, quiet effects, and print styles use their own appropriate adjustments.

## Theme behavior

The server renders dark theme attributes and the `dark` class. The prepaint script and hydrated client share one resolver. First load after this release adopts the neural dark appearance once while retaining other saved settings. A later deliberate light or system choice persists.

The appearance controller runs across public, access, and private routes. It responds to preference and system-theme events without adding provider requests or a polling loop. Old inline copies of the page, surface, text, and status palette are cleared so they cannot override the shared theme after hydration.

Saved motion, text scale, and density are applied before hydration as well. Settings previews use the same controller and restore saved appearance when the user leaves without saving. Malformed or unavailable browser storage cannot prevent the application from rendering.

Tailwind dark variants follow the application's explicit theme class. A user choosing dark therefore gets the complete dark interface even when the operating system is using a light appearance.

## Legacy styles and source previews

The historical `market-green.css` filename remains for import compatibility, but its role is now a semantic bridge for older utility-based UI. Its selectors match exact class tokens and actual interaction states. A class such as `hover:bg-white` does not recolor an element before it is hovered.

The compatibility layer excludes elements marked `data-slice-color-lock` and their descendants. The email workspace follows the neural application theme while its message preview retains the actual outgoing branding, colors, and layout. Images, graph strokes, chart markers, and protected source content are not indiscriminately recolored.

The blog no longer injects a global `html`/`body` palette that persists after navigation. Page-specific visual art is scoped to its own surface.

## Motion and performance

The large brain scenes stay on the pages designed around them. Other pages use a restrained network/grid atmosphere, layered panels, and a single subtle signal animation in the shared topbar. This gives the platform continuity without mounting a second large graph on every route.

The shared signal pauses while the document is hidden and stops for reduced motion, quiet effects, or local page motion-off. The client portal's decorative orbit has a local pause control. Existing keyboard navigation, focus indicators, responsive drawers, scroll regions, and data loading remain available.

## Install

Use the accompanying `Slice_Neural_Platform_Design.zip` update package and its `README_FIRST.txt`. It supplies complete replacement files for the existing Slice checkout and includes the preceding graph/scoring upgrades. It verifies payload hashes and creates a backup outside the repository before replacement. Your current Git branch is retained.

No package dependency or database migration is introduced by the design update. Existing provider and database configuration is required for the underlying application as before.

After applying the package:

```sh
npm ci
npm run test:neural-platform
npm run build
npm run dev
```

## Verification and local review

The theme tests exercise the real prepaint resolver and appearance controller, including default migration, saved choices, system changes, blocked storage, preference preservation, and preview behavior. The existing graph suites remain part of the combined command. Production compilation checks the actual CSS modules and TypeScript integration.

Palette checks cover readable normal-text combinations across the dark and light page/panel/input surfaces, semantic statuses, and primary actions. These checks verify the shared palette; they are not a claim that every possible screen composition has undergone a complete accessibility audit.

Browser rendering and native Windows launcher execution require local review. After starting the application, inspect the homepage, workspace, intelligence, brief, email center, strategy tools, Settings, and client portal at desktop and mobile widths. In Settings, preview and save dark/light/system, test reduced motion, and navigate away from an unsaved preview. In the email center, verify that the app theme changes while the outgoing message preview retains its selected branding.
