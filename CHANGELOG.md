# Changelog

All notable changes to the Ledger Blogger Theme are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.4.0] - 2026-09-05

### Added
- **Audio Article Narration & YouTube-Style Speed Controls**: Client-side SpeechSynthesis audio narration engine featuring responsive desktop inline placement, mobile/tablet wrapping, sentence boundary chunking (permanently resolving the Chromium 15-second SpeechSynthesis timeout bug), and dynamic speed cycling (`0.5x`, `0.75x`, `1.0x`, `1.25x`, `1.5x`) with on-the-fly rate switching without restarting playback from the beginning.
- **Vector SVG Stopwatch**: Replaced colored OS system emoji `⏱️` with an inline vector SVG stopwatch icon (`width='13' height='13' stroke='currentColor'`), eliminating platform-dependent font metrics discrepancies and baseline jitter.
- **Micro-Instant Hydration**: Instant `localStorage` cache hydration micro-script embedded directly in the template `<head>` for sidebar recent publications and mobile drawer, eliminating the 2-second flash of unstyled content on page navigation.
- **Context-Aware Search Routing**: Dynamically scoped sidebar search widget to single post views (`data:view.isSingleItem`) while relying on the primary filter bar on the homepage, with intelligent `/` and `Ctrl+K` keyboard shortcut routing.

### Changed
- **Mathematical Optical Center Alignment**: Aligned all post header metadata elements (Author Avatar, Author Name, middle dot separators, date badge, reading time badge, listen button, and speed button) to a shared, pixel-perfect center line (`centerY = 78.0px` / `426.86px`).
- **Proportional Audio Button Sizing**: Scaled `.listen-btn` and `.listen-speed-btn` to a streamlined `26px` height with `padding: 0 10px;` and `border-radius: 6px;` to match the 24px author avatar diameter.
- **Compact Post Tag Pills**: Overrode global 44px touch-target inflation on post card and post footer labels (`a.label-link`, `.post-label`), restoring compact 21.2px height, `4px` border radius, and `padding: 2px 8px;` across SSR and CSR in both light and dark modes.
- **Unified Recent Publications Components**: Harmonized typography, sizing, and spacing between homepage and single article sidebar and drawer recent publications cards.

### Fixed
- **Autonomous Author Avatar Protection**: Scoped `initPostHeroImage()` to `.post-body` and explicitly guarded `.post-author-mini-avatar` and `.author-avatar`, preventing diagram thumbnail replacements across older and newer blog posts.
- **Overbroad Touch Target Bleed**: Removed overbroad `a` and `.label-link` declarations from base 44px touch-target rules, preventing inline tag pills and text links from inflating into oversized boxes.
- **Single Post Desktop Spacing**: Removed redundant outer margins from `.post-listen-bar` on desktop viewports, creating a seamless horizontal flow with the article byline.

---

## [1.3.0] - 2026-09-05

### Added
- **Faceted Homepage Filter Bar**: Interactive filter toolbar featuring live full-text search, Year dropdown selector, Month dropdown selector, and Category pill filter.
- **Client-Side Article Catalog Engine**: Instantaneous zero-latency client-side search and filtering across the entire post library without server roundtrips.
- **Numbered Pagination Controls**: Accessible, circular numbered pagination interface for seamless multi-page browsing on mobile and desktop.
- **Interactive Architecture Diagrams**: Integrated Mermaid 11 ESM diagram engine supporting client-side flowchart and topology rendering.
- **Modern Transparent Diagram Toolbar**: Floating, non-intrusive diagram controls featuring step-by-step zoom (+ / -), 100% fit-to-screen reset, and direct standalone SVG download with embedded styling.
- **High-Resolution CDN Thumbnail Pipeline**: Automated repository-hosted post thumbnails (`assets/posts/<slug>/thumbnail.png`) served via open jsDelivr CDN (`cdn.jsdelivr.net`).
- **Autonomous Hero Image Healing**: Client-side resolver in `main.ts` that intercepts and upgrades broken or blocked image URLs on single article views to permanent CDN assets.
- **Code Block Enhancements**: Syntax highlighting with Prism, statement-level line spacing, language headers, and one-click copy buttons with clipboard toast feedback.
- **Collapsible Table of Contents**: Semantic, sticky Table of Contents (TOC) with smooth scrolling navigation and active reading position tracking.
- **Headless Publishing Automation**: GitHub Actions workflow (`.github/workflows/publish-from-drive.yml`) supporting automated intake folder organization, Google Drive queue monitoring, and Google Sheets publication logging.

