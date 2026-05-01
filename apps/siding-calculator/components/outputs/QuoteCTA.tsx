'use client';
import React from 'react';

type Props = {
  onClick: () => void;
};

export function QuoteCTA({ onClick }: Props) {
  return (
    <button onClick={onClick} className="rounded-full bg-emerald-600 px-5 py-2.5 text-white">
      Get a Quote →
    </button>
  );
}
