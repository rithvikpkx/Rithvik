"use client";

/** A small trash-can button that permanently deletes one row through a server action, after a confirm. */
export default function Trash({ id, action, what }: { id: string; action: (fd: FormData) => Promise<void>; what: string }) {
  return (
    <form action={action} className="d-trash" onSubmit={(e) => { if (!confirm(`Delete this ${what} permanently? This cannot be undone.`)) e.preventDefault(); }}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" aria-label={`Delete ${what}`} title={`Delete ${what}`}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" />
        </svg>
      </button>
    </form>
  );
}
