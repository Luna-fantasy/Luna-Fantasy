const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO;
const GITHUB_BRANCH = process.env.GITHUB_BRANCH ?? 'admin-dashboard';

interface GitHubFileResponse {
  content: string;
  sha: string;
  encoding: string;
}

/**
 * Commit translation changes to GitHub via the Contents API.
 * Reads current JSON, applies changes, creates a commit.
 * Skips silently if GITHUB_TOKEN is not configured.
 */
export async function commitTranslationChanges(
  changes: { key: string; value: string }[],
  locale: string
): Promise<{ committed: boolean; sha?: string }> {
  if (!GITHUB_TOKEN || !GITHUB_REPO) {
    console.log('[GitHub] Token or repo not configured, skipping commit');
    return { committed: false };
  }

  const filePath = `messages/${locale}.json`;
  const apiBase = `https://api.github.com/repos/${GITHUB_REPO}/contents/${filePath}`;
  const headers = {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  // GET current file
  const getRes = await fetch(`${apiBase}?ref=${GITHUB_BRANCH}`, { headers });
  if (!getRes.ok) {
    const err = await getRes.text();
    throw new Error(`GitHub GET failed (${getRes.status}): ${err}`);
  }

  const fileData: GitHubFileResponse = await getRes.json();
  const currentContent = Buffer.from(fileData.content, 'base64').toString('utf-8');
  const messages = JSON.parse(currentContent);

  // Apply changes using dot notation
  for (const { key, value } of changes) {
    const parts = key.split('.');
    let target: Record<string, any> = messages;
    for (let i = 0; i < parts.length - 1; i++) {
      if (typeof target[parts[i]] !== 'object' || target[parts[i]] === null) {
        target[parts[i]] = {};
      }
      target = target[parts[i]];
    }
    target[parts[parts.length - 1]] = value;
  }

  const updatedContent = JSON.stringify(messages, null, 2) + '\n';
  const encodedContent = Buffer.from(updatedContent).toString('base64');

  // PUT updated file
  const putBody = {
    message: `[Admin] Update ${locale} translations — ${changes.length} change${changes.length === 1 ? '' : 's'}`,
    content: encodedContent,
    sha: fileData.sha,
    branch: GITHUB_BRANCH,
  };

  const putRes = await fetch(apiBase, {
    method: 'PUT',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(putBody),
  });

  if (putRes.status === 409) {
    // Conflict — re-fetch and retry once
    const retryGet = await fetch(`${apiBase}?ref=${GITHUB_BRANCH}`, { headers });
    if (!retryGet.ok) throw new Error('GitHub retry GET failed');

    const retryData: GitHubFileResponse = await retryGet.json();
    const retryContent = Buffer.from(retryData.content, 'base64').toString('utf-8');
    const retryMessages = JSON.parse(retryContent);

    for (const { key, value } of changes) {
      const parts = key.split('.');
      let target: Record<string, any> = retryMessages;
      for (let i = 0; i < parts.length - 1; i++) {
        if (typeof target[parts[i]] !== 'object' || target[parts[i]] === null) {
          target[parts[i]] = {};
        }
        target = target[parts[i]];
      }
      target[parts[parts.length - 1]] = value;
    }

    const retryUpdated = JSON.stringify(retryMessages, null, 2) + '\n';
    const retryEncoded = Buffer.from(retryUpdated).toString('base64');

    const retryPut = await fetch(apiBase, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...putBody,
        content: retryEncoded,
        sha: retryData.sha,
      }),
    });

    if (!retryPut.ok) {
      const err = await retryPut.text();
      throw new Error(`GitHub PUT retry failed (${retryPut.status}): ${err}`);
    }

    const retryResult = await retryPut.json();
    return { committed: true, sha: retryResult.content?.sha };
  }

  if (!putRes.ok) {
    const err = await putRes.text();
    throw new Error(`GitHub PUT failed (${putRes.status}): ${err}`);
  }

  const result = await putRes.json();
  return { committed: true, sha: result.content?.sha };
}
