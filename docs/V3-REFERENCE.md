# Blogger Layouts V3 / Widget V2 — platform reference

> Read this before writing any XML. Most circulating Blogger material is V1/V2-era,
> including recent tutorials and AI prompts that claim to be modern.

Verified against Google's layouts documentation, the community schema
(`nikahmadz/Blogger-Template-Documentation`), and production V3 themes currently
shipping. Sources at the bottom.

---

## 1. The version trap

Three version numbers are in play and they are **not** the same thing.

| Attribute | Value | Location | Meaning |
|---|---|---|---|
| `b:layoutsVersion` | `'3'` | `<html>` | The **theme format**. This is "V3". |
| `version` | `'2'` | every `<b:widget>` | The **widget markup version**. |
| `b:defaultwidgetversion` | `'2'` | `<html>` | Default for widgets Blogger injects itself. |

> **A V3 theme uses version-2 widgets. There is no `version='3'` on a widget.**

### Why this matters more than anything else here

The predecessor theme declared `b:layoutsVersion='3'` on `<html>` but wrote
`<b:widget id='Blog1' type='Blog'>` with **no `version` attribute**. Blogger
treated that widget as legacy, **silently discarded every custom includable in
it**, and rendered its own defaults instead.

Valid XML. No error. No warning. Green CI. Blank homepage for weeks.

The evidence, worth seeing once: the item page served 506 characters of post text
while containing neither `.post-single` nor `.post-body`, and exactly two JSON-LD
blocks (both from `<head>`) while the third, defined inside the discarded `post`
includable, never appeared. Head markup executed. Widget markup did not.

**One missing attribute deleted the entire template body.**

### `b:version='2' class='v2'` must never appear

That is the **V2 theme format**. It cannot pair with `b:layoutsVersion='3'`.
It is a common instruction in circulating guides and AI prompts. Following it
reproduces the failure above. It is banned by the contract suite.

---

## 2. Document shell

```xml
<?xml version='1.0' encoding='UTF-8' ?>
<!DOCTYPE html>
<html b:css='false'
      b:defaultwidgetversion='2'
      b:layoutsVersion='3'
      b:responsive='true'
      b:templateVersion='1.0.0'
      expr:dir='data:blog.languageDirection'
      expr:lang='data:blog.locale.language'
      xmlns='http://www.w3.org/1999/xhtml'
      xmlns:b='http://www.google.com/2005/gml/b'
      xmlns:data='http://www.google.com/2005/gml/data'
      xmlns:expr='http://www.google.com/2005/gml/expr'>
```

| Attribute | Why |
|---|---|
| `b:css='false'` | Suppresses Blogger's ~40 KB default widget CSS bundle. |
| `b:defaultwidgetversion='2'` | Widgets Blogger injects itself default to v2. See RK-2: reported to interfere with the comments area in some configurations, so we also set `version='2'` explicitly per widget. |
| `b:layoutsVersion='3'` | Selects the V3 format. |
| `b:responsive='true'` | Disables the `?m=1` mobile redirect and the separate mobile theme. |
| `b:templateVersion` | Free-form. We use it as the build stamp. |

Exactly one `<b:skin>` and at least one `<b:section>` are mandatory.

---

## 3. Complete V3 tag set

Anything not on this list does not exist in V3.

### Structure

| Tag | Attributes | Use |
|---|---|---|
| `b:section` | `id` (required, alphanumeric), `class`, `name`, `maxwidgets`, `showaddelement`, `preferred` | Layout zone. `preferred='yes'` marks the default drop target in Layout. |
| `b:section-contents` | `name` | Render a named section's widgets at an arbitrary point. |
| `b:widget` | `id`, `type`, **`version='2'`**, `locked`, `title`, `visible` | Widget instance. |
| `b:widget-settings` / `b:widget-setting` | `name` | Default dashboard settings. |
| `b:includable` | `id`, `var` | Named reusable block. |
| `b:include` | `name`, `data`, `cond` | Invoke an includable. |
| `b:defaultmarkups` / `b:defaultmarkup` | `type` | **V3 only.** Override default markup per widget type, or `type='Common'` for all. |

