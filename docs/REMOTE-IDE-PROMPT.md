# Remote IDE Instructions: Blank Rendering Investigation

You are assisting with the investigation of a critical bug where our Blogger Layouts V3 theme renders a completely blank content area (only the "Skip to content" link and Header widget output appear) on `blogs.redwan.work`.

All offline gates pass (XML generation, contract checks). The goal is to isolate the root cause by proving it with rendered HTML on Blogger, testing hypotheses cheaply.

## Project State & Test Harness

1. **Contempo Split**: The authoritative Google Contempo V3 theme (`docs/contempo-1.3.3.xml`) has been split into multiple smaller files under `docs/contempo/` to match our own theme's structure:
   - `docs/contempo/theme.xml` (The shell, with `<!-- INJECT_* -->` placeholders)
   - `docs/contempo/widgets/blog.xml`
   - `docs/contempo/widgets/header.xml`
   - `docs/contempo/defaultmarkups/common.xml`
   - `docs/contempo/skin.xml`
   - `docs/contempo/template-skin.xml`
2. **Recombiner**: A script at `tools/combine-contempo.ts` demonstrates how to stitch these pieces back into `docs/contempo-1.3.3-recombined.xml` with a 100% byte-for-byte match. You can adapt this script to mix and match components.

## Your Immediate Tasks

Since Blogger API v3 does not have a theme upload endpoint, we cannot fully automate testing. You must generate "minimal control" XML files for the user to manually upload and verify.

### 1. Build Minimal Controls
Use the split files to build permutations that isolate the variables. Modify `combine-contempo.ts` or write a new script to generate the following files in a `dist/tests/` directory:

- **Control A (Contempo Shell + Our Blog1)**: Inject our generated `Blog1` widget XML (or Pug compiled to XML) into the `docs/contempo/theme.xml` shell.
- **Control B (Our Shell + Contempo Blog1)**: Inject `docs/contempo/widgets/blog.xml` into our `dist/theme.xml` shell.

### 2. Prepare Hypothesis Tests
Generate specific test themes based on the differences found in Task 1:
- **Test 2A (Section ID / DOM nesting)**: Modify our theme so the Blog widget section is renamed from `id="pageBody"` to `id="main"` and wrapped in `<main>` instead of `<div>`, matching Contempo. *(Hypothesis: Blogger's Layout engine orphaned the widget when the section ID was renamed, or discards non-div wrappers).*
- **Test 2B (Missing elements)**: Modify our theme to include the missing `<b:defaultmarkups>` and `<b:template-skin>` inside `<head>`.

### 3. Deliverable
Provide the user with clear instructions and the generated XML files from `dist/tests/` so they can upload them to the staging blog (`staging-ledger-theme.blogspot.com`) or the live blog, and report back which variation successfully renders the posts.

**Hard Rule Reminder:** 
- The only evidence that counts is HTML Blogger actually rendered. XML that "looks right" proves nothing. 
- Do not guess the answer; use the controls to definitively isolate the culprit.
