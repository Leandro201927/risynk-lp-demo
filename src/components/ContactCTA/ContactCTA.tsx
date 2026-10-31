import { CONTACT } from '../../content/storyContent';

export function ContactCTA({ label }: { label: string }) {
  return (
    <a className="btn" href={CONTACT.href}>
      {label}
    </a>
  );
}
