"use client";
import { Fragment } from "react";
import type { SectionProps } from "@/lib/designs/skin";
import { Icon } from "@/components/site/Glyph";
import "./contact.css";

/** Every way to reach him opens the message window (data-compose); the address itself is only ever shown, and
 *  copyable, inside that window. A skin adds flavour through `contactLead` and `ContactFrame`. */
export default function Contact({ skin }: SectionProps) {
  const Frame = skin.ContactFrame ?? Fragment;
  return (
    <div className="ly-contact">
      <Frame>
        {skin.contactLead && <p className="ly-contact-k">{skin.contactLead}</p>}
        <p className="ly-contact-h">Always open to new opportunities.</p>
        <p className="ly-contact-s">Connect with me to learn more.</p>
        <div className="ly-contact-acts">
          <button type="button" className="ly-btn solid" data-compose="Internship opportunity"><Icon name="mail" />Discuss a role</button>
          <button type="button" className="ly-btn" data-compose="A question">Ask a question</button>
          <button type="button" className="ly-btn" data-compose="Hello">Say hello</button>
        </div>
      </Frame>
    </div>
  );
}