### Changed
- **Modern Horizontal Post Cards**: Redesigned blog listing cards with a clean 16:9 framed thumbnail on the left and balanced typography stack on the right.
- **Card Height Equalization**: Replaced oversized lead-post typography with standardized card typography (`font-size: 1.0625rem`, `line-height: 1.3`, `font-weight: 700`) to ensure uniform height across all article cards.
- **Strict 2-Line Clamping**: Enforced CSS `-webkit-line-clamp: 2` across titles and excerpts, eliminating multi-line overflow and card height inconsistencies.
- **Compact Padding & Zero Dead Space**: Tightened `.post` padding to `14px 18px` and matched text column height directly to the 16:9 thumbnail height (~158px–163px).
- **Feed Thumbnail Upgrading**: Automatically upgraded low-resolution Blogger thumbnail URLs (`=s72-c`) to crisp 600px resolution (`=s600`) across catalog previews.
- **Accent Category Badges**: Transformed plain text category labels into modern, accent-bordered pill badges.

### Fixed
- **Chrome Cross-Origin Image Blocking**: Resolved `ERR_BLOCKED_BY_ORB` caused by Google Drive `lh3.googleusercontent.com` redirects by migrating thumbnails to jsDelivr CDN with `referrerpolicy="no-referrer"`.
- **Live Blogger Post Hero Images**: Patched published articles on Blogger via API to replace legacy Google Drive and base64 hero images with permanent CDN URLs.
- **Table Formatting & Mobile Responsiveness**: Resolved markdown table object rendering issues, added zebra striping, and ensured dark-mode sticky headers.
- **SVG Download Truncation**: Fixed SVG serialization to calculate accurate bounding boxes, embed background colors, and export complete vector figures.

---

## [1.2.0] - 2026-09-03

### Added
- **Verified ORCID Credential Badge**: Added academic and professional ORCID badge linking directly to verified researcher identity.
- **Blogger Favicon Override**: Replaced default Blogger favicon with high-resolution custom profile avatar.

### Fixed
- **Mobile Responsive Breakpoints**: Refined breakpoint transitions (<640px single column, 640–1023px tablet, 1024px+ 12-column grid).
- **Structured Data & JSON-LD**: Verified Schema.org `BlogPosting` and `WebSite` JSON-LD output with mandatory `.jsonEscaped` sanitization.
- **Header Structure & WCAG Single H1**: Enforced strict heading hierarchy with single `h1` per view across all 10 Blogger views.

---

## [1.1.0] - 2026-09-02

### Added
- **Defensive Defaultmarkups**: Declared 14 defensive `<b:defaultmarkup>` blocks preventing dashboard gadget breakages.
- **7 Static Config Zones**: Structured `b:section` zones (`masthead`, `navlinks`, `intro`, `topics`, `page_body`, `cta`, `footer`) matching Google's Layouts V3 contract.
- **Contempo Alignment**: Configured `Blog1` widget `main` includable to delegate to `super.main` for native pagination and comment iframe initialization.

### Changed
- **Modular SCSS Architecture**: Reorganized styles into modular partials (`tokens`, `base`, `layout`, `index`, `article`, `states`, `dark`).
- **OKLCH Design System**: Migrated color definitions to pure OKLCH color space with automated WCAG contrast validation.

---

## [1.0.0] - 2026-09-01

### Added
- **Initial Release**: Lightweight, high-performance Blogger Layouts V3 theme built with Pug, SCSS, and TypeScript.
- **Contract Test Suite**: 39 Layouts V3 contract enforcement rules, adversarial mutation tests, and golden snapshot verification.
- **Zero Framework Dependencies**: Pure native browser APIs and system UI font stacks with zero external JavaScript or CSS runtime overhead.
