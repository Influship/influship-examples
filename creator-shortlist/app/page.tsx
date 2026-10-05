'use client';

import { useRef, useState } from 'react';
import { type Shortlist, toCsv } from '../lib/shortlist';

export default function Page() {
  const [brief, setBrief] = useState(
    'Fitness creators who teach approachable home workouts with minimal equipment.'
  );
  const [result, setResult] = useState<Shortlist | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const busy = useRef(false);

  async function search(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) {
      return;
    }
    busy.current = true;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? 'Search could not complete.');
      }
      setResult(data);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Search could not complete.');
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }

  function download() {
    if (!result) {
      return;
    }
    const url = URL.createObjectURL(
      new Blob([toCsv(result.candidates)], { type: 'text/csv;charset=utf-8' })
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'creator-shortlist.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main>
      <header>
        <a href='https://docs.influship.com'>
          influship <span>/ developer examples</span>
        </a>
        <span className='tag'>Instagram discovery</span>
      </header>
      <section className='intro'>
        <p className='eyebrow'>CAMPAIGN BRIEF → CREATOR SHORTLIST</p>
        <h1>
          Find the people
          <br />
          who fit your brief.
        </h1>
        <p>
          Describe the content you need. Review five ranked creators, read why they match, and
          export your shortlist.
        </p>
        <p className='setup-links'>
          Running this example for the first time?{' '}
          <a href='https://developers.influship.com'>Get an API key</a> and follow the{' '}
          <a href='https://docs.influship.com/cookbook/creator-search-nextjs'>setup guide</a>.
        </p>
      </section>
      <form onSubmit={search}>
        <label htmlFor='brief'>Your campaign brief</label>
        <textarea
          id='brief'
          maxLength={500}
          minLength={3}
          onChange={(event) => setBrief(event.target.value)}
          required
          rows={4}
          value={brief}
        />
        <div className='form-footer'>
          <p>
            Up to 35 credits ($0.35) per search.{' '}
            <a href='https://docs.influship.com/concepts/pricing'>Pricing</a>
          </p>
          <button disabled={loading || brief.trim().length < 3} type='submit'>
            {loading ? 'Finding creators…' : 'Build shortlist →'}
          </button>
        </div>
      </form>
      {error && (
        <p className='error' role='alert'>
          {error}
        </p>
      )}
      {loading && (
        <p className='status' role='status'>
          Searching Instagram creators. This can take a moment.
        </p>
      )}
      {result && (
        <section aria-label='Search results' aria-live='polite'>
          <div className='results-header'>
            <div>
              <h2>
                {result.candidates.length} {result.candidates.length === 1 ? 'creator' : 'creators'}{' '}
                to review
              </h2>
              <p>
                {result.creditsCharged === null
                  ? 'Usage header unavailable'
                  : `${result.creditsCharged} credits charged`}
              </p>
            </div>
            {result.candidates.length > 0 && (
              <button className='secondary' onClick={download} type='button'>
                Export CSV
              </button>
            )}
          </div>
          {result.candidates.length === 0 && (
            <p className='status'>
              No creators matched this brief. Try a broader topic or fewer constraints.
            </p>
          )}
          <div className='results'>
            {result.candidates.map((candidate, index) => (
              <article key={candidate.id}>
                <div className='candidate-heading'>
                  <span className='rank'>{String(index + 1).padStart(2, '0')}</span>
                  <div>
                    <h3>{candidate.name}</h3>
                    {candidate.username ? (
                      <a
                        href={`https://www.instagram.com/${encodeURIComponent(candidate.username)}/`}
                        rel='noreferrer'
                        target='_blank'
                      >
                        @{candidate.username} ↗
                      </a>
                    ) : (
                      <p>Profile unavailable</p>
                    )}
                  </div>
                  <div className='score'>
                    <strong>{Math.round(candidate.score * 100)}%</strong>
                    <span>
                      {candidate.rankingSource === 'retrieval_fallback'
                        ? 'Retrieval relevance'
                        : 'Search relevance'}
                    </span>
                  </div>
                </div>
                <div className='metrics'>
                  <span>
                    {candidate.followers === null
                      ? 'Followers unknown'
                      : `${candidate.followers.toLocaleString()} followers`}
                  </span>
                  <span>
                    {candidate.engagementRate === null
                      ? 'Engagement unknown'
                      : `${candidate.engagementRate}% engagement`}
                  </span>
                </div>
                {candidate.locationUnverified && (
                  <p className='notice'>Location needs verification.</p>
                )}
                {candidate.lowConfidence && (
                  <p className='notice'>Lower confidence match — review the content.</p>
                )}
                {candidate.reasons.length > 0 ? (
                  <ul>
                    {[...new Set(candidate.reasons)].map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                ) : (
                  <p>No match explanation returned. Review the profile.</p>
                )}
              </article>
            ))}
          </div>
          <p className='fine-print'>
            Scores describe relevance to this search; they do not predict campaign performance.
            Search ID: {result.searchId}
          </p>
        </section>
      )}
      <footer>
        <a href='https://docs.influship.com/cookbook/creator-search-nextjs'>
          Read this example's guide ↗
        </a>
        <a href='https://docs.influship.com/sdks'>Built with the Influship TypeScript SDK ↗</a>
        <a href='https://docs.influship.com/cookbook'>More recipes ↗</a>
        <a href='https://docs.influship.com/guides/error-handling'>Troubleshooting ↗</a>
      </footer>
    </main>
  );
}
