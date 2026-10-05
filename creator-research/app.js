const usernamePattern = /^[\p{L}\p{N}_.-]{1,50}$/u;
const byId = (id) => document.getElementById(id);
const selected = new Map();
let busy = false;
let saved = false;
function element(tag, content, className) {
  const node = document.createElement(tag);
  if (content !== undefined) {
    node.textContent = content;
  }
  if (className) {
    node.className = className;
  }
  return node;
}
function setStatus(message, error = false) {
  byId('status').textContent = message;
  byId('status').className = error ? 'error' : '';
}
function controls() {
  byId('search-button').disabled = busy;
  byId('save-button').disabled = busy || saved || !selected.size;
  byId('load-lists').disabled = busy;
  for (const button of document.querySelectorAll(
    '[data-handle], #selected button, #saved-lists button'
  )) {
    button.disabled = busy;
  }
}
async function request(path, body) {
  const response = await fetch(path, {
    method: body ? 'POST' : 'GET',
    ...(body
      ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
      : {}),
  });
  const payload = await response.json();
  if (!response.ok) {
    const retry = response.headers.get('retry-after');
    throw new Error(
      `${response.status}: ${payload.error?.message ?? 'Request failed.'}${retry ? ` Retry-After: ${retry}s.` : ''}`
    );
  }
  return { payload, charged: response.headers.get('x-credits-charged') };
}
async function action(work) {
  if (busy) {
    return;
  }
  busy = true;
  controls();
  try {
    await work();
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    busy = false;
    controls();
  }
}
function selectionChanged() {
  saved = false;
  byId('save-button').textContent = 'Save shortlist';
  byId('selection-count').textContent = `${selected.size} / 8`;
  byId('selected').replaceChildren();
  for (const [username] of selected) {
    const li = element('li');
    li.append(element('span', `@${username}`));
    const remove = element('button', 'Remove', 'text-button');
    remove.type = 'button';
    remove.setAttribute('aria-label', `Remove @${username}`);
    remove.addEventListener('click', () => {
      selected.delete(username);
      selectionChanged();
    });
    li.append(remove);
    byId('selected').append(li);
  }
  for (const button of document.querySelectorAll('[data-handle]')) {
    const active = selected.has(button.dataset.handle);
    button.textContent = active ? 'Selected' : 'Add to shortlist';
    button.setAttribute('aria-pressed', String(active));
  }
  controls();
}
const provenance = {
  post_evidence: 'Post evidence',
  profile_fact: 'Profile fact',
  inferred: 'Inferred',
};
function appendProfile(card, profile) {
  if (profile?.platform === 'instagram' && usernamePattern.test(profile.username)) {
    const username = profile.username.toLowerCase();
    const link = element('a', `@${username}`);
    link.href = `https://www.instagram.com/${encodeURIComponent(username)}/`;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    card.append(link);
    card.append(
      element(
        'p',
        `${profile.followers == null ? 'Unknown followers' : `${profile.followers.toLocaleString()} followers`} · ${profile.engagement_rate == null ? 'Unknown engagement' : `${profile.engagement_rate}% engagement`}`,
        'metrics'
      )
    );
    const add = element('button', 'Add to shortlist', 'secondary');
    add.type = 'button';
    add.dataset.handle = username;
    add.addEventListener('click', () => {
      if (selected.has(username)) {
        selected.delete(username);
      } else if (selected.size < 8) {
        selected.set(username, { platform: 'instagram', username });
      } else {
        setStatus('Your shortlist has eight profiles. Remove one before adding another.', true);
        return;
      }
      selectionChanged();
    });
    card.append(add);
  } else {
    card.append(element('p', 'Profile details unavailable.', 'hint'));
  }
}

function appendEvidence(card, match) {
  if (match.evidence?.length) {
    const details = element('details');
    details.append(element('summary', 'Review supporting evidence'));
    for (const item of match.evidence) {
      const evidence = element('div', undefined, 'evidence');
      evidence.append(
        element('p', provenance[item.provenance] ?? 'Evidence', 'eyebrow'),
        element('p', item.text)
      );
      if (item.evidence_quote) {
        evidence.append(element('blockquote', item.evidence_quote));
      }
      details.append(evidence);
    }
    card.append(details);
  }
}

