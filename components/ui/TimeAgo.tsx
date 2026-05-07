'use client';
import { formatDistanceToNow } from 'date-fns';
import { useEffect, useState } from 'react';

export function TimeAgo({ iso }: { iso: string }) {
  const [text, setText] = useState(() => formatDistanceToNow(new Date(iso), { addSuffix: true }));
  useEffect(() => {
    const id = setInterval(
      () => setText(formatDistanceToNow(new Date(iso), { addSuffix: true })),
      60_000,
    );
    return () => clearInterval(id);
  }, [iso]);
  return <time dateTime={iso} className="text-xs text-text-muted">{text}</time>;
}
