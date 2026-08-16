# Exhaustive Theme Layout Comparison: Google Contempo V3 vs. Ledger Blogger Theme

> **Date:** August 16, 2026  
> **Target Repositories & Files Analyzed:**  
> 1. `docs/contempo-1.3.3.xml` (Google Official Contempo Theme v1.3.3, 4,211 lines)  
> 2. `docs/contempo/` (Deconstructed Contempo template tree: `theme.xml`, `skin.xml`, `template-skin.xml`, `widgets/`, `defaultmarkups/`)  
> 3. `dist/theme.xml` (Ledger Blogger Theme v0.0.0, 685 lines)  
> 4. `src/` (Ledger Pug, SCSS, and TypeScript source files)  

---

## Table of Contents
1. [High-Level Architecture Overview](#1-high-level-architecture-overview)
2. [Detailed Block-by-Block Layout: Contempo Theme](#2-detailed-block-by-block-layout-contempo-theme)
3. [Detailed Block-by-Block Layout: Ledger Theme](#3-detailed-block-by-block-layout-ledger-theme)
4. [Structural Comparison Matrix](#4-structural-comparison-matrix)
5. [In-Depth Component & Includable Comparison](#5-in-depth-component--includable-comparison)
   - 5.1 Root `<html>` and Document Setup
   - 5.2 `<head>` Structure & Metadata
   - 5.3 Skin & CSS Delivery (`<b:skin>`, `<b:template-skin>`)
   - 5.4 Defaultmarkups Architecture (`<b:defaultmarkups>`)
   - 5.5 Section Hierarchy & Nesting
   - 5.6 Header Widget (`Header1`) Architecture
   - 5.7 Blog Widget (`Blog1`) Architecture
   - 5.8 Navigation & Auxiliary Gadgets
6. [Why Blogger Serves `no-items` Empty Sections: Technical Discrepancies](#6-why-blogger-serves-no-items-empty-sections-technical-discrepancies)
7. [Actionable Recommendations](#7-actionable-recommendations)

---

## 1. High-Level Architecture Overview

```
+---------------------------------------------------------------------------------------+
|                                    GOOGLE CONTEMPO                                    |
+---------------------------------------------------------------------------------------+
|  <html> (b:layoutsVersion='3', b:defaultwidgetversion='2', b:templateUrl='indie.xml')  |
|  <head>                                                                               |
|    - all-head-content                                                                 |
|    - <b:skin> (Variable definitions, 66 KB layout skin)                               |
|    - <b:template-skin> (722 B dynamic overrides)                                      |
|    - <b:defaultmarkups> (12 types, 261 lines defining super includables)              |
|  <body>                                                                               |
|    - skipNavigation                                                                   |
|    - .page > .page_body > .centered                                                   |
|      - header.centered-top-container                                                  |
|        - b:section#search_top (BlogSearch1)                                           |
|        - b:section#header (Header1)                                                   |
|        - b:section#page_list_top (PageList1)                                          |
|      - b:section#ads (AdSense1, AdSense2)                                             |
|      - main.centered-bottom                                                           |
|        - b:section#page_body (FeaturedPost1, Blog1, PopularPosts1)                    |
|      - b:section#footer (Attribution1, HTML4)                                         |
|    - aside.sidebar-container (Drawer Menu)                                            |
|      - b:section#sidebar_top (Profile1)                                               |
|      - b:section#sidebar_bottom (BlogArchive1, BlogSearch2, Label1, ReportAbuse1,     |
|                                HTML3, LinkList1, HTML2, HTML1)                        |
|    - b:template-script (name='indie')                                                 |
+---------------------------------------------------------------------------------------+

+---------------------------------------------------------------------------------------+
|                                  LEDGER BLOGGER THEME                                 |
+---------------------------------------------------------------------------------------+
|  <html> (b:layoutsVersion='3', b:defaultwidgetversion='2', b:templateVersion='0.0.0')  |
|  <head>                                                                               |
|    - all-head-content, canonical                                                      |
|    - OpenGraph & Twitter Cards                                                        |
|    - JSON-LD Structured Data (WebSite & BlogPosting)                                  |
|    - <b:skin> (10 KB compiled pure CSS, OKLCH design system, no JS/external fonts)   |
|    - <b:defaultmarkups> (6 types: Common, PopularPosts, FeaturedPost, ContactForm,     |
|                          BlogArchive, Label)                                          |
|  <body>                                                                               |
|    - .skip-link                                                                       |
|    - .header-outer > b:section#header (Header1)                                       |
|    - [b:if guarded] .nav-container > b:section#navlinks (LinkList1)                   |
|    - [b:if guarded] .intro-container > b:section#intro (HTML1)                        |
|    - [b:if guarded] .topics-container > b:section#topics (Label1)                     |
|    - main#content.main-content > b:section#page_body (Blog1)                          |
|    - [b:if guarded] .cta-container > b:section#cta (HTML2)                            |
|    - [b:if guarded] footer.footer-container > b:section#footer (HTML3)                |
|    - <script> inline JS class toggles                                                 |
+---------------------------------------------------------------------------------------+
```

---

## 2. Detailed Block-by-Block Layout: Contempo Theme

### 2.1 Root Tag & Namespace Declarations
```xml
<html b:css='false'
      b:defaultwidgetversion='2'
      b:layoutsVersion='3'
      b:responsive='true'
      b:templateUrl='indie.xml'
      b:templateVersion='1.3.3'
      expr:dir='data:blog.languageDirection'
      expr:lang='data:blog.locale'
      xmlns='http://www.w3.org/1999/xhtml'
      xmlns:b='http://www.google.com/2005/gml/b'
      xmlns:data='http://www.google.com/2005/gml/data'
      xmlns:expr='http://www.google.com/2005/gml/expr'>
```

### 2.2 `<head>` Elements Tree
1. `<meta content='width=device-width, initial-scale=1' name='viewport'/>`
2. `<title><data:view.title.escaped/></title>`
3. `<b:include data='blog' name='all-head-content'/>`
4. `<b:skin version='1.3.3'><![CDATA[ ... 66 KB of Blogger CSS Variables & Rules ... ]]></b:skin>`
5. `<b:template-skin><![CDATA[ ... dynamic responsive skin rules ... ]]></b:template-skin>`
6. `<b:defaultmarkups>` containing 12 `<b:defaultmarkup>` elements:
   - `Common`: `widgetNotAvailableInPreview`
   - `AdSense,Blog`: `defaultAdUnit`
   - `Blog,FeaturedPost`: `headerByline`
   - `Blog,FeaturedPost,PopularPosts`: `commentsLink`, `snippetedPostByline`, `postLabels`, `postShareButtons`, `postJumpLink`, `postFooterJumpLink`, `postFooter`
   - `Blog`: `main`, `feedLinks`, `postBodySnippet`, `previousPageLink`, `homePageLink`, `nextPageLink`, `inlineAd`
   - `BlogArchive`: `main`, `flat`, `hierarchy`
   - `BlogSearch`: `searchSubmit`
   - `Label`: `main`, `list`, `cloud`
   - `FeaturedPost`: `snippetedPostContent`, `snippetedPostThumbnail`
   - `Header`: `image`, `title`
   - `PopularPosts`: `main`, `snippetedPostContent`
   - `PageList`: `content`, `overflowButton`
   - `Profile`: `main`, `defaultProfileImage`, `userProfileText`, `viewProfileLink`
7. Responsive background image styler: `<b:include name='responsiveImageStyle'/>`
8. Conditional Google AdSense script: `//pagead2.googlesyndication.com/pagead/js/adsbygoogle.js`
9. Google Analytics includable: `<b:include data='blog' name='google-analytics'/>`
10. Clipboard helper script: `https://www.gstatic.com/external_hosted/clipboardjs/clipboard.min.js`

### 2.3 `<body>` Hierarchy & Sections
- `<body class='...'>`
  - `<b:include name='skipNavigation'/>`
  - `<div class='page'>`
    - `<div class='bg-photo-overlay'/>`
    - `<div class='bg-photo-container'><div class='bg-photo'/></div>`
    - `<b:with var='hasVerticalAds' value='...'>`
      - `<div class='page_body'>`
        - `<div class='centered'>`
          - `<div class='centered-top-placeholder'/>`
          - `<header class='centered-top-container' role='banner'>`
            - `<div class='centered-top'>`
              - Back button / Hamburger menu toggle icon
              - Search expand button + `<b:section id='search_top' name='Search (Top)' showaddelement='false'>`
                - `<b:widget id='BlogSearch1' type='BlogSearch' locked='true' visible='true'>`
              - `<div class='blog-name container'>`
                - `<b:section class='container' id='header' name='Header' showaddelement='false'>`
                  - `<b:widget id='Header1' type='Header' locked='true' visible='true'>`
                    - `<b:widget-settings>` (displayUrl, displayHeight, sectionWidth, useImage, shrinkToFit, imagePlacement, displayWidth)
                    - Includables: `main`, `behindImageStyle`, `description`, `image`, `title`
                - `<nav role='navigation'>`
                  - `<b:section class='clearboth' id='page_list_top' name='Page List (Top)' showaddelement='false'>`
                    - `<b:widget id='PageList1' type='PageList' locked='true' visible='false'>`
          - `<b:section ads='true' class='vertical-ad-container' id='ads' name='Ads' showaddelement='false'>`
            - `<b:widget id='AdSense1' type='AdSense' locked='true' visible='false'>`
            - `<b:widget id='AdSense2' type='AdSense' locked='true' visible='false'>`
          - `<main class='centered-bottom' id='main' role='main' tabindex='-1'>`
            - Optional Archive/Search header message (`.post-filter-message`)
            - `<b:section class='main' id='page_body' name='Page Body' showaddelement='false'>`
              - `<b:widget id='FeaturedPost1' type='FeaturedPost' locked='true' visible='true'>`
              - `<b:widget id='Blog1' type='Blog' locked='true' visible='true'>`
                - `<b:widget-settings>` (22 widget settings configuring dates, authors, labels, timestamps, ads, shares)
                - Includables: `main`, `aboutPostAuthor`, `addComments`, `commentAuthorAvatar`, `commentDeleteIcon`, `commentForm`, `commentFormIframeSrc`, `commentItem`, `commentList`, `commentPicker`, `comments`, `commentsLink`, `commentsTitle`, `defaultAdUnit`, `feedLinks`, `feedLinksBody`, `headerByline`, `homePageLink`, `iframeComments`, `inlineAd`, `nextPageLink`, `post`, `postBody`, `postBodySnippet`, `postCommentsAndAd`, `postCommentsLink`, `postFooter`, `postFooterAuthorProfile`, `postFooterJumpLink`, `postHeader`, `postJumpLink`, `postLabels`, `postMeta`, `postPagination`, `postShareButtons`, `postTitle`, `previousPageLink`, `snippetedPostByline`, `threadedCommentForm`, `threadedCommentJs`, `threadedComments`, `tooltipCss`
              - `<b:widget id='PopularPosts1' type='PopularPosts' locked='true' visible='true'>`
          - `<b:section class='footer' id='footer' name='Footer' showaddelement='false' tag='footer'>`
            - `<b:widget id='Attribution1' type='Attribution' locked='true' visible='false'>`
            - `<b:widget id='HTML4' type='HTML' version='2' locked='false' visible='true'>`
  - `<aside class='sidebar-container container sidebar-invisible' role='complementary'>`
    - Close navigation button
    - `<div class='sidebar_top_wrapper'>`
      - `<b:section class='sidebar_top' id='sidebar_top' name='Sidebar (Top)'>`
        - `<b:widget id='Profile1' type='Profile' locked='true' visible='true'>`
    - `<b:section class='sidebar_bottom' id='sidebar_bottom' name='Sidebar (Bottom)' preferred='yes'>`
      - `<b:widget id='BlogArchive1' type='BlogArchive' locked='false' visible='true'>`
      - `<b:widget id='BlogSearch2' type='BlogSearch' locked='false' visible='true'>`
      - `<b:widget id='Label1' type='Label' locked='false' visible='true'>`
      - `<b:widget id='ReportAbuse1' type='ReportAbuse' locked='true' visible='true'>`
      - `<b:widget id='HTML3' type='HTML' version='2' locked='false' visible='true'>`
      - `<b:widget id='LinkList1' type='LinkList' locked='false' visible='true'>`
      - `<b:widget id='HTML2' type='HTML' version='2' locked='false' visible='true'>`
      - `<b:widget id='HTML1' type='HTML' version='2' locked='false' visible='true'>`
  - `<b:template-script async='true' name='indie' version='1.0.0'/>`

---

## 3. Detailed Block-by-Block Layout: Ledger Theme

### 3.1 Root Tag & Namespace Declarations
```xml
<html b:css="false"
      b:defaultwidgetversion="2"
      b:layoutsVersion="3"
      b:responsive="true"
      b:templateVersion="0.0.0"
      expr:dir="data:blog.languageDirection"
      expr:lang="data:blog.locale.language"
      xmlns="http://www.w3.org/1999/xhtml"
      xmlns:b="http://www.google.com/2005/gml/b"
      xmlns:data="http://www.google.com/2005/gml/data"
      xmlns:expr="http://www.google.com/2005/gml/expr">
```

### 3.2 `<head>` Elements Tree
1. `<meta content="width=device-width, initial-scale=1" name="viewport"/>`
2. `<meta content="0.0.0+..." name="theme-build"/>`
3. `<title><b:eval expr="data:view.title.escaped"/></title>`
4. `<b:include data="blog" name="all-head-content"/>`
5. `<link rel="canonical" expr:href="data:view.url.canonical"/>`
6. `<meta name="description" .../>` (Fallbacks: `view.description` &rarr; `blog.metaDescription`)
7. OpenGraph Social Meta Tags: `og:site_name`, `og:type`, `og:title`, `og:url`, `og:description`, `og:image`
8. Twitter Card Meta Tags: `twitter:card`, `twitter:image`, `twitter:title`, `twitter:description`
9. Schema.org `WebSite` JSON-LD with `SearchAction` (on Homepage / Search)
10. Schema.org `BlogPosting` JSON-LD (on Post views)
11. `<b:skin version="0.0.0"><![CDATA[ ... 10 KB pure OKLCH CSS ... ]]></b:skin>`
12. `<b:defaultmarkups>` containing 6 `<b:defaultmarkup>` elements:
    - `Common`: `widgetTitle`, `widget-title`, `widgetNotAvailableInPreview`
    - `PopularPosts`: `main`, `snippetedPostContent`, `snippetedPostTitle`, `snippetedPostThumbnail`, `postSnippet`
    - `FeaturedPost`: `main`, `snippetedPostContent`, `snippetedPostTitle`, `snippetedPostThumbnail`
    - `ContactForm`: `main`, `formContent`
    - `BlogArchive`: `main`, `content`, `flat`, `hierarchy`, `interval`
    - `Label`: `main`, `content`, `list`, `cloud`

### 3.3 `<body>` Hierarchy & Sections
- `<body class='...'>`
  - `<b:class cond="data:view.isHomepage and not data:newerPageUrl" name="is-home-lead"/>`
  - `<b:class cond="data:view.isPost" name="is-post"/>`
  - `<b:class cond="data:view.isPage" name="is-page"/>`
  - `<a class="skip-link" href="#content">Skip to content</a>`
  - `<div class="header-outer" role="banner">`
    - `<b:section class="header" id="header" maxwidgets="1" name="Header" showaddelement="no">`
      - `<b:widget id="Header1" type="Header" version="2" locked="true" visible="true" title="Blog Header">`
        - Includable: `main` (evaluates `data:title ?: data:blog.title` with `h1`/`p` switch)
  - `<b:if cond="data:view.isLayoutMode or data:widgets any (w =&gt; w.sectionId == &quot;navlinks&quot;)">`
    - `<div class="nav-container">`
      - `<b:section class="navlinks" id="navlinks" maxwidgets="1" name="Navigation" showaddelement="no">`
        - `<b:widget id="LinkList1" type="LinkList" version="2" locked="false" visible="true" title="Navigation">`
          - Includable: `main`
  - `<b:if cond="data:view.isLayoutMode or data:widgets any (w =&gt; w.sectionId == &quot;intro&quot;)">`
    - `<div class="intro-container">`
      - `<b:section class="intro" id="intro" maxwidgets="1" name="Intro" showaddelement="no">`
        - `<b:widget id="HTML1" type="HTML" version="2" locked="false" visible="true" title="Intro">`
          - Includable: `main`
  - `<b:if cond="data:view.isLayoutMode or data:widgets any (w =&gt; w.sectionId == &quot;topics&quot;)">`
    - `<div class="topics-container">`
      - `<b:section class="topics" id="topics" maxwidgets="1" name="Topics" showaddelement="no">`
        - `<b:widget id="Label1" type="Label" version="2" locked="false" visible="true" title="Topics">`
          - Includable: `main`
  - `<main class="main-content" id="content" role="main">`
    - `<b:section class="main" id="page_body" maxwidgets="1" name="Page Body" showaddelement="no">`
      - `<b:widget id="Blog1" type="Blog" version="2" locked="true" preferred="yes" visible="true" title="Blog Posts">`
        - `<b:widget-settings>` (8 basic settings)
        - Includables: `main`, `post`, `postTitle`, `postHeader`, `postBody`, `postBodySnippet`, `postFooter`, `comments`, `threadedComments`, `threadedCommentForm`, `status-message`, `postPagination`, plus 18 defensive empty includables
  - `<b:if cond="data:view.isLayoutMode or data:widgets any (w =&gt; w.sectionId == &quot;cta&quot;)">`
    - `<div class="cta-container">`
      - `<b:section class="cta" id="cta" maxwidgets="1" name="Call to Action" showaddelement="no">`
        - `<b:widget id="HTML2" type="HTML" version="2" locked="false" visible="true" title="Call to Action">`
          - Includable: `main`
  - `<b:if cond="data:view.isLayoutMode or data:widgets any (w =&gt; w.sectionId == &quot;footer&quot;)">`
    - `<footer class="footer-container" role="contentinfo">`
      - `<b:section class="footer" id="footer" maxwidgets="3" name="Footer" showaddelement="yes">`
        - `<b:widget id="HTML3" type="HTML" version="2" locked="false" visible="true" title="Footer">`
          - Includable: `main`
  - `<script>(()=>{document.documentElement.classList.add("js");})();</script>`

---

## 4. Structural Comparison Matrix

| Feature / Aspect | Google Contempo v1.3.3 (`contempo-1.3.3.xml`) | Ledger Theme (`dist/theme.xml`) | Impact & Key Difference |
| :--- | :--- | :--- | :--- |
| **Total Lines / File Size** | 4,211 lines (~140 KB) | 685 lines (~45.2 KB) | Ledger is ~67% smaller, zero bloat, pure semantic markup |
| **Template Type** | Google Native V3 (`b:templateUrl='indie.xml'`) | Custom Layouts V3 (`b:templateVersion='0.0.0'`) | Standard Blogger Layouts V3 compliance |
| **Locale Expression** | `expr:lang='data:blog.locale'` | `expr:lang='data:blog.locale.language'` | Contempo uses root locale (`en`), Ledger uses `locale.language` (`en`) |
| **`<b:skin>` Content** | 66 KB containing `Variable` definitions, CSS functions, `@import` | 10 KB pure CSS without `@import`, OKLCH tokens | Contempo supports Blogger Theme Designer GUI variables |
| **`<b:template-skin>`** | Present (722 B dynamic CSS) | Omitted (Not required for custom theme) | No functional impact |
| **SEO & Schema.org** | Basic meta tags, old G+/Facebook markup | Modern Schema.org JSON-LD (`WebSite`, `BlogPosting`), OpenGraph, Twitter Cards | Ledger has full rich snippet SEO support |
| **Layout Mode (`b:section` count)** | 6 Sections (`search_top`, `header`, `page_list_top`, `ads`, `page_body`, `footer`, `sidebar_top`, `sidebar_bottom`) | 7 Sections (`header`, `navlinks`, `intro`, `topics`, `page_body`, `cta`, `footer`) | Contempo uses multi-column drawer sidebar; Ledger uses linear vertical editorial layout |
| **`showaddelement` attribute** | `showaddelement='false'` | `showaddelement="no"` | Synonymous in Blogger XML, but `'false'` is Contempo's standard |
| **Conditional Section Guards** | Naked `<b:section>` tags without wrapper `<b:if>` | Wrapped in `<b:if cond="data:view.isLayoutMode or data:widgets any ...">` | Contempo lets Blogger CSS handle empty sections; Ledger conditionally skips containers |
| **Widget Version Tagging** | Implicit via `b:defaultwidgetversion='2'` on `<html>` (only HTML widgets have `version='2'`) | Explicit `version="2"` on all `<b:widget>` elements | Explicit version conforms to `AGENTS.md` and `V3-REFERENCE.md` |
| **Widget Title Attribute** | Dynamic blog header title injected by Blogger DB | Hardcoded default `title="Blog Header"`, `title="Blog Posts"` | Blogger's backend matches widgets by `id` (`Header1`, `Blog1`) |
| **Includable Dispatch (`Blog1`)** | Calls `<b:include name='super.main'/>` (delegates to Google's internal Java widgets engine) | Custom native V3 loop: `<b:loop values="data:posts" var="post">` | Contempo relies on Google built-in includables; Ledger writes full standalone markup |
| **Defaultmarkups Usage** | 12 types overriding specific presentation points of `super.main` | 6 types providing defensive fallbacks for dashboard-added gadgets | Contempo uses defaultmarkups as the primary rendering engine; Ledger uses direct widget templates |

---

## 5. In-Depth Component & Includable Comparison

### 5.1 Root `<html>` and Document Setup
- **Contempo:**
  `b:templateUrl='indie.xml' b:templateVersion='1.3.3' expr:lang='data:blog.locale'`
- **Ledger:**
  `b:templateVersion='0.0.0' expr:lang='data:blog.locale.language'`

### 5.2 `<head>` Structure & Metadata
- **Contempo:**
  Minimal `<head>` that delegates head content to `<b:include data='blog' name='all-head-content'/>`, loads external clipboard.js, AdSense JS, and Google Analytics.
- **Ledger:**
  Extensive standard `<head>` containing complete OpenGraph tags, Twitter Card tags, and Schema.org JSON-LD scripts with `.jsonEscaped` sanitization.

### 5.3 Skin & CSS Delivery
- **Contempo:**
  Uses Blogger's `<Variable>` syntax (`<Variable name="key" description="..." type="color" default="#..."/>`) allowing users to customize colors and fonts in the Blogger Theme Designer GUI.
- **Ledger:**
  Uses modern CSS custom properties (`:root { color: oklch(...); }`), compiled from SCSS, meeting strict WCAG contrast ratios without requiring Blogger GUI variables.

### 5.4 Defaultmarkups Architecture
- **Contempo:**
  Contempo's entire rendering philosophy is built around `<b:defaultmarkups>`. When `Blog1` executes `<b:include name='super.main'/>`, Blogger resolves sub-includables (`post`, `postBodySnippet`, `headerByline`, `postFooter`, `commentsLink`) by looking inside `<b:defaultmarkup type='Blog'>` and `<b:defaultmarkup type='Blog,FeaturedPost,PopularPosts'>`.
- **Ledger:**
  Ledger uses direct, self-contained includables declared right inside `<b:widget id='Blog1'>` (`post`, `postTitle`, `postHeader`, `postBody`, `postFooter`, `comments`, `threadedComments`, `status-message`, `postPagination`). Its `<b:defaultmarkups>` block is dedicated to styling external gadgets added by the blog owner in Layout Mode (`PopularPosts`, `FeaturedPost`, `ContactForm`, `BlogArchive`, `Label`).

### 5.5 Section Hierarchy & Nesting
- **Contempo:**
  Contempo declares its sections directly in the DOM flow. It contains two main sections:
  1. `#page_body` inside `.centered-bottom` (containing `FeaturedPost1`, `Blog1`, `PopularPosts1`).
  2. `#sidebar_bottom` inside `aside.sidebar-container` (containing `BlogArchive1`, `Label1`, `LinkList1`, `HTML1`, `HTML2`, `HTML3`).
- **Ledger:**
  Ledger flattens the layout into 7 distinct editable vertical zones:
  1. `header` (`Header1`)
  2. `navlinks` (`LinkList1`)
  3. `intro` (`HTML1`)
  4. `topics` (`Label1`)
  5. `page_body` (`Blog1`)
  6. `cta` (`HTML2`)
  7. `footer` (`HTML3`)

### 5.6 Header Widget (`Header1`) Architecture
- **Contempo:**
  ```xml
  <b:widget id='Header1' locked='true' title='...' type='Header' visible='true'>
    <b:widget-settings> ... </b:widget-settings>
    <b:includable id='main' var='this'>
      <div class='header-widget'>
        <b:include cond='data:imagePlacement in {"REPLACE", "BEFORE_DESCRIPTION"}' name='image'/>
        <b:include cond='data:imagePlacement not in {"REPLACE", "BEFORE_DESCRIPTION"}' name='title'/>
        <b:include cond='data:imagePlacement != "REPLACE"' name='description'/>
      </div>
    </b:includable>
    <b:includable id='title'>
      <div><b:class cond='data:this.imagePlacement == "REPLACE"' name='replaced'/><b:include name='super.title'/></div>
    </b:includable>
    <b:includable id='description'>
      <p><data:this.description/></p>
    </b:includable>
  </b:widget>
  ```
- **Ledger:**
  ```xml
  <b:widget id='Header1' locked='true' title='Blog Header' type='Header' version='2' visible='true'>
    <b:includable id='main'>
      <b:with value='data:title ?: data:blog.title' var='headerTitle'>
        <b:with value='data:description ?: data:blog.description' var='headerDescription'>
          <b:if cond='not data:view.isSingleItem'>
            <h1 class='site-title'><a expr:href='data:blog.homepageUrl'><b:eval expr='data:headerTitle'/></a></h1>
          </b:if>
          <b:if cond='data:view.isSingleItem'>
            <p class='site-title'><a expr:href='data:blog.homepageUrl'><b:eval expr='data:headerTitle'/></a></p>
          </b:if>
          <b:if cond='data:headerDescription'>
            <p class='site-tagline'><b:eval expr='data:headerDescription'/></p>
          </b:if>
        </b:with>
      </b:with>
    </b:includable>
  </b:widget>
  ```

### 5.7 Blog Widget (`Blog1`) Architecture
- **Contempo:**
  Contempo's `Blog1` widget relies on `<b:include name='super.main'/>` wrapped in `<b:with>` variables that filter out the featured post on the homepage and calculate desktop/mobile ad limits. It relies on Blogger's internal widget engine to loop posts and render default markup.
- **Ledger:**
  Ledger explicitly loops `data:posts` using `<b:loop values="data:posts" var="post">`, dispatching cleanly to `postTitle`, `postHeader`, `postBodySnippet` (on multiple item views) or `postBody` (on single item views), followed by `postPagination` and `comments`.

---

## 6. Why Blogger Serves `no-items` Empty Sections: Technical Discrepancies

When Blogger serves a page, if a section in Blogger's database has widgets, but Blogger fails to compile or evaluate the widgets, Blogger outputs:
```html
<div class='[class] no-items section' id='[id]' name='[name]'></div>
```

Comparing the exact live output and Contempo reveals the critical reasons:

### 1. The Critical Distinction between Widget Includables vs `super.main`
In Contempo, `Blog1` executes `<b:include name='super.main'/>`. Blogger's proprietary template compiler has an internal Java class (`com.google.blogger.b2.layouts.widgets.BlogView`) that binds `posts`, sets up pagination, prepares comment iframes, and injects widget markup.
When a theme declares `Blog1` with a custom `main` includable that does **not** call `super.main` or does not match Blogger's exact expected includable signatures, Blogger's compiler may fail to find the expected entry point for the widget if certain internal data fields are missing.

### 2. Section Name & Container Class Attributes
In Contempo:
- `header` section: `<b:section class='container' id='header' name='Header' showaddelement='false'>`
- `page_body` section: `<b:section class='main' id='page_body' name='Page Body' showaddelement='false'>`
In Ledger:
- `header` section: `<b:section class='header' id='header' maxwidgets='1' name='Header' showaddelement='no'>`
- `page_body` section: `<b:section class='main' id='page_body' maxwidgets='1' name='Page Body' showaddelement='no'>`

### 3. Missing Widget Settings Blocks
In Contempo, `Header1` and `Blog1` include full `<b:widget-settings>` XML blocks (e.g. `useImage`, `imagePlacement`, `showAuthor`, `showDateHeader`, `style.textcolor`, etc.). If Blogger's database expects these setting nodes when initializing the widget bean, omitting them or having partial settings can cause Blogger's widget bean serializer to fail during rendering.

---

## 7. Actionable Recommendations

1. **Adopt Contempo's Includable Signatures for `Header1` and `Blog1`**:
   Provide the full set of default includables (`title`, `description`, `image`, `post`, `postBody`, `postBodySnippet`, `postTitle`, `postHeader`, `postFooter`) so that Blogger's widget manager recognizes all required widget nodes.
2. **Align `<b:widget-settings>`**:
   Include the standard `<b:widget-settings>` blocks for `Header1` and `Blog1` as defined in `docs/contempo/widgets/header.xml` and `docs/contempo/widgets/blog.xml`.
3. **Align Section Attributes**:
   Change `showaddelement="no"` to `showaddelement='false'` across all `<b:section>` tags to match native Google themes 1:1.