### Logic

| Tag | Use |
|---|---|
| `b:if` / `b:elseif` / `b:else` | Conditionals. |
| `b:switch` / `b:case` / `b:default` | **V3 only.** Multi-branch dispatch. Replaces verbose `if` chains. |
| `b:loop` | `values`, `var`, `index`. |
| `b:with` | **V3 only.** Bind an expression to a local variable. Compute a resized image once, reuse it. |
| `b:eval` | **V3 only.** Emit an expression result. |

### Attributes and output

| Tag | Use |
|---|---|
| `b:attr` | `name`, `value` or `expr:value`, optional `cond`. Conditional attribute injection. |
| `b:class` | **V3 only.** `name` or `expr:name`, optional `cond`. Safe conditional class binding. |
| `b:tag` | **V3 only.** Element with a computed tag name. |
| `b:message` / `b:param` | Localised strings from `data:messages`. |
| `b:comment` | Template-only comment, stripped from output. Unlike `<!-- -->`, which ships. |
| `b:skin` | The one CSS block. CDATA required. |
| `b:template-skin` | Optional layout-editor CSS. **Omitted** — an empty one is dead weight. |
| `b:variable` | Theme Designer variable declaration. |

`macro:include`, `macro:includable`, `macro:if` exist but are undocumented and
unstable. **Banned.**

---

## 4. Expression language

This is the part most tutorials get wrong.

### Operators

| Category | Supported | Note |
|---|---|---|
| Logical | `and`, `or`, `not` | **`&&` and `\|\|` are unreliable. Use the words.** |
| Comparison | `==`, `!=`, `<`, `>`, `<=`, `>=` | In attributes, `<` must be written `&lt;`. |
| Membership | `in` | `data:view.type in {"item","static_page"}` |
| Ternary | `cond ? a : b` | |
| Elvis | `a ?: b` | Returns `a` if truthy, else `b`. |
| Concatenation | `+` | |
| URL join | `path` | `data:blog.homepageUrl path "search"`. **Use for URLs, never string `+`.** |

### Collections

| Operation | Example |
|---|---|
| `map` | `data:post.labels map (l => data:l.name)` |
| `filter` | `data:comments filter (c => not data:c.inReplyTo)` |
| `any` / `all` | `data:post.labels any (l => data:l.name == "OSINT")` |
| `.length` | `data:post.labels.length` |
| `.first` / `.last` | `data:widgets.Blog.first.posts.first` |
| loop index | `<b:loop index='i' values='data:posts' var='post'>` |

### Accessors

| Accessor | Effect |
|---|---|
| `.escaped` | HTML-escapes. |
| `.jsonEscaped` | **JSON-string-escapes.** Mandatory for every JSON-LD interpolation. |
| `.length` | Length of string or collection. |
| `.canonical` | On `data:post.url` and `data:view.url`. |
| `.iso8601` | On dates. |

### Functions

| Function | Signature |
|---|---|
| `resizeImage` | `resizeImage(image, size, ratio)` — ratio like `"16:9"` or `"1:1"` |
| `sourceSet` | `sourceSet(image, [sizes], ratio)` — returns a ready `srcset` string |
| `snippet` | `snippet(text, {length, links, linebreaks, ellipsis})` — server-side excerpting |

> The predecessor's post guard was `data:posts.size gt 0`. That is doubly invalid:
> **neither `.size` nor `gt` exists in V3.** The expression could never have
> evaluated. Correct form: `not data:posts.empty`.

---

## 5. `data:view`

V3 replaces V2's `data:blog.pageType` string comparisons with a typed object.
**Use `data:view` exclusively.**

