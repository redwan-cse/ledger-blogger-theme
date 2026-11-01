interface PostItem {
  id: string;
  title: string;
  url: string;
  published: string;
  labels?: string[];
}

export interface SyncArchiveOptions {
  token: string;
  blogId: string;
  pageId?: string;
  log?: (msg: string) => void;
}

export async function syncArchivePage(options: SyncArchiveOptions): Promise<{ success: boolean; totalPosts: number; pageUrl: string }> {
  const log = options.log || console.log;
  const blogId = options.blogId;
  const token = options.token;

  log('[Archive Syncer] Fetching all live published posts from Blogger API...');
  let allPosts: PostItem[] = [];
  let pageToken: string | null = null;

  do {
    const url = `https://www.googleapis.com/blogger/v3/blogs/${blogId}/posts?status=live&maxResults=100${pageToken ? '&pageToken=' + pageToken : ''}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Failed to list posts: ${res.status} ${errText}`);
    }
    const data = await res.json() as { items?: PostItem[]; nextPageToken?: string };
    if (data.items) allPosts = allPosts.concat(data.items);
    pageToken = data.nextPageToken || null;
  } while (pageToken);

  log(`[Archive Syncer] Fetched ${allPosts.length} live posts.`);

  allPosts.sort((a, b) => new Date(b.published).getTime() - new Date(a.published).getTime());

  interface Cluster {
    id: string;
    desc: string;
    posts: PostItem[];
  }

  const clusters: Record<string, Cluster> = {
    'AWS & Cloud Infrastructure Security': {
      id: 'cloud-security',
      desc: 'IAM architecture, privilege escalation vectors, AWS EKS IRSA, and cross-account federation defenses.',
      posts: []
    },
    'Active Directory, Windows & Identity Security': {
      id: 'identity-security',
      desc: 'Kerberos abuse, ticket forgery, AD CS certificate template exploitation, and LSASS protection.',
      posts: []
    },
    'Linux Kernel, Low-Level & OS Security': {
      id: 'linux-kernel',
      desc: 'Kernel memory safety, UAF vulnerability analysis, route cache corruption, and eBPF/auditd telemetry.',
      posts: []
    },
    'Kubernetes, CI/CD & DevSecOps Architecture': {
      id: 'devsecops',
      desc: 'Kubernetes RBAC, container escapes, ArgoCD GitOps threat modeling, and GitLab CI/CD supply chain hardening.',
      posts: []
    },
    'AI Security & LLM Multi-Agent Defense': {
      id: 'ai-security',
      desc: 'Multi-agent frameworks, prompt injection sandboxing, Microsoft AutoGen, and CrewAI security modeling.',
      posts: []
    },
    'Threat Modeling, Web & Database Security': {
      id: 'threat-database',
      desc: 'PostgreSQL RLS bypasses, TMUI smuggling, protocol dissection, and enterprise defense guides.',
      posts: []
    }
  };

  for (const post of allPosts) {
    const title = post.title.toLowerCase();
    const labels = (post.labels || []).map(l => l.toLowerCase());

    if (title.includes('aws') || title.includes('cloud') || title.includes('irsa') || title.includes('eks') || labels.some(l => l.includes('cloud'))) {
      clusters['AWS & Cloud Infrastructure Security'].posts.push(post);
    } else if (title.includes('active directory') || title.includes('kerberos') || title.includes('lsass') || title.includes('certipy') || title.includes('ad cs') || title.includes('shadow credential') || title.includes('pac ') || labels.some(l => l.includes('identity'))) {
      clusters['Active Directory, Windows & Identity Security'].posts.push(post);
    } else if (title.includes('linux') || title.includes('kernel') || title.includes('overlayfs') || title.includes('uaf') || title.includes('nftables') || title.includes('memory') || title.includes('cve-2024-36971') || title.includes('cve-2024-1086')) {
      clusters['Linux Kernel, Low-Level & OS Security'].posts.push(post);
    } else if (title.includes('kubernetes') || title.includes('gitlab') || title.includes('argo') || title.includes('gitops') || title.includes('ci/cd') || title.includes('rbac') || labels.some(l => l.includes('devsecops'))) {
      clusters['Kubernetes, CI/CD & DevSecOps Architecture'].posts.push(post);
    } else if (title.includes('ai') || title.includes('autogen') || title.includes('crewai') || title.includes('agent') || title.includes('vllm') || labels.some(l => l.includes('ai'))) {
      clusters['AI Security & LLM Multi-Agent Defense'].posts.push(post);
    } else {
      clusters['Threat Modeling, Web & Database Security'].posts.push(post);
    }
  }

  let html = `<div class="archive-master-page">
  <p class="lead">Complete index of all <strong>${allPosts.length} security research publications</strong>, threat modeling deconstructions, vulnerability analyses, and Blue Team defense architectures published on <a href="https://blogs.redwan.work/">blogs.redwan.work</a> by <strong>Md Redwan Ahmed</strong>.</p>

  <nav class="archive-jump-nav" aria-label="Topic Clusters" style="margin: 24px 0; display: flex; flex-wrap: wrap; gap: 8px;">\n`;

  for (const [name, data] of Object.entries(clusters)) {
    const shortName = name.split('&')[0].trim();
    html += `    <a href="#${data.id}" class="pill-button" style="display: inline-block; padding: 6px 14px; border-radius: 20px; text-decoration: none; font-size: 0.85rem; border: 1px solid rgba(127,127,127,0.3); font-weight: 500;">${shortName} (${data.posts.length})</a>\n`;
  }
  html += `  </nav>\n\n`;

  for (const [name, data] of Object.entries(clusters)) {
    html += `  <section id="${data.id}" class="archive-cluster-section" style="margin-top: 40px; margin-bottom: 32px;">
    <h2 style="display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid rgba(127,127,127,0.25); padding-bottom: 8px; margin-bottom: 12px;">
      <span>${name}</span>
      <span style="font-size: 0.85rem; font-weight: 600; padding: 3px 10px; border-radius: 12px; background: rgba(127,127,127,0.15);">${data.posts.length} Guides</span>
    </h2>
    <p style="font-size: 0.92rem; opacity: 0.85; margin-bottom: 16px;">${data.desc}</p>
    <ul class="archive-post-list" style="list-style: none; padding: 0; margin: 0;">\n`;

    for (const post of data.posts) {
      const dateStr = new Date(post.published).toISOString().split('T')[0];
      const safeTitle = post.title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      html += `      <li style="padding: 10px 0; border-bottom: 1px dashed rgba(127,127,127,0.2); display: flex; justify-content: space-between; align-items: baseline; gap: 16px;">
        <a href="${post.url}" style="font-weight: 500; text-decoration: none; color: inherit;">${safeTitle}</a>
        <time datetime="${dateStr}" style="font-size: 0.82rem; opacity: 0.7; white-space: nowrap; font-family: monospace;">${dateStr}</time>
      </li>\n`;
    }
    html += `    </ul>
  </section>\n\n`;
  }

  html += `</div>\n`;

  // Find or use target archive page ID
  let targetPageId = options.pageId;
  if (!targetPageId) {
    const listPagesRes = await fetch(`https://www.googleapis.com/blogger/v3/blogs/${blogId}/pages`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (listPagesRes.ok) {
      const pagesData = await listPagesRes.json() as { items?: Array<{ id: string; url: string; title: string }> };
      const match = (pagesData.items || []).find(p => p.url.includes('archive.html') || p.title.toLowerCase() === 'archive');
      if (match) targetPageId = match.id;
    }
  }

  if (!targetPageId) {
    throw new Error('Archive page ID could not be determined. Please create /p/archive.html first.');
  }

  log(`[Archive Syncer] Patching Archive page (${targetPageId})...`);
  const patchRes = await fetch(`https://www.googleapis.com/blogger/v3/blogs/${blogId}/pages/${targetPageId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ content: html })
  });

  if (!patchRes.ok) {
    const errText = await patchRes.text();
    throw new Error(`Failed to patch archive page: ${patchRes.status} ${errText}`);
  }

  const updatedPage = await patchRes.json() as { url: string; updated: string };
  log(`[Archive Syncer] Archive page updated successfully! URL: ${updatedPage.url}, Updated: ${updatedPage.updated}`);

  return { success: true, totalPosts: allPosts.length, pageUrl: updatedPage.url };
}
