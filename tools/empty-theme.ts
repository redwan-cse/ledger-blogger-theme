export function renderEmptyTheme(sha: string): { build: string; xml: string } {
  if (!/^[0-9a-f]{40}$/i.test(sha)) throw new Error('A full 40-character git SHA is required.');
  const build = `0.0.0+${sha}`;
  const xml = `<?xml version="1.0" encoding="UTF-8" ?>
<!DOCTYPE html>
<html b:css='false' b:defaultwidgetversion='2' b:layoutsVersion='3' b:responsive='true' b:templateVersion='0.0.0' expr:dir='data:blog.languageDirection' expr:lang='data:blog.locale.language' xmlns='http://www.w3.org/1999/xhtml' xmlns:b='http://www.google.com/2005/gml/b' xmlns:data='http://www.google.com/2005/gml/data' xmlns:expr='http://www.google.com/2005/gml/expr'>
<head>
<meta content='width=device-width, initial-scale=1' name='viewport'/>
<meta content='${build}' name='theme-build'/>
<title><data:view.title.escaped/></title>
<b:skin version='0.0.0'><![CDATA[body{font-family:sans-serif;margin:0}main{min-height:1px}]]></b:skin>
</head>
<body>
<header>
<b:section id='header' maxwidgets='1' showaddelement='no'>
<b:widget id='Header1' locked='true' title='Blog Header' type='Header' version='2' visible='true'>
<b:includable id='main' var='this'>
<p><data:title/></p>
</b:includable>
</b:widget>
</b:section>
</header>
<main id='main'>
<b:section id='content' maxwidgets='1' preferred='yes' showaddelement='no'>
<b:widget id='Blog1' locked='true' title='Blog Posts' type='Blog' version='2' visible='true'>
<b:includable id='main'>
<b:comment>M0 RED control: intentionally render no post content.</b:comment>
</b:includable>
</b:widget>
</b:section>
</main>
</body>
</html>
`;
  return { build, xml };
}