| Property | True on |
|---|---|
| `data:view.isHomepage` | The homepage, any page number |
| `data:view.isMultipleItems` | Home, search, label, archive |
| `data:view.isSingleItem` | Post or static page |
| `data:view.isPost` | A blog post only |
| `data:view.isPage` | A static page only |
| `data:view.isArchive` | An archive view |
| `data:view.isSearch` | Any search, **including label search** |
| `data:view.isLabelSearch` | A label view specifically |
| `data:view.isError` | 404 |
| `data:view.isPreview` | Theme preview mode |
| `data:view.isLayoutMode` | The Layout editor |

Also: `view.title`, `view.description`, `view.type`, `view.url`,
`view.url.canonical`, `view.search.query`, `view.search.label`,
`view.search.resultsMessage`, `view.search.resultsMessageHtml`,
`view.archive.rangeMessage`, `view.postId`, `view.pageId`.

### Two traps

**`isSearch` is true for label views too.** A text search is
`data:view.isSearch and not data:view.isLabelSearch`. Getting this wrong serves
the wrong empty-state copy.

**`isLayoutMode` matters more than it looks.** The Layout editor renders the
theme, so a template that throws there is uneditable even when the live site is
fine.

---

## 6. Blog widget includable contract

The Blog widget is the render path. **Overriding `main` without honouring the
rest of the contract is what broke the predecessor.**

```
main · post · postBody · postBodySnippet · postTitle · postHeader · postMeta
postFooter · postFooterAuthorProfile · postJumpLink · postPagination
postCommentsAndAd · postCommentsLink · nextPageLink · previousPageLink
homePageLink · feedLinks · feedLinksBody · inlineAd
comments · commentsTitle · commentList · commentItem · commentForm
commentFormIframeSrc · commentAuthorAvatar · commentDeleteIcon · commentPicker
threadedComments · threadedCommentForm · threadedCommentJs
addComments · aboutPostAuthor · status-message
```

Implement all of them. Ones you do not want (`inlineAd`, `postJumpLink`) are
declared **empty** rather than omitted, so Blogger cannot substitute defaults.

### Widget-level data

`data:widget.instanceId` · `data:numPosts` · `data:olderPageUrl` ·
`data:olderPageTitle` · `data:newerPageUrl` · `data:newerPageTitle` ·
`data:widgets.Blog.first.allBylineItems` (dashboard byline config: author,
timestamp, comments, labels, share)

### Post data

`.id` `.title` `.body` `.url` `.url.canonical` `.date` `.date.iso8601`
`.lastUpdated` `.lastUpdated.iso8601` `.labels` (`.name` `.url` `.isLast`)
`.author.name` `.author.profileUrl` `.author.authorPhoto.image`
`.author.aboutMe` `.featuredImage` `.featuredImage.isResizable`
`.featuredImage.isYoutube` `.snippets.short` `.snippets.long` `.allowComments`
`.allowNewComments` `.numberOfComments` `.commentsUrl` `.embedCommentForm`
`.commentFormIframeSrc` `.editUrl` `.location`

### Comment data

`.id` `.body` `.author` `.authorUrl` `.authorAvatarSrc` `.timestamp`
`.timestampValue` `.deleteUrl` `.isDeleted` `.inReplyTo` `.adminClass`

Threading is done in-template with `filter` and `map` on `inReplyTo`.
No JavaScript required.

---

## 7. Reference implementations

### Widget declaration

```xml
<b:section id='main' maxwidgets='1' showaddelement='no' preferred='yes'>
  <b:widget id='Blog1' locked='true' title='Blog Posts'
            type='Blog' version='2'>
    <b:widget-settings>
      <b:widget-setting name='showDateHeader'>false</b:widget-setting>
      <b:widget-setting name='showAuthor'>true</b:widget-setting>
      <b:widget-setting name='showLabels'>true</b:widget-setting>
      <b:widget-setting name='showTimestamp'>true</b:widget-setting>
      <b:widget-setting name='showCommentLink'>true</b:widget-setting>
      <b:widget-setting name='showBacklinks'>false</b:widget-setting>
      <b:widget-setting name='showInlineAds'>false</b:widget-setting>
      <b:widget-setting name='showShareButtons'>false</b:widget-setting>
    </b:widget-settings>
    <!-- includables -->
  </b:widget>
</b:section>
```

