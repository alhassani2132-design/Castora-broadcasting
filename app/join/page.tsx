'use client';

import { FormEvent, Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Room,
  RoomEvent,
  Track,
  Participant,
} from 'livekit-client';

function ParticipantTile({ participant }: { participant: Participant }) {
  const mediaRef = useRef<HTMLDivElement>(null);
  const [, refresh] = useState(0);

  useEffect(() => {
    const update = () => refresh((v) => v + 1);

    participant
      .on('trackPublished', update)
      .on('trackUnpublished', update)
      .on('trackSubscribed', update)
      .on('trackUnsubscribed', update)
      .on('trackMuted', update)
      .on('trackUnmuted', update);

    return () => {
      participant
        .off('trackPublished', update)
        .off('trackUnpublished', update)
        .off('trackSubscribed', update)
        .off('trackUnsubscribed', update)
        .off('trackMuted', update)
        .off('trackUnmuted', update);
    };
  }, [participant]);

  const publications = [...participant.trackPublications.values()];

  const video =
    publications.find(
      (p) =>
        p.source === Track.Source.ScreenShare &&
        p.track &&
        !p.isMuted
    )?.track ||
    publications.find(
      (p) =>
        p.kind === Track.Kind.Video &&
        p.track &&
        !p.isMuted
    )?.track;

  const audio = publications
    .filter(
      (p) =>
        p.kind === Track.Kind.Audio &&
        p.track &&
        !p.isMuted
    )
    .map((p) => p.track!);

  useEffect(() => {
    const elements: HTMLMediaElement[] = [];

    if (video) {
      const element = video.attach();
      element.autoplay = true;
      element.setAttribute('playsinline', '');
      mediaRef.current?.appendChild(element);
      elements.push(element);
    }

    for (const track of audio) {
      const element = track.attach();
      element.autoplay = true;
      mediaRef.current?.appendChild(element);
      elements.push(element);
    }

    return () => {
      if (video) video.detach();
      audio.forEach((track) => track.detach());
      elements.forEach((element) => element.remove());
    };
  }, [video, audio.map((t) => t.sid).join(',')]);

  return (
    <div
      style={{
        background: '#111827',
        borderRadius: 16,
        overflow: 'hidden',
        minHeight: 220,
        position: 'relative',
      }}
    >
      <div ref={mediaRef} style={{ width: '100%', height: '100%' }} />

      {!video && (
        <div
          style={{
            minHeight: 220,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 48,
          }}
        >
          {(participant.name || 'G')[0].toUpperCase()}
        </div>
      )}

      <div
        style={{
          position: 'absolute',
          bottom: 12,
          left: 12,
          background: 'rgba(0,0,0,.65)',
          borderRadius: 8,
          padding: '6px 10px',
          fontSize: 13,
        }}
      >
        {participant.name || 'Participant'}
      </div>
    </div>
  );
}

function JoinPageContent() {
  const searchParams = useSearchParams();

  const event = searchParams.get('event') || '';
  const invite = searchParams.get('invite') || '';

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [room, setRoom] = useState<Room | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [identity, setIdentity] = useState('');

  async function joinEvent(e: FormEvent) {
    e.preventDefault();

    setError('');
    setLoading(true);

    let liveRoom: Room | null = null;

    try {
      const response = await fetch('/api/guest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'join',
          event,
          invite,
          name: name.trim(),
          email: email.trim().toLowerCase(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || 'Unable to join this event.'
        );
      }

      liveRoom = new Room({
        adaptiveStream: true,
        dynacast: true,
      });

      const updateParticipants = () => {
        if (!liveRoom) return;

        setParticipants([
          ...liveRoom.remoteParticipants.values(),
        ]);
      };

      liveRoom
        .on(RoomEvent.ParticipantConnected, updateParticipants)
        .on(RoomEvent.ParticipantDisconnected, updateParticipants)
        .on(RoomEvent.TrackSubscribed, updateParticipants)
        .on(RoomEvent.TrackUnsubscribed, updateParticipants);

      await liveRoom.connect(data.url, data.token);

      await liveRoom.startAudio();

      setIdentity(data.identity);
      setRoom(liveRoom);

      updateParticipants();
    } catch (err) {
      await liveRoom?.disconnect();

      setError(
        err instanceof Error
          ? err.message
          : 'Unable to join this event.'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!room || !identity) return;

    const timer = setInterval(() => {
      fetch('/api/guest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'heartbeat',
          event,
          invite,
          name,
          email,
          identity,
        }),
      }).catch(() => {});
    }, 30000);

    return () => clearInterval(timer);
  }, [room, identity, event, invite, name, email]);

  async function leaveEvent() {
    await room?.disconnect();

    setRoom(null);
    setIdentity('');
    setParticipants([]);
  }

  if (room) {
    return (
      <main
        style={{
          minHeight: '100vh',
          background: '#070d18',
          color: '#fff',
          padding: 24,
          fontFamily: 'Arial, sans-serif',
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: '0 auto',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 24,
            }}
          >
            <div>
              <div
                style={{
                  fontWeight: 800,
                  fontSize: 25,
                }}
              >
                Castora
              </div>

              <div
                style={{
                  opacity: 0.65,
                  marginTop: 5,
                }}
              >
                Connected as {name}
              </div>
            </div>

            <button
              onClick={leaveEvent}
              style={{
                padding: '10px 16px',
                borderRadius: 10,
                border: '1px solid #374151',
                background: '#111827',
                color: '#fff',
              }}
            >
              Leave event
            </button>
          </div>

          {participants.length === 0 ? (
            <div
              style={{
                padding: 40,
                borderRadius: 16,
                background: '#111827',
                textAlign: 'center',
              }}
            >
              You are connected.
              <br />
              The host's video or shared screen will appear here.
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(auto-fit,minmax(280px,1fr))',
                gap: 16,
              }}
            >
              {participants.map((participant) => (
                <ParticipantTile
                  key={participant.identity}
                  participant={participant}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background:
          'linear-gradient(135deg,#07111f,#0c1930,#111b35)',
        color: '#fff',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 460,
          background: 'rgba(255,255,255,.07)',
          border: '1px solid rgba(255,255,255,.12)',
          borderRadius: 24,
          padding: 32,
        }}
      >
        <div
          style={{
            fontSize: 28,
            fontWeight: 800,
          }}
        >
          Castora
        </div>

        <h1>Join broadcast</h1>

        <p style={{ opacity: 0.7 }}>
          Enter your name and email to join.
          No OTP or password is required.
        </p>

        <form onSubmit={joinEvent}>
          <label>Name</label>

          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={80}
            style={{
              width: '100%',
              padding: 14,
              margin: '8px 0 18px',
              boxSizing: 'border-box',
              borderRadius: 10,
            }}
          />

          <label>Email</label>

          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            maxLength={254}
            style={{
              width: '100%',
              padding: 14,
              margin: '8px 0 18px',
              boxSizing: 'border-box',
              borderRadius: 10,
            }}
          />

          {error && (
            <div
              style={{
                background: '#7f1d1d',
                padding: 12,
                borderRadius: 10,
                marginBottom: 16,
              }}
            >
              {error}
            </div>
          )}

          <button
            disabled={loading}
            style={{
              width: '100%',
              padding: 15,
              border: 0,
              borderRadius: 10,
              fontWeight: 700,
            }}
          >
            {loading ? 'Joining…' : 'Join event'}
          </button>
        </form>
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
