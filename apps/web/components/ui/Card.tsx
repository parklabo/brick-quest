interface CardProps {
  children: React.ReactNode;
  className?: string;
  studs?: boolean;
  color?: 'default' | 'red' | 'blue' | 'green' | 'yellow';
}

const STUD_COLORS: Record<string, string> = {
  default: 'bg-slate-700',
  red: 'bg-lego-red/60',
  blue: 'bg-lego-blue/60',
  green: 'bg-lego-green/60',
  yellow: 'bg-lego-yellow/60',
};

export function Card({ children, className = '', studs = false, color = 'default' }: CardProps) {
  return (
    <div className={`brick-card p-6 ${className}`}>
      {studs && (
        <div className="flex items-center gap-2 mb-4 -mt-1">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className={`stud ${STUD_COLORS[color]}`} />
          ))}
        </div>
      )}
      {children}
    </div>
  );
}