function showResults(search) {
  const results = byId('results');
  results.replaceChildren();
  byId('result-count').textContent = `${search.data.length} results`;
  if (!search.data.length) {
    results.append(
      element(
        'p',
        'No matches. Try a more specific brief or a different topic. Each new search is billed.',
        'empty'
      )
    );
  }
  for (const result of search.data) {
    const card = element('article', undefined, 'creator');
    const profile = result.relevant_profile ?? result.primary_profile;
    const match = result.match;
    const fallback = (match.ranking_source ?? search.quality?.mode) === 'retrieval_fallback';
    let tag = 'Search relevance';
    if (fallback) {
      tag = 'Discovery candidate';
    } else if (match.low_confidence) {
      tag = 'Additional candidate to review';
    }
    card.append(element('p', tag, 'eyebrow'), element('h3', result.creator.name ?? 'Creator'));
    appendProfile(card, profile);
    if (!fallback && Number.isFinite(match.score)) {
      card.append(element('p', `Relevance score ${match.score.toFixed(2)} / 1`, 'hint'));
    }
    if (result.location_unverified) {
      card.append(element('p', 'Location unverified', 'hint'));
    }
    const reasons = element('ul', undefined, 'reasons');
    for (const reason of match.reasons ?? []) {
      reasons.append(element('li', reason));
    }
    card.append(reasons);
    appendEvidence(card, match);
    results.append(card);
  }
  selectionChanged();
}
byId('search-form').addEventListener('submit', (event) => {
  event.preventDefault();
  action(async () => {
    setStatus('Searching for creators…');
    const { payload, charged } = await request('/api/search', { query: byId('brief').value });
    showResults(payload);
    const quality = payload.quality?.reason ? ` ${payload.quality.reason}` : '';
    setStatus(
      `${payload.data.length} ${payload.data.length === 1 ? 'creator' : 'creators'} returned.${charged == null ? '' : ` ${charged} credits charged.`}${quality}`
    );
  });
});
byId('save-form').addEventListener('submit', (event) => {
  event.preventDefault();
  if (!byId('brief').value.trim()) {
    byId('brief').focus();
    setStatus('Add a campaign brief before saving.', true);
    return;
  }
  action(async () => {
    setStatus('Saving your shortlist…');
    const { payload } = await request('/api/shortlists', {
      name: byId('name').value,
      brief: byId('brief').value,
      notes: byId('notes').value,
      profiles: [...selected.values()],
    });
    saved = true;
    byId('save-button').textContent = 'Saved';
    setStatus(`Saved “${payload.data.name}”. Load your lists to reopen it.`);
  });
});
async function openList(id) {
  const { payload } = await request(`/api/shortlists/${encodeURIComponent(id)}`);
  const list = payload.data;
  selected.clear();
  for (const profile of list.profiles) {
    selected.set(profile.username.toLowerCase(), profile);
  }
  byId('brief').value = list.brief;
  byId('name').value = list.name;
  byId('notes').value = list.notes;
  byId('results').replaceChildren(
    element(
      'p',
      'Saved profile references restored. Search this brief to review new candidates.',
      'empty'
    )
  );
  byId('result-count').textContent = '';
  selectionChanged();
  byId('save-button').textContent = 'Save as new list';
  setStatus(`Opened “${list.name}”. Editing and saving creates a new list.`);
}
byId('load-lists').addEventListener('click', () =>
  action(async () => {
    setStatus('Loading saved lists…');
    const { payload } = await request('/api/shortlists');
    const container = byId('saved-lists');
    container.replaceChildren();
    for (const list of payload.data) {
      const button = element(
        'button',
        `${list.name} · ${list.profiles.length} ${list.profiles.length === 1 ? 'profile' : 'profiles'}`,
        'saved-list'
      );
      button.type = 'button';
      button.addEventListener('click', () => action(() => openList(list.id)));
      container.append(button);
    }
    if (!payload.data.length) {
      container.append(element('p', 'No saved lists in this API account.', 'hint'));
    }
    setStatus(
      `${payload.data.length} saved ${payload.data.length === 1 ? 'list' : 'lists'} loaded. No credits charged.`
    );
  })
);
for (const id of ['brief', 'name', 'notes']) {
  byId(id).addEventListener('input', () => {
    saved = false;
    byId('save-button').textContent = 'Save shortlist';
    controls();
  });
}
