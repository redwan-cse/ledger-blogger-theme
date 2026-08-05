# M2 blank-render investigation

## Symptom

The `Header` widget renders its title and tagline on the live blog. The `Blog` widget renders
nothing on every view, including a bisect build whose only override was
`<b:includable id='main'><b:include name='super.main'/></b:includable>`.

## Ruled out

1. Missing `version='2'` (the predecessor's F1 root cause). Present on both widgets.
2. Custom includables. The zero-includable bisect still rendered blank.
3. Pug mangling dotted data tags into `class` attributes. All dynamic output uses `b:eval`.
4. Stale uploads. The deployed build stamp matched the uploaded artifact.
5. Self-hosted runner drift. CI is green on GitHub-hosted runners.

## Contempo diff, resolved in this build

| Delta | Action |
|---|---|
| Missing `<b:include data='blog' name='all-head-content'/>` | Added to `<head>` |
| Missing `expr:dir` / `expr:lang` on `<html>` | Added |
| Posts section wrapped in a bare `div` | Now wrapped in `<main class='main-content' role='main'>` |
| Posts section had no `class` | Now `class='main'`, matching Contempo |
| Section id churned across uploads (`content` -> `mainContent` -> `main` -> `pageBody`) | Frozen at `page_body`; CI fails if it changes |
| Header section id was `masthead` | Now `header`, the class name Blogger recognises for content transfer |

## Deliberately rejected from the diff

- **`b:templateUrl='indie.xml'`**: identifies Google's own template family. Meaningless for a
  custom theme and not documented as required.
- **Empty `<b:template-skin/>`**: `docs/V3-REFERENCE.md` §8 bans it as dead weight. Adding an empty
  one to chase a hypothesis would contradict our own contract; revisit only with rendered evidence.
- **Dropping `version='2'` to match Contempo**: Contempo relies on `b:defaultwidgetversion='2'`.
  Omitting the explicit attribute is exactly failure F1 from `docs/POSTMORTEM.md`. Never do this.
- **`expr:lang='data:blog.locale'`**: Contempo uses the bare locale; the documented language
  accessor is `data:blog.locale.language`. Keeping the documented form.
- **`<b:defaultmarkups>`**: belongs to M4 and is defensive, not required for widget instantiation.
  It is the next hypothesis only if this build still renders blank.

## Outstanding hypothesis: orphaned widget binding

Blogger stores widget-to-section bindings in its own layout database, not solely in the uploaded
XML. Repeated section renames across uploads can leave `Blog1` bound to a section id that no longer
exists, which would explain a widget that never executes while the rest of the page renders.

**This check costs nothing and must happen before the next upload:** open Blogger Layout and confirm
whether a `Blog Posts` element sits inside the `Page Body` section. If it is missing or floating,
the binding is the root cause and the fix is a layout repair, not a template change.

## Next control if this build still renders blank

Apply the committed `docs/contempo-1.3.3.xml` unmodified. If Contempo also renders no posts, the
fault is in the blog configuration rather than in any theme we generate.
