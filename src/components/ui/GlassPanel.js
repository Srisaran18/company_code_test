export default function GlassPanel({ as: Tag = "div", className = "", children, ...props }) {
  return (
    <Tag className={`glass rounded-[28px] ${className}`} {...props}>
      {children}
    </Tag>
  );
}

export function PageIntro({ kicker, title, children }) {
  return (
    <div className="mb-5">
      <p className="text-sm font-medium text-brand-teal">{kicker}</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">{title}</h1>
      {children}
    </div>
  );
}
