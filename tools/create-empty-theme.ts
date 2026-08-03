import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const sha = (process.env.GITHUB_SHA ?? execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' })).trim();
if (!/^[0-9a-f]{40}$/i.test(sha)) throw new Error('A full 40-character git SHA is required.');
const build = `0.0.0+${sha}`;
const xml = `<?xml version='1.0' encoding='UTF-8' ?>
<!DOCTYPE html>
<html b:css='false' b:defaultwidgetversion='2' b:layoutsVersion='3' b:responsive='true' b:templateVersion='${build}' xmlns='http://www.w3.org/1999/xhtml' xmlns:b='http://www.google.com/2005/gml/b' xmlns:data='http://www.google.com/2005/gml/data' xmlns:expr='http://www.google.com/2005/gml/expr'>
<head>
<meta content='width=device-width, initial-scale=1' name='viewport'/>
<meta content='${build}' name='theme-build'/>
<title><data:view.title.escaped/></title>
<b:skin><![CDATA[body{font-family:sans-serif;margin:0}main{padding:2rem}]]></b:skin>
</head>
<body>
<b:section id='header' maxwidgets='1' showaddelement='no'>
<b:widget id='Header1' locked='true' title='Blog Header' type='Header' version='2'/>
</b:section>
<main id='main'></main>
<b:section id='content' maxwidgets='1' showaddelement='no'>
<b:widget id='Blog1' locked='true' title='Blog Posts' type='Blog' version='2' visible='false'/>
</b:section>
</body>
</html>
`;
await mkdir('dist/m0', { recursive: true });
await writeFile('dist/m0/empty-theme.xml', xml, 'utf8');
await writeFile('dist/m0/build.txt', `${build}\n`, 'utf8');
console.log(`Generated dist/m0/empty-theme.xml with EXPECTED_THEME_BUILD=${build}`);
