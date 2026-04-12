import type { ComponentType } from "react";

interface Props {
  icon: ComponentType<{ size?: number; className?: string }>;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export default function EmptyState({ icon: Icon, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="w-16 h-16 bg-bg-secondary border border-border rounded-2xl flex items-center justify-center mb-5">
        <Icon size={28} className="text-text-muted" />
      </div>
      <h3 className="font-display text-xl font-bold text-text-primary mb-2">{title}</h3>
      <p className="text-text-muted text-sm max-w-xs leading-relaxed mb-6">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="px-5 py-2.5 bg-gold text-bg-primary text-sm font-semibold rounded-lg hover:bg-gold-light transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
