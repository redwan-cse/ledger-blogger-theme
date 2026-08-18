# Postmortem: Resolving Blogger Theme Blank Page & Widget Instantiation

## Summary

When uploading custom Blogger Layouts V3 themes via **Theme > Edit HTML**, Blogger rendered a blank content area despite the XML being well-formed and valid according to standard XML parsers. Investigation revealed that Blogger's internal layout engine failed to instantiate widget instances into the blog's backend database (`widgets.db`), leaving every `<b:section>` in a `no-items` unpopulated state.

---

## Root Cause Analysis

### 1. The `maxwidgets` Constraint on `<b:section>`
- **Problem**: The theme source files included `maxwidgets='1'` and `maxwidgets='3'` attributes on all `<b:section>` tags (`masthead`, `navlinks`, `intro`, `topics`, `page_body`, `cta`, `footer`).
- **Platform Behavior**: In Blogger Layouts V3, when a user edits raw theme XML in the Blogger dashboard and clicks **Save**, Blogger runs an internal database migration parser that scans `<b:section>` and `<b:widget>` declarations. If a section contains `maxwidgets`, Blogger's parser does not auto-populate default widget beans for custom section IDs unless they pre-exist in the blog's database history. None of Google's official native V3 themes (Contempo, Soho, Essential, Notable, Emporio) use `maxwidgets` on any `<b:section>`.
- **Resolution**: Removed `maxwidgets` from all 7 `<b:section>` declarations.

### 2. Widget ID and Type Binding
- **Problem**: Custom or mismatched widget IDs can cause Blogger to treat widgets as orphan entries or ignore their includable definitions.
- **Resolution**: Standardized widget IDs to match standard Blogger V3 bindings:
  - `Header` zone → `Header1` (`type='Header'`, `locked='true'`, `visible='true'`)
  - `LinkList` zone → `LinkList1` (`type='LinkList'`)
  - `Intro` zone → `HTML1` (`type='HTML'`)
  - `Topics` zone → `Label1` (`type='Label'`)
  - `Page Body` zone → `Blog1` (`type='Blog'`, `locked='true'`, `visible='true'`)
  - `CTA` zone → `HTML2` (`type='HTML'`)
  - `Footer` zone → `Attribution1` (`type='Attribution'`) and `HTML3` (`type='HTML'`)

### 3. Layout Grid Hierarchy & Deep Child Nesting
- **Problem**: Blogger wraps posts inside 3 levels of platform containers:
  ```html
  <main class='main-content'>
    <div class='main section' id='page_body'>
      <div class='widget Blog' id='Blog1'>
        <div class='blog-posts hfeed container'>
          <article class='post'>
  ```
  Applying `display: grid; grid-template-columns: repeat(12, 1fr)` directly to `main.main-content` without `grid-column: 1 / -1` on `#page_body` caused `#page_body` to collapse into column 1 (8.3% width) of the 12-column grid, making all posts squished on the far left.
- **Resolution**: Added `grid-column: 1 / -1;` to `.main.section`, `#page_body`, and `.widget.Blog`, and applied the 12-column responsive grid to `.blog-posts` directly.

### 4. Global CSS Flex Collision on Content Links
- **Problem**: An overbroad touch-target rule `a { display: inline-flex; min-height: 44px; }` forced article title links (`.post-title a`) into flex containers, breaking `-webkit-box` line-clamping and word wrapping.
- **Resolution**: Scoped touch-target styles specifically to interactive UI buttons/pills while setting `.post-title a { display: block; min-height: unset; }`.

---

## Lessons Learned & Rules

1. **Never use `maxwidgets` in Blogger V3 `<b:section>` definitions.**
2. **Always test rendered HTML output, not just XML syntax validity.**
3. **Ensure full-width spanning (`grid-column: 1 / -1; width: 100%`) on intermediate Blogger section and widget wrappers.**
4. **Never apply `display: inline-flex` globally to all `<a>` tags.**
