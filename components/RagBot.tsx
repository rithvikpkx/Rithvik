"use client";
import { useState } from "react";

export default function RagBot() {
  const [open, setOpen] = useState(false);

  return (
    <div className="rag-launcher">
      <div className={`rag-panel${open ? " open" : ""}`}>
        <div className="rag-header">
          <div className="rag-title-group">
            <span className="pulse-dot" />
            <span className="rag-title">RAG</span>
            <span className="rag-subtitle">Rithvik Augmented Generation</span>
          </div>
          <button className="rag-close" onClick={() => setOpen(false)} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="rag-messages">
          <div className="rag-message">
            <p>
              Hey! I&apos;m RAG — I know everything about Rithvik. Ask me about his projects,
              skills, or background.
            </p>
          </div>
          <div className="rag-message">
            <p>
              <em>Full AI functionality coming soon. This is a preview UI.</em>
            </p>
          </div>
        </div>
        <div className="rag-input-row">
          <input
            type="text"
            className="rag-input"
            placeholder="Ask me anything about Rithvik..."
            disabled
          />
          <button className="rag-send" disabled aria-label="Send">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="16" height="16">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      <button className="rag-btn" onClick={() => setOpen((o) => !o)} aria-label="Chat with RAG">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        <span>Ask RAG</span>
      </button>
    </div>
  );
}