### View dispatch with `b:switch`

```xml
<b:includable id='main'>
  <b:switch var='data:view.type'>
    <b:case value='error_page'/>
      <b:include name='errorState'/>
    <b:case value='item'/>
      <b:include name='singleItem'/>
    <b:case value='static_page'/>
      <b:include name='singleItem'/>
    <b:default/>
      <b:include name='indexList'/>
  </b:switch>
</b:includable>
```

### Loud empty state

```xml
<b:includable id='status-message'>
  <div class='empty-state' role='status'>
    <b:if cond='data:view.isSearch and not data:view.isLabelSearch'>
      <p>Nothing matched &#8220;<data:view.search.query/>&#8221;.</p>
    <b:elseif cond='data:view.isLabelSearch'/>
      <p>Nothing filed under &#8220;<data:view.search.label/>&#8221; yet.</p>
    <b:elseif cond='data:view.isArchive'/>
      <p><data:view.archive.rangeMessage/> has no posts.</p>
    <b:else/>
      <p>No posts published yet.</p>
    </b:if>
    <a expr:href='data:blog.homepageUrl'>All posts</a>
  </div>
</b:includable>
```

**No branch emits nothing.** The predecessor's version was wrapped entirely in
`<b:if cond='data:navMessage'>`, so when that was unset it produced a blank page.
That is what turned a bug into an undiagnosable bug.

### Safe JSON-LD

```xml
<b:includable id='postSchema' var='post'>
  <script type='application/ld+json'>{
    &quot;@context&quot;: &quot;https://schema.org&quot;,
    &quot;@type&quot;: &quot;BlogPosting&quot;,
    &quot;headline&quot;: &quot;<data:post.title.jsonEscaped/>&quot;,
    &quot;url&quot;: &quot;<data:post.url.canonical.jsonEscaped/>&quot;,
    &quot;description&quot;: &quot;<b:eval expr='snippet(data:post.snippets.long,
        {length: 250, links: false, linebreaks: false,
         ellipsis: true}).jsonEscaped'/>&quot;,
    &quot;datePublished&quot;: &quot;<data:post.date.iso8601.jsonEscaped/>&quot;,
    <b:if cond='data:post.lastUpdated'>
    &quot;dateModified&quot;: &quot;<data:post.lastUpdated.iso8601.jsonEscaped/>&quot;,
    </b:if>
    &quot;author&quot;: {
      &quot;@type&quot;: &quot;Person&quot;,
      &quot;name&quot;: &quot;<data:post.author.name.jsonEscaped/>&quot;
    }
  }</script>
</b:includable>
```

Not hypothetical: **all 16 live post titles begin with an emoji**, and several
contain apostrophes and em dashes. Unescaped, they produce invalid JSON and
Google silently drops the structured data.

### Responsive image with `b:with`

```xml
<b:includable id='postThumb' var='post'>
  <b:if cond='data:post.featuredImage.isResizable'>
    <b:with value='data:post.featuredImage' var='img'>
      <img expr:alt='data:post.title'
           expr:src='resizeImage(data:img, 640, "16:9")'
           expr:srcset='sourceSet(data:img, [320,640,960,1280], "16:9")'
           sizes='(max-width: 640px) 100vw, 640px'
           height='360' width='640' loading='lazy' decoding='async'/>
    </b:with>
  </b:if>
</b:includable>
```

No `b:else` placeholder. **Zero of the 16 live posts have a featured image**, so
the layout must be correct with no image rather than reserving a grey box.

### Server-side comment threading

