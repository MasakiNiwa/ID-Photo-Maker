import * as Accordion from '@radix-ui/react-accordion';
import { ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';
import './sections.css';

/** 見出しごとに折りたためるセクション群（既定ではすべて閉じる） */
export function Sections({ children }: { children: ReactNode }) {
  return (
    <Accordion.Root type="multiple" defaultValue={[]} className="sections">
      {children}
    </Accordion.Root>
  );
}

export function Section({
  id,
  title,
  icon,
  summary,
  children,
}: {
  id: string;
  title: string;
  icon?: ReactNode;
  summary?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Accordion.Item value={id} className="section">
      <Accordion.Header asChild>
        <h2>
          <Accordion.Trigger className="section-trigger">
            {icon && <span className="section-icon">{icon}</span>}
            <span className="section-title">
              {title}
              {summary && <span className="section-summary">{summary}</span>}
            </span>
            <ChevronDown className="section-chevron" size={20} aria-hidden />
          </Accordion.Trigger>
        </h2>
      </Accordion.Header>
      <Accordion.Content className="section-content">
        <div className="section-body">{children}</div>
      </Accordion.Content>
    </Accordion.Item>
  );
}
