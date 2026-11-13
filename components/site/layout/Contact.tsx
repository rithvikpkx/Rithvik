"use client";
import { Fragment } from "react";
import type { SectionProps } from "@/lib/designs/skin";
import ContactCloud from "./ContactCloud";
import "./contact.css";

/** The headline and one line, then the contact cloud (GitHub, LinkedIn, Email, Resume floating and orbiting). Email opens
 *  the message window (data-compose); the address itself is only ever shown, and copyable, inside that window.
 *  A skin adds flavour through `contactLead` and `ContactFrame`. */
export default function Contact({ skin }: SectionProps) {
  const Frame = skin.ContactFrame ?? Fragment;
  return (
    <div className="ly-contact">
      <Frame>
        {skin.contactLead && <p className="ly-contact-k">{skin.contactLead}</p>}
        <p className="ly-contact-h">Always open to new opportunities.</p>
        <p className="ly-contact-s">Connect with me to learn more.</p>
        <ContactCloud />
      </Frame>
    </div>
  );
}