```xml
<b:includable id='comments' var='post'>
  <b:if cond='data:post.allowComments'>
    <b:with value='data:post.comments filter (c => not data:c.inReplyTo)'
            var='roots'>
      <b:if cond='data:roots.length > 0'>
        <ol class='comments'>
          <b:loop values='data:roots' var='c'>
            <b:include data='c' name='commentItem'/>
          </b:loop>
        </ol>
      <b:else/>
        <p class='comments-empty'>No comments yet.</p>
      </b:if>
    </b:with>
    <b:include data='post' name='commentForm'/>
  </b:if>
</b:includable>
```

### Shared markup via `b:defaultmarkup`

```xml
<b:defaultmarkups>
  <b:defaultmarkup type='Common'>
    <b:includable id='widgetTitle'>
      <b:if cond='data:title'>
        <h2 class='widget-title'><data:title/></h2>
      </b:if>
    </b:includable>
  </b:defaultmarkup>

  <b:defaultmarkup type='PopularPosts'>…</b:defaultmarkup>
  <b:defaultmarkup type='FeaturedPost'>…</b:defaultmarkup>
  <b:defaultmarkup type='ContactForm'>…</b:defaultmarkup>
  <b:defaultmarkup type='BlogArchive'>…</b:defaultmarkup>
  <b:defaultmarkup type='Label'>…</b:defaultmarkup>
</b:defaultmarkups>
```

Overriding these is **defensive, not decorative**. Add a Popular Posts gadget
from the dashboard someday and Blogger will inject unstyled HTML into the page
unless you have overridden it.

---

## 8. Banned constructs

Each is rejected by the contract suite with a message naming the V3 replacement.

| Banned | V3 replacement | Why |
|---|---|---|
| `<html b:version='2'>` | `b:layoutsVersion='3'` | **V2 theme format. Contradicts V3.** |
| `class='v2'` on `<html>` | omit | V2 marker |
| `<b:widget>` with no `version` | `version='2'` | **The predecessor's root cause** |
| `data:blog.pageType == "item"` | `data:view.isPost` | Untyped string comparison |
| `data:blog.pageType in {"index"}` | `data:view.isMultipleItems` | Same |
| `data:blog.url == data:blog.homepageUrl` | `data:view.isHomepage` | Fragile URL comparison |
| `data:blog.searchLabel` | `data:view.search.label` | V2 accessor |
| `data:blog.searchQuery` | `data:view.search.query` | V2 accessor |
| `data:posts.size gt 0` | `not data:posts.empty` | **Neither `.size` nor `gt` exists in V3** |
| `&&`, `\|\|` | `and`, `or` | Unreliable in V3 expressions |
| `data:post.dateHeader` | `data:post.date` | Only set on the first post of a day |
| `macro:include`, `macro:if` | `b:include`, `b:if` | Undocumented, unstable |
| Empty `<b:template-skin/>` | omit | Dead weight |
| String `+` for URL paths | the `path` operator | Double-slash and encoding bugs |
| Method-call syntax in a data tag | `expr:` with a documented function | Data tags are property paths |

---

## 9. Sources

- [Layouts Data Tags](https://support.google.com/blogger/answer/47270) — official `data:` reference
- [Page elements tags for layouts](https://support.google.com/blogger/answer/46888) — `b:section` and `b:widget` attributes
- [nikahmadz/Blogger-Template-Documentation](https://github.com/nikahmadz/Blogger-Template-Documentation) — most complete community list of V3 tags, operators, `data:view`, Blog-widget includables
- [zkreations/hamlet](https://github.com/zkreations/hamlet) · [canvas-core](https://github.com/zkreations/canvas-core) — production Pug-based V3 build systems
- [Understanding `b:defaultwidgetversion='2'`](https://stackoverflow.com/questions/50086387/understanding-bdefaultwidgetversion-2-on-blogger-template) — the reported comments interaction
- [Blogger API v3](https://developers.google.com/blogger/docs/3.0/using) — post and page CRUD for the staging seed; confirms there is **no theme endpoint**
