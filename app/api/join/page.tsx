'use client';

import { FormEvent, Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';

function JoinPageContent() {
  const searchParams = useSearchParams();
  const event = searchParams.get('event') || '';
  const invite = searchParams.get('invite') || '';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function joinEvent(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (!event) {
      setError('This invitation link is invalid or incomplete.');
      return;
    }

    if (!name.trim() || !email.trim()) {
      setError('Please enter your name and email.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/guest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event,
          invite,
          name: name.trim(),
          email: email.trim().toLowerCase(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || 'Unable to join this event.');
      }

      if (data?.url) {
        window.location.href = data.url;
        return;
      }

      if (data?.joinUrl) {
        window.location.href = data.joinUrl;
        return;
      }

      setError('The event was found, but no join destination was returned.');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to join this event.'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        background:
          'linear-gradient(135deg, #07111f 0%, #0c1930 50%, #111b35 100%)',
        color: '#ffffff',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '460px',
          background: 'rgba(255,255,255,0.07)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '24px',
          padding: '32px',
          boxShadow: '0 24px 70px rgba(0,0,0,0.35)',
        }}
      >
        <div
          style={{
            fontSize: '28px',
            fontWeight: 800,
            marginBottom: '8px',
          }}
        >
          Castora
        </div>

        <h1
          style={{
            fontSize: '24px',
            margin: '20px 0 8px',
          }}
        >
          Join broadcast
        </h1>

        <p
          style={{
            margin: '0 0 28px',
            opacity: 0.72,
            lineHeight: 1.5,
          }}
        >
          Enter your name and email to join the event.
          No password or verification code is required.
        </p>

        <form onSubmit={joinEvent}>
          <label
            style={{
              display: 'block',
              marginBottom: '8px',
              fontWeight: 600,
            }}
          >
            Name
          </label>

          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            autoComplete="name"
            maxLength={80}
            required
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '14px 16px',
              borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.16)',
              background: 'rgba(255,255,255,0.08)',
              color: '#fff',
              fontSize: '16px',
              marginBottom: '18px',
              outline: 'none',
            }}
          />

          <label
            style={{
              display: 'block',
              marginBottom: '8px',
              fontWeight: 600,
            }}
          >
            Email
          </label>

          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            autoComplete="email"
            maxLength={254}
            required
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '14px 16px',
              borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.16)',
              background: 'rgba(255,255,255,0.08)',
              color: '#fff',
              fontSize: '16px',
              marginBottom: '20px',
              outline: 'none',
            }}
          />

          {error && (
            <div
              style={{
                marginBottom: '18px',
                padding: '12px',
                borderRadius: '10px',
                background: 'rgba(220,38,38,0.18)',
                border: '1px solid rgba(248,113,113,0.35)',
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              border: 0,
              borderRadius: '12px',
              padding: '15px 18px',
              fontSize: '16px',
              fontWeight: 700,
              cursor: loading ? 'wait' : 'pointer',
              background: '#ffffff',
              color: '#07111f',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Joining…' : 'Join broadcast'}
          </button>
        </form>

        <p
          style={{
            textAlign: 'center',
            marginTop: '22px',
            marginBottom: 0,
            fontSize: '13px',
            opacity: 0.5,
          }}
        >
          Participant access • Castora
        </p>
      </div>
    </main>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={<div>Loading…</div>}>
      <JoinPageContent />
    </Suspense>
  );
}
